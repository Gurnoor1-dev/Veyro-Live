import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { json, fail } from "../_shared/http.ts";
import { getOrganizationAccessToken } from "../_shared/org-token.ts";
import { getUserInfiniteFlightToken, getInfiniteFlightUserInfo } from "../_shared/user-if-token.ts";
import { ifRequest, IfApiRateLimitError, reserveIfApiRequests } from "../_shared/infinite-flight.ts";

async function adminProfileUpsert(userId: string, infiniteFlightUserId: string, displayName: string) {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  return await admin.from("profiles").upsert({ id: userId, infinite_flight_user_id: infiniteFlightUserId, display_name: displayName }, { onConflict: "id" }).select("infinite_flight_user_id").single();
}

function discordMessageUrl(guildId: string, channelId: string, messageId: string) {
  return "https://discord.com/channels/" + guildId + "/" + channelId + "/" + messageId;
}

function buildDiscordMessage(bookingId: string, profile: any, selected: Record<string, unknown>, seatRole: number, registration: string, referenceCode: string) {
  const route = [selected.originIcao, selected.destinationIcao].filter(Boolean).join(" → ") || "Route details available in Live";
  const pilotLabel = profile.discord_user_id ? "<@" + profile.discord_user_id + ">" : "Pilot account " + profile.infinite_flight_user_id;
  const departure = selected.isTimeless ? "Any time" : selected.scheduledDepartureUtc ? new Date(String(selected.scheduledDepartureUtc)).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "Any time";
  const arrival = selected.isTimeless ? "Any time" : selected.scheduledArrivalUtc ? new Date(String(selected.scheduledArrivalUtc)).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "Any time";
  return {
    content: "New flight-leg request requires administrator review.",
    embeds: [{
      title: "CREW REQUEST · PENDING",
      color: 16763904,
      fields: [
        { name: "Registration", value: registration || "—", inline: true },
        { name: "Flight number", value: String(selected.callsign ?? "—"), inline: true },
        { name: "Route", value: String(route), inline: true },
        { name: "Pilot", value: pilotLabel, inline: true },
        { name: "Seat", value: seatRole === 1 ? "First Officer" : "Captain", inline: true },
        { name: "Departure", value: departure + " → " + arrival, inline: true },
        { name: "Approved by", value: "— · — · " + referenceCode, inline: false },
      ],
      footer: { text: "VEYRO Live • Reference " + referenceCode },
    }],
    components: [{
      type: 1,
      components: [
        { type: 2, style: 3, label: "Approve", custom_id: "approve:" + bookingId },
        { type: 2, style: 4, label: "Reject", custom_id: "reject:" + bookingId },
      ],
    }],
    allowed_mentions: { parse: [], users: profile.discord_user_id ? [profile.discord_user_id] : [] },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return fail("Method not allowed", 405);
  const auth = req.headers.get("Authorization");
  if (!auth) return fail("Unauthorized", 401);
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.organizationId || !body?.scheduleId || !body?.aircraftId) return fail("Missing booking details");
  const seatRole = body.seatRole === 1 ? 1 : body.seatRole === 0 || body.seatRole === undefined ? 0 : -1;
  if (seatRole < 0) return fail("Choose Captain or First Officer before requesting this leg.", 400);

  const { data: member } = await client.from("organization_memberships").select("user_id")
    .eq("organization_id", body.organizationId).eq("user_id", user.id).eq("is_active", true).single();
  if (!member) return fail("Not an active organization member", 403);

  let { data: profile } = await client.from("profiles")
    .select("infinite_flight_user_id,discord_user_id,display_name").eq("id", user.id).maybeSingle();
  if (!profile?.infinite_flight_user_id) {
    try {
      const personalConnection = await getUserInfiniteFlightToken(user.id);
      const identity = await getInfiniteFlightUserInfo(personalConnection.token);
      if (identity) {
        const { data: repaired, error: repairError } = await adminProfileUpsert(user.id, identity.userId, identity.displayName);
        if (repairError) console.error("[booking-request] profile link repair failed", repairError.message);
        else profile = { ...(profile ?? {}), infinite_flight_user_id: identity.userId, display_name: identity.displayName };
      }
    } catch (identityError) {
      console.error("[booking-request] could not resolve Infinite Flight identity", identityError instanceof Error ? identityError.message : String(identityError));
    }
  }
  if (!profile?.infinite_flight_user_id) return fail("Your Infinite Flight connection is active, but your pilot identity could not be verified. Reconnect Infinite Flight from your dashboard, then retry.", 409);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: org } = await admin.from("organizations")
    .select("id,live_organization_id,booking_mode").eq("id", body.organizationId).eq("is_active", true).single();
  if (!org) return fail("Organization not found", 404);

  try {
    const activeStatuses = ["pending_approval", "approved", "sync_failed"];
    const { data: existingRecord, error: existingError } = await admin.from("booking_requests")
      .select("id,organization_id,pilot_user_id,pilot_if_user_id,live_schedule_id,live_aircraft_id,status,discord_message_id,created_at")
      .eq("organization_id", org.id).eq("live_schedule_id", body.scheduleId).in("status", activeStatuses).maybeSingle();
    if (existingError) throw existingError;
    let existing = existingRecord;

    if (existing && existing.pilot_user_id !== user.id) {
      return fail("This schedule already has an active reservation.", 409);
    }

    // Idempotent retry: a previous click may already have created the booking.
    // Return it before spending more Infinite Flight API allowance. For pending
    // requests, verify that the Discord post still exists; if it was deleted,
    // continue below and recreate the approval embed instead of making a second booking.
    let existingNeedsDiscordRepair = false;
    if (existing && existing.status !== "approved") {
      if (existing.status !== "pending_approval") {
        const { data: existingSettings } = existing.discord_message_id
          ? await admin.from("discord_settings").select("guild_id,approval_channel_id").eq("organization_id", org.id).maybeSingle()
          : { data: null };
        return json({
          booking: existing,
          alreadyExists: true,
          discordMessageUrl: existing.discord_message_id && existingSettings
            ? discordMessageUrl(existingSettings.guild_id, existingSettings.approval_channel_id, existing.discord_message_id)
            : null,
        });
      }
      const { data: discord, error: discordSettingsError } = await admin.from("discord_settings")
        .select("guild_id,approval_channel_id,enabled").eq("organization_id", org.id).maybeSingle();
      if (discordSettingsError) throw discordSettingsError;
      const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
      if (!discord?.enabled || !botToken) {
        return fail("Your leg request already exists, but its Discord approval post is not configured. Ask an organisation administrator to check the Veyro Discord integration.", 503);
      }
      if (existing.discord_message_id) {
        const check = await fetch("https://discord.com/api/v10/channels/" + discord.approval_channel_id + "/messages/" + existing.discord_message_id, {
          headers: { Authorization: "Bot " + botToken, Accept: "application/json" },
        });
        if (check.ok) {
          return json({
            booking: existing,
            alreadyExists: true,
            discordMessageUrl: discordMessageUrl(discord.guild_id, discord.approval_channel_id, existing.discord_message_id),
          });
        }
        if (check.status !== 404) {
          // A bot without Read Message History may receive 403 even though its
          // original post is still present. Keep the reservation idempotent and
          // give the pilot the direct message link instead of creating duplicates.
          const detail = await check.text().catch(() => "");
          console.warn("[booking-request] Discord post verification was limited", { status: check.status, detail: detail.slice(0, 300) });
          return json({
            booking: existing,
            alreadyExists: true,
            discordMessageUrl: discordMessageUrl(discord.guild_id, discord.approval_channel_id, existing.discord_message_id),
            discordVerificationLimited: true,
          });
        }
      }
      existingNeedsDiscordRepair = true;
    }

    const token = await getOrganizationAccessToken(org.id);
    await reserveIfApiRequests(3);
    const [members, schedules, aircraft] = await Promise.all([
      ifRequest<Array<{ userId: string }>>(token, "/live/organizations/" + org.live_organization_id + "/members", {}, undefined, false, true),
      ifRequest<Array<Record<string, unknown>>>(token, "/live/aircraft/" + body.aircraftId + "/schedules", {}, undefined, false, true),
      ifRequest<Array<Record<string, unknown>>>(token, "/live/organizations/" + org.live_organization_id + "/aircraft", {}, undefined, false, true),
    ]);
    if (!members.some((item) => item.userId === profile.infinite_flight_user_id)) {
      return fail("Your Infinite Flight account is not currently a member of this Live organization.", 403);
    }
    const selected = schedules.find((schedule) => schedule.id === body.scheduleId);
    if (!selected) return fail("This schedule is no longer available. Refresh the flight board.", 409);
    const selectedAircraft = aircraft.find((item) => item.id === body.aircraftId);
    const registration = String(selectedAircraft?.registration ?? selectedAircraft?.tailNumber ?? "—");

    // Infinite Flight is the source of truth for crew assignments. A pilot can
    // be unassigned directly on the IF website, which does not trigger a Veyro
    // webhook. Reconcile an old approved reservation against the fresh schedule
    // payload before applying the active-reservation guard. Pending approvals
    // are deliberately excluded because they are not expected to be in Live crew.
    if (existing?.status === "approved") {
      const liveCrew = Array.isArray(selected.crew) ? selected.crew as Array<{ userId?: string }> : [];
      const stillAssigned = liveCrew.some((crewMember) => crewMember.userId === profile.infinite_flight_user_id);
      if (!stillAssigned) {
        const { error: staleReservationError } = await admin.from("booking_requests")
          .update({
            status: "cancelled",
            rejection_reason: "Pilot was unassigned directly in Infinite Flight; reservation reconciled on the next request.",
          })
          .eq("id", existing.id)
          .eq("status", "approved");
        if (staleReservationError) throw staleReservationError;
        console.info("[booking-request] reconciled externally removed crew assignment", {
          bookingId: existing.id,
          scheduleId: body.scheduleId,
        });
        existing = null;
      } else {
        const { data: existingSettings } = existing.discord_message_id
          ? await admin.from("discord_settings").select("guild_id,approval_channel_id").eq("organization_id", org.id).maybeSingle()
          : { data: null };
        return json({
          booking: existing,
          alreadyExists: true,
          discordMessageUrl: existing.discord_message_id && existingSettings
            ? discordMessageUrl(existingSettings.guild_id, existingSettings.approval_channel_id, existing.discord_message_id)
            : null,
        });
      }
    }

    const automatic = org.booking_mode === "preapproved";
    let booking: any = existing;
    if (!booking) {
      const referenceCode = Array.from(crypto.getRandomValues(new Uint8Array(6)), (value) => "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"[value % 36]).join("");
      const { data: created, error } = await client.from("booking_requests").insert({
        organization_id: org.id,
        pilot_user_id: user.id,
        pilot_if_user_id: profile.infinite_flight_user_id,
        live_schedule_id: body.scheduleId,
        live_aircraft_id: body.aircraftId,
        seat_role: seatRole,
        reference_code: referenceCode,
        aircraft_registration: registration,
        flight_number: String(selected.callsign ?? ""),
        origin_icao: String(selected.originIcao ?? ""),
        destination_icao: String(selected.destinationIcao ?? ""),
        departure_time: selected.isTimeless ? null : (selected.scheduledDepartureUtc ?? null),
        request_note: typeof body.note === "string" ? body.note.slice(0, 500) : null,
        status: automatic ? "sync_failed" : "pending_approval",
      }).select("id,status,created_at,seat_role,reference_code").single();

      if (error) {
        if (error.code !== "23505") return fail("Could not create booking request", 500);
        const { data: raced } = await admin.from("booking_requests")
          .select("id,organization_id,pilot_user_id,pilot_if_user_id,live_schedule_id,live_aircraft_id,status,discord_message_id,created_at")
          .eq("organization_id", org.id).eq("live_schedule_id", body.scheduleId).in("status", activeStatuses).maybeSingle();
        if (!raced || raced.pilot_user_id !== user.id) return fail("This schedule already has an active reservation.", 409);
        if (raced.status !== "pending_approval" || raced.discord_message_id) {
          const { data: settings } = await admin.from("discord_settings").select("guild_id,approval_channel_id")
            .eq("organization_id", org.id).maybeSingle();
          return json({
            booking: raced,
            alreadyExists: true,
            discordMessageUrl: raced.discord_message_id && settings
              ? discordMessageUrl(settings.guild_id, settings.approval_channel_id, raced.discord_message_id)
              : null,
          });
        }
        booking = raced;
      } else {
        booking = created;
      }
    }

    if (automatic) {
      try {
        await ifRequest(token, "/live/schedules/" + body.scheduleId + "/crew/" + profile.infinite_flight_user_id, {
          method: "PUT",
          body: JSON.stringify({ role: seatRole }),
        });
        const { error: updateError } = await admin.from("booking_requests").update({
          status: "approved", reviewed_at: new Date().toISOString(), sync_error_code: null,
        }).eq("id", booking.id);
        if (updateError) throw updateError;
        await admin.from("audit_events").insert({
          organization_id: org.id, actor_user_id: user.id, event_type: "booking.preapproved", subject_id: booking.id,
        });
        return json({ booking: { ...booking, status: "approved" }, autoApproved: true });
      } catch (error) {
        await admin.from("booking_requests").update({ status: "sync_failed", sync_error_code: "live_assignment_failed" }).eq("id", booking.id);
        return fail("Automatic approval was recorded but Live crew assignment failed. An administrator must retry synchronization.", 502);
      }
    }

    const { data: discord, error: discordSettingsError } = await admin.from("discord_settings")
      .select("guild_id,approval_channel_id,enabled").eq("organization_id", org.id).maybeSingle();
    if (discordSettingsError) throw discordSettingsError;
    if (!discord?.enabled) {
      if (!existingNeedsDiscordRepair) await admin.from("booking_requests").update({ status: "cancelled" }).eq("id", booking.id);
      return fail("This organization has not enabled Discord approvals yet.", 409);
    }
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    if (!botToken) {
      if (!existingNeedsDiscordRepair) await admin.from("booking_requests").update({ status: "cancelled" }).eq("id", booking.id);
      return fail("Discord bot is not configured. The request was not submitted.", 503);
    }

    const payload = buildDiscordMessage(booking.id, profile, selected, seatRole, registration, booking.reference_code || "------");
    let discordMessageId = existing?.discord_message_id ?? null;
    let response: Response | null = null;
    if (discordMessageId) {
      response = await fetch("https://discord.com/api/v10/channels/" + discord.approval_channel_id + "/messages/" + discordMessageId, {
        method: "PATCH",
        headers: { Authorization: "Bot " + botToken, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.status === 404) response = null;
    }
    if (!response) {
      response = await fetch("https://discord.com/api/v10/channels/" + discord.approval_channel_id + "/messages", {
        method: "POST",
        headers: { Authorization: "Bot " + botToken, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    const discordMessage = await response.json().catch(() => null);
    if (!response.ok || !discordMessage?.id) {
      console.error("[booking-request] Discord approval post failed", {
        status: response.status,
        code: discordMessage?.code,
        message: discordMessage?.message,
      });
      // Keep a pending request active when notification delivery fails. A retry
      // will repair the same request rather than creating another reservation.
      return fail("Your leg request is saved, but Discord could not publish its approval embed. Please retry once or ask an administrator to check the bot's channel permissions.", 502);
    }

    const { error: messageUpdateError } = await admin.from("booking_requests")
      .update({ discord_message_id: discordMessage.id }).eq("id", booking.id);
    if (messageUpdateError) {
      console.error("[booking-request] Discord post created but message ID could not be saved", messageUpdateError.message);
      return fail("The approval post was created, but Veyro could not save its Discord reference. Please contact an administrator.", 502);
    }
    const url = discordMessageUrl(discord.guild_id, discord.approval_channel_id, discordMessage.id);
    return json({
      booking: { ...booking, discord_message_id: discordMessage.id },
      alreadyExists: Boolean(existing || existingNeedsDiscordRepair),
      discordPostRepaired: Boolean(existingNeedsDiscordRepair),
      discordMessageUrl: url,
    });
  } catch (error) {
    if (error instanceof IfApiRateLimitError) return fail(error.message, 429, { "Retry-After": String(error.retryAfterSeconds) });
    console.error("[booking-request] failed", error);
    return fail(error instanceof Error ? error.message : "Could not verify the current Live schedule.", 502);
  }
});
