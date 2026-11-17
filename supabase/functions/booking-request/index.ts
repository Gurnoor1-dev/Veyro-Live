import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { json, fail } from "../_shared/http.ts";
import { getOrganizationAccessToken } from "../_shared/org-token.ts";
import { getUserInfiniteFlightToken, getInfiniteFlightUserInfo } from "../_shared/user-if-token.ts";
import { ifRequest, IfApiRateLimitError, reserveIfApiRequests } from "../_shared/infinite-flight.ts";

async function adminProfileUpsert(userId: string, infiniteFlightUserId: string, displayName: string) {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  return await admin.from("profiles").upsert({ id: userId, infinite_flight_user_id: infiniteFlightUserId, display_name: displayName }, { onConflict: "id" }).select("infinite_flight_user_id").single();
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
  const { data: member } = await client.from("organization_memberships").select("user_id").eq("organization_id", body.organizationId).eq("user_id", user.id).eq("is_active", true).single();
  if (!member) return fail("Not an active organization member", 403);
  let { data: profile } = await client.from("profiles").select("infinite_flight_user_id,discord_user_id,display_name").eq("id", user.id).maybeSingle();
  // Older OAuth sessions may have valid encrypted credentials but no linked IF
  // subject because the initial callback could not resolve the OIDC profile.
  // Repair that link from the user's own token before rejecting a leg request.
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
  const { data: org } = await admin.from("organizations").select("id,live_organization_id,booking_mode").eq("id", body.organizationId).eq("is_active", true).single();
  if (!org) return fail("Organization not found", 404);
  try {
    const token = await getOrganizationAccessToken(org.id);
    await reserveIfApiRequests(2);
    const [members, schedules] = await Promise.all([
      ifRequest<Array<{ userId: string }>>(token, "/live/organizations/" + org.live_organization_id + "/members", {}, undefined, false, true),
      ifRequest<Array<Record<string, unknown>>>(token, "/live/aircraft/" + body.aircraftId + "/schedules", {}, undefined, false, true),
    ]);
    if (!members.some((item) => item.userId === profile.infinite_flight_user_id)) return fail("Your Infinite Flight account is not currently a member of this Live organization.", 403);
    const selected = schedules.find((schedule) => schedule.id === body.scheduleId);
    if (!selected) return fail("This schedule is no longer available. Refresh the flight board.", 409);
    const automatic = org.booking_mode === "preapproved";
    const { data: booking, error } = await client.from("booking_requests").insert({
      organization_id: org.id, pilot_user_id: user.id, pilot_if_user_id: profile.infinite_flight_user_id,
      live_schedule_id: body.scheduleId, live_aircraft_id: body.aircraftId,
      request_note: typeof body.note === "string" ? body.note.slice(0, 500) : null,
      status: automatic ? "sync_failed" : "pending_approval",
    }).select("id,status,created_at").single();
    if (error) return error.code === "23505" ? fail("This schedule already has an active reservation.", 409) : fail("Could not create booking request", 500);

    if (automatic) {
      try {
        await ifRequest(token, "/live/schedules/" + body.scheduleId + "/crew/" + profile.infinite_flight_user_id, { method: "PUT", body: JSON.stringify({ role: 0 }) });
        const { error: updateError } = await admin.from("booking_requests").update({ status: "approved", reviewed_at: new Date().toISOString(), sync_error_code: null }).eq("id", booking.id);
        if (updateError) throw updateError;
        await admin.from("audit_events").insert({ organization_id: org.id, actor_user_id: user.id, event_type: "booking.preapproved", subject_id: booking.id });
        return json({ booking: { ...booking, status: "approved" }, autoApproved: true });
      } catch (error) {
        await admin.from("booking_requests").update({ status: "sync_failed", sync_error_code: "live_assignment_failed" }).eq("id", booking.id);
        return fail("Automatic approval was recorded but Live crew assignment failed. An administrator must retry synchronization.", 502);
      }
    }

    const { data: discord } = await admin.from("discord_settings").select("guild_id,approval_channel_id,enabled").eq("organization_id", org.id).single();
    if (!discord?.enabled) {
      await admin.from("booking_requests").update({ status: "cancelled" }).eq("id", booking.id);
      return fail("This organization has not enabled Discord approvals yet.", 409);
    }
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    if (!botToken) {
      await admin.from("booking_requests").update({ status: "cancelled" }).eq("id", booking.id);
      return fail("Discord bot is not configured. The request was not submitted.", 503);
    }
    const route = [selected.originIcao, selected.destinationIcao].filter(Boolean).join(" → ") || "Route details available in Live";
    const pilotLabel = profile.discord_user_id ? "<@" + profile.discord_user_id + ">" : "Pilot account " + profile.infinite_flight_user_id;
    const message = {
      content: "New flight-leg request requires administrator review.",
      embeds: [{ title: "Flight leg request", color: 5793266, fields: [
        { name: "Pilot", value: pilotLabel, inline: true }, { name: "Route", value: String(route), inline: true },
        { name: "Callsign", value: String(selected.callsign ?? "Not provided"), inline: true }, { name: "Request ID", value: booking.id }
      ], footer: { text: "VEYRO Live • Review before approving" } }],
      components: [{ type: 1, components: [
        { type: 2, style: 3, label: "Approve", custom_id: "approve:" + booking.id },
        { type: 2, style: 4, label: "Reject", custom_id: "reject:" + booking.id }
      ] }],
      allowed_mentions: { parse: [], users: profile.discord_user_id ? [profile.discord_user_id] : [] }
    };
    const response = await fetch("https://discord.com/api/v10/channels/" + discord.approval_channel_id + "/messages", {
      method: "POST", headers: { Authorization: "Bot " + botToken, "Content-Type": "application/json" }, body: JSON.stringify(message)
    });
    const discordMessage = await response.json().catch(() => null);
    if (!response.ok || !discordMessage?.id) {
      await admin.from("booking_requests").update({ status: "cancelled" }).eq("id", booking.id);
      return fail("Discord could not receive the approval request. Please retry.", 502);
    }
    await admin.from("booking_requests").update({ discord_message_id: discordMessage.id }).eq("id", booking.id);
    return json({ booking });
  } catch (error) {
    if (error instanceof IfApiRateLimitError) return fail(error.message, 429, { "Retry-After": String(error.retryAfterSeconds) });
    console.error("[booking-request] failed", error);
    return fail(error instanceof Error ? error.message : "Could not verify the current Live schedule.", 502);
  }
});
