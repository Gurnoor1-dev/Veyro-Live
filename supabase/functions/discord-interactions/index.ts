import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { json, fail } from "../_shared/http.ts";
import { getOrganizationAccessToken } from "../_shared/org-token.ts";
import { ifRequest, IfApiRateLimitError } from "../_shared/infinite-flight.ts";

async function verify(raw: string, signature: string, timestamp: string, publicKeyHex: string) {
  try {
    const hex = (v: string) => new Uint8Array(v.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
    const key = await crypto.subtle.importKey("raw", hex(publicKeyHex), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, hex(signature), new TextEncoder().encode(timestamp + raw));
  } catch { return false; }
}

async function editOriginal(applicationId: string, interactionToken: string, payload: Record<string, unknown>) {
  const response = await fetch("https://discord.com/api/v10/webhooks/" + applicationId + "/" + interactionToken + "/messages/@original", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Discord original response update failed: " + response.status);
}

async function processDecision(interaction: any, action: string, requestId: string) {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const applicationId = String(interaction.application_id ?? "");
  const token = String(interaction.token ?? "");
  try {
    const { data: request, error: requestError } = await admin.from("booking_requests")
      .select("id,organization_id,status,reference_code,discord_message_id,reviewed_at").eq("id", requestId).maybeSingle();
    if (requestError || !request || request.status !== "pending_approval") {
      await editOriginal(applicationId, token, { content: "This request is no longer pending.", components: [] });
      return;
    }
    const { data: settings, error: settingsError } = await admin.from("discord_settings")
      .select("guild_id,approval_channel_id,allowed_approver_role_ids").eq("organization_id", request.organization_id).maybeSingle();
    const roles: string[] = interaction.member?.roles ?? [];
    const allowedRoles: string[] = Array.isArray(settings?.allowed_approver_role_ids) ? settings.allowed_approver_role_ids : [];
    const allowed = !settingsError && settings && interaction.guild_id === settings.guild_id
      && interaction.channel_id === settings.approval_channel_id && roles.some((role) => allowedRoles.includes(role));
    if (!allowed) {
      await editOriginal(applicationId, token, { content: "Review not authorized. Check the configured approver role and channel.", components: [] });
      return;
    }
    const discordUserId = interaction.member?.user?.id ?? interaction.user?.id;
    const { data: profile } = await admin.from("profiles").select("id").eq("discord_user_id", discordUserId).maybeSingle();
    const { data: membership } = profile ? await admin.from("organization_memberships").select("role")
      .eq("organization_id", request.organization_id).eq("user_id", profile.id).eq("is_active", true).maybeSingle() : { data: null };
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      await editOriginal(applicationId, token, { content: "Link your Discord account to an organization administrator first.", components: [] });
      return;
    }
    const nextStatus = action === "approve" ? "sync_failed" : "rejected";
    const { data: updated, error: updateError } = await admin.from("booking_requests").update({
      status: nextStatus, reviewed_by: profile.id, reviewed_at: new Date().toISOString(), discord_interaction_id: interaction.id,
    }).eq("id", request.id).eq("status", "pending_approval").select("id").maybeSingle();
    if (updateError || !updated) {
      await editOriginal(applicationId, token, { content: "This request was already reviewed or could not be updated.", components: [] });
      return;
    }
    const reviewer = interaction.member?.user?.global_name || interaction.member?.user?.username || interaction.user?.global_name || interaction.user?.username || "Organisation administrator";
    const reviewedAt = new Date().toISOString();
    const updateEmbed = async (status: "APPROVED" | "REJECTED" | "PENDING") => {
      const source = interaction.message?.embeds?.[0] ?? {};
      const fields = Array.isArray(source.fields) ? [...source.fields] : [];
      const approvedIndex = fields.findIndex((field: any) => field.name === "Approved by");
      const reviewIndex = fields.findIndex((field: any) => field.name === "Reviewed by");
      const approverField = { name: status === "APPROVED" ? "Approved by" : "Reviewed by", value: (status === "PENDING" ? "Sync pending" : "**" + reviewer + "**") + " · " + (status === "PENDING" ? "—" : reviewedAt.replace("T", " ").slice(0, 16) + " UTC") + " · " + (request.reference_code || "------"), inline: false };
      if (approvedIndex >= 0) fields.splice(approvedIndex, 1);
      if (reviewIndex >= 0) fields.splice(reviewIndex, 1);
      fields.push(approverField);
      const embed = { title: "CREW REQUEST · " + status, description: source.description, url: source.url, timestamp: source.timestamp, color: status === "APPROVED" ? 5763719 : status === "REJECTED" ? 15548997 : 16763904, footer: source.footer, author: source.author, thumbnail: source.thumbnail, image: source.image, fields };
      await editOriginal(applicationId, token, { embeds: [embed], components: [] });
    };
    if (action === "reject") {
      await updateEmbed("REJECTED");
      return;
    }
    const syncResponse = await fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/sync-approval", {
      method: "POST", headers: { "Content-Type": "application/json", apikey: serviceKey, Authorization: "Bearer " + serviceKey },
      body: JSON.stringify({ bookingRequestId: request.id }),
    });
    const syncResult = await syncResponse.json().catch(() => null);
    if (!syncResponse.ok || !syncResult?.success) {
      await updateEmbed("PENDING");
      return;
    }
    await updateEmbed("APPROVED");
  } catch (error) {
    console.error("[discord-interactions] decision processing failed", error instanceof Error ? error.message : String(error));
    try { await editOriginal(applicationId, token, { content: "The decision could not be completed. Please retry or contact an administrator.", components: [] }); } catch { /* interaction token may have expired */ }
  }
}


async function editPublicMessage(channelId: string, messageId: string, payload: Record<string, unknown>) {
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!botToken) return;
  const response = await fetch("https://discord.com/api/v10/channels/" + channelId + "/messages/" + messageId, {
    method: "PATCH",
    headers: { Authorization: "Bot " + botToken, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Discord schedule announcement update failed: " + response.status);
}
function safeDiscordText(value: unknown, max = 100): string {
  return String(value ?? "").replace(/[\\`*_~|<>]/g, "\\Deno.serve(async (req) => {").replace(/@/g, "@\u200b").slice(0, max) || "—";
}
function formatUtc(value?: string | null): string {
  if (!value) return "Not scheduled";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Not scheduled" : parsed.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}
async function processScheduleClaim(interaction: any, scheduleId: string, seatRole: number) {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const applicationId = String(interaction.application_id ?? "");
  const interactionToken = String(interaction.token ?? "");
  let claimId: string | null = null;
  try {
    const { data: event, error: eventError } = await admin.from("live_automation_events")
      .select("id,organization_id,event_type,schedule_id,aircraft_id,discord_message_id,status")
      .in("event_type", ["schedule_revisor", "initial_schedule_open"]).eq("schedule_id", scheduleId).eq("status", "sent").maybeSingle();
    if (eventError || !event || !event.discord_message_id) {
      await editOriginal(applicationId, interactionToken, { content: "This self-service schedule is no longer available.", components: [] });
      return;
    }
    const { data: settings } = await admin.from("discord_settings")
      .select("guild_id,approval_channel_id,unassigned_legs_channel_id,schedule_revisor_channel_id,enabled").eq("organization_id", event.organization_id).maybeSingle();
    const expectedChannelId = event.event_type === "initial_schedule_open" ? settings?.unassigned_legs_channel_id : settings?.schedule_revisor_channel_id;
    if (!settings?.enabled || !expectedChannelId || interaction.guild_id !== settings.guild_id || interaction.channel_id !== expectedChannelId) {
      await editOriginal(applicationId, interactionToken, { content: "This claim did not come from the configured organisation channel.", components: [] });
      return;
    }
    const discordUserId = String(interaction.user?.id ?? interaction.member?.user?.id ?? "");
    const { data: profile } = await admin.from("profiles")
      .select("id,infinite_flight_user_id").eq("discord_user_id", discordUserId).maybeSingle();
    if (!profile?.id || !profile.infinite_flight_user_id) {
      await editOriginal(applicationId, interactionToken, { content: "Link your Discord and Infinite Flight accounts in VEYRO Live before claiming a schedule.", components: [] });
      return;
    }
    const { data: membership } = await admin.from("organization_memberships").select("role")
      .eq("organization_id", event.organization_id).eq("user_id", profile.id).eq("is_active", true).maybeSingle();
    if (!membership) {
      await editOriginal(applicationId, interactionToken, { content: "Only active pilots in this organisation can claim this schedule.", components: [] });
      return;
    }
    const { data: org } = await admin.from("organizations")
      .select("id,live_organization_id").eq("id", event.organization_id).eq("is_active", true).maybeSingle();
    const { data: connection } = await admin.from("if_connections")
      .select("live_role,granted_scopes").eq("organization_id", event.organization_id).maybeSingle();
    const scopes: string[] = connection?.granted_scopes ?? [];
    if (!org || !connection || ![1,2].includes(Number(connection.live_role)) ||
      !["live:aircraft.read","live:members.read","live:schedules.read","live:schedules.write"].every((scope) => scopes.includes(scope))) {
      await editOriginal(applicationId, interactionToken, { content: "The organisation's Infinite Flight administrator connection needs to be reconnected with schedule and member permissions.", components: [] });
      return;
    }
    const { data: existingBooking } = await admin.from("booking_requests").select("id")
      .eq("organization_id", event.organization_id).eq("live_schedule_id", scheduleId)
      .in("status", ["pending_approval","approved","sync_failed"]).limit(1).maybeSingle();
    if (existingBooking) {
      await editOriginal(applicationId, interactionToken, { content: "This schedule already has a booking request or assignment in progress.", components: [] });
      return;
    }

    const token = await getOrganizationAccessToken(event.organization_id);
    const schedules = await ifRequest<any[]>(token, "/live/aircraft/" + event.aircraft_id + "/schedules");
    const schedule = (schedules ?? []).find((item: any) => item.id === scheduleId);
    if (!schedule || ![1,8].includes(Number(schedule.status))) {
      await editOriginal(applicationId, interactionToken, { content: "This schedule is no longer available to claim.", components: [] });
      return;
    }
    const isInitialEvent = event.event_type === "initial_schedule_open";
    const earlierSchedules = (schedules ?? []).filter((item: any) => Number(item.sequence) < Number(schedule.sequence));
    const previous = earlierSchedules.filter((item: any) => Number(item.status) === 11 && item.actualArrivalUtc)
      .sort((a: any,b: any) => Number(b.sequence) - Number(a.sequence))[0];
    if (isInitialEvent) {
      if (earlierSchedules.length > 0 || (Array.isArray(schedule.crew) && schedule.crew.length > 0)) {
        await editOriginal(applicationId, interactionToken, { content: "This is no longer an unassigned first leg.", components: [] });
        return;
      }
    } else if (!previous?.actualArrivalUtc || Date.now() - Date.parse(previous.actualArrivalUtc) < 12 * 60 * 60_000) {
      await editOriginal(applicationId, interactionToken, { content: "This aircraft has not yet met the 12-hour ground-time requirement.", components: [] });
      return;
    }
    const position = await ifRequest<any>(token, "/live/aircraft/" + event.aircraft_id + "/position");
    const positionTime = Date.parse(String(position?.updatedAt ?? ""));
    if (position?.isOnGround !== true || !Number.isFinite(positionTime) ||
      (isInitialEvent ? Date.now() - positionTime > 2 * 60_000 || positionTime > Date.now() + 30_000 :
        positionTime < Date.parse(previous.actualArrivalUtc) - 15 * 60_000 || positionTime > Date.now() + 2 * 60_000)) {
      await editOriginal(applicationId, interactionToken, { content: "Infinite Flight no longer confirms this aircraft as grounded. The schedule cannot be claimed right now.", components: [] });
      return;
    }
    const flightPage = await ifRequest<any>(token, "/live/aircraft/" + event.aircraft_id + "/flights", {}, undefined, true);
    const flightLog = Array.isArray(flightPage?.items) ? flightPage.items : [];
    const previousArrivalMs = isInitialEvent ? 0 : Date.parse(previous.actualArrivalUtc);
    const newerActiveFlight = flightLog.some((flight: any) => Number(flight.status) === 0 &&
      (!isInitialEvent || flight.actualDepartureUtc));
    const matchingCompletedFlight = isInitialEvent || flightLog.some((flight: any) => Number(flight.status) === 1 &&
      flight.actualArrivalUtc && Math.abs(Date.parse(flight.actualArrivalUtc) - previousArrivalMs) <= 30 * 60_000 &&
      String(flight.originIcao ?? "").toUpperCase() === String(previous.originIcao ?? "").toUpperCase() &&
      String(flight.destinationIcao ?? "").toUpperCase() === String(previous.destinationIcao ?? "").toUpperCase());
    if (newerActiveFlight || !matchingCompletedFlight) {
      await editOriginal(applicationId, interactionToken, { content: "The latest Infinite Flight aircraft log does not confirm this aircraft as parked after the completed leg. The schedule cannot be claimed right now.", components: [] });
      return;
    }
    const members = await ifRequest<any[]>(token, "/live/organizations/" + org.live_organization_id + "/members");
    if (!(members ?? []).some((member: any) => member.userId === profile.infinite_flight_user_id)) {
      await editOriginal(applicationId, interactionToken, { content: "Your linked Infinite Flight account is not currently a member of this Live organisation.", components: [] });
      return;
    }
    const crew = Array.isArray(schedule.crew) ? schedule.crew : [];
    if (crew.some((member: any) => member.userId === profile.infinite_flight_user_id)) {
      await editOriginal(applicationId, interactionToken, { content: "You are already assigned to this schedule.", components: [] });
      return;
    }
    if (crew.length >= 3) {
      await editOriginal(applicationId, interactionToken, { content: "This schedule already has its maximum of three crew members.", components: [] });
      return;
    }
    const { data: acquired, error: claimError } = await admin.rpc("acquire_live_schedule_claim", {
      p_organization_id: event.organization_id,
      p_schedule_id: scheduleId,
      p_aircraft_id: event.aircraft_id,
      p_pilot_user_id: profile.id,
      p_pilot_if_user_id: profile.infinite_flight_user_id,
      p_seat_role: seatRole,
      p_existing_crew_count: crew.length,
    });
    if (claimError || !acquired) {
      await editOriginal(applicationId, interactionToken, { content: "This schedule is full or another pilot has already claimed the available position.", components: [] });
      return;
    }
    claimId = String(acquired);
    const updatedSchedule = await ifRequest<any>(token,
      "/live/schedules/" + scheduleId + "/crew/" + profile.infinite_flight_user_id,
      { method: "PUT", body: JSON.stringify({ role: seatRole }) });
    await admin.from("live_schedule_claims").update({ status: "assigned", last_error_code: null, updated_at: new Date().toISOString() }).eq("id", claimId);
    await admin.from("audit_events").insert({
      organization_id: event.organization_id, actor_user_id: profile.id,
      event_type: "schedule.self_service_claimed", subject_id: claimId,
      metadata: { seat_role: seatRole },
    });
    const updatedCrew = Array.isArray(updatedSchedule?.crew) ? updatedSchedule.crew : [...crew, { userId: profile.infinite_flight_user_id, role: seatRole }];
    const crewText = updatedCrew.map((member: any) => safeDiscordText(member.username || member.userId, 60) +
      " · " + (Number(member.role) === 1 ? "First Officer" : "Captain")).join("\n").slice(0, 900) || "No crew assigned";
    const publicPayload = {
      content: "This schedule is open to eligible pilots until all crew positions are filled.",
      embeds: [{
        title: updatedCrew.length >= 3 ? "SCHEDULE · CREW FULL" : "SCHEDULE OPEN · SELF-SERVICE",
        description: "A pilot has been assigned directly through Infinite Flight. The crew list below reflects the latest Live schedule response.",
        color: updatedCrew.length >= 3 ? 5763719 : 5793266,
        fields: [
          { name: "Flight", value: safeDiscordText(updatedSchedule?.callsign ?? schedule.callsign, 32), inline: true },
          { name: "Route", value: safeDiscordText(updatedSchedule?.originIcao ?? schedule.originIcao, 8) + " → " + safeDiscordText(updatedSchedule?.destinationIcao ?? schedule.destinationIcao, 8), inline: true },
          { name: "Crew", value: crewText, inline: false },
          { name: "Capacity", value: updatedCrew.length + " / 3", inline: true },
        ],
        footer: { text: "VEYRO Live • Self-service assignment" },
        timestamp: new Date().toISOString(),
      }],
      components: updatedCrew.length >= 3 ? [] : [{
        type: 1,
        components: [{ type: 2, style: 1, label: "Assign", custom_id: "schedule-claim:" + scheduleId, emoji: { name: "🛫" } }],
      }],
      allowed_mentions: { parse: [] },
    };
    try { await editPublicMessage(settings.approval_channel_id, event.discord_message_id, publicPayload); }
    catch (messageError) { console.warn("[discord-interactions] public schedule card update failed", messageError instanceof Error ? messageError.message : "unknown"); }
    await editOriginal(applicationId, interactionToken, {
      content: "Successfully assigned to **" + (seatRole === 1 ? "First Officer" : "Captain") + "** in Infinite Flight. Your organisation's Live schedule has been updated.",
      components: [],
    });
  } catch (error) {
    if (claimId) await admin.from("live_schedule_claims").update({
      status: "failed",
      last_error_code: error instanceof IfApiRateLimitError ? "if_rate_limited" : "live_assignment_failed",
      updated_at: new Date().toISOString(),
    }).eq("id", claimId);
    const message = error instanceof IfApiRateLimitError
      ? "Infinite Flight's API rate limit was reached. Please wait " + error.retryAfterSeconds + " seconds and try again."
      : "The assignment could not be completed. No successful assignment was recorded; please retry or contact an organisation administrator.";
    console.error("[discord-interactions] schedule claim failed", error instanceof IfApiRateLimitError ? "if_rate_limited" : "claim_failed");
    try { await editOriginal(applicationId, interactionToken, { content: message, components: [] }); } catch { /* interaction token may have expired */ }
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail("Method not allowed", 405);
  const raw = await req.text();
  const signature = req.headers.get("x-signature-ed25519") ?? "";
  const timestamp = req.headers.get("x-signature-timestamp") ?? "";
  const publicKey = Deno.env.get("DISCORD_PUBLIC_KEY") ?? "";
  if (!signature || !timestamp || !publicKey) return fail("Invalid Discord signature", 401);
  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60_000) return fail("Expired Discord interaction", 401);
  if (!await verify(raw, signature, timestamp, publicKey)) return fail("Invalid Discord signature", 401);
  let interaction: any;
  try { interaction = JSON.parse(raw); } catch { return fail("Invalid interaction payload", 400); }
  if (interaction.type === 1) return json({ type: 1 });
  if (interaction.type !== 3) return json({ type: 4, data: { content: "Unsupported interaction.", flags: 64 } });
  const [action, requestId] = String(interaction.data?.custom_id ?? "").split(":");
  if (action === "schedule-claim" && requestId) {
    return json({ type: 4, data: {
      flags: 64,
      content: "Choose the crew position you want to claim. VEYRO will verify the live schedule and assign you directly.",
      components: [{
        type: 1,
        components: [{
          type: 3,
          custom_id: "schedule-role:" + requestId,
          placeholder: "Select Captain or First Officer",
          min_values: 1,
          max_values: 1,
          options: [
            { label: "Captain", value: "0", description: "Claim the Captain position" },
            { label: "First Officer", value: "1", description: "Claim the First Officer position" },
          ],
        }],
      }],
    } });
  }
  if (action === "schedule-role" && requestId) {
    const seatRole = Number(interaction.data?.values?.[0]);
    if (![0,1].includes(seatRole)) return json({ type: 4, data: { content: "Choose a valid crew position.", flags: 64 } });
    EdgeRuntime.waitUntil(processScheduleClaim(interaction, requestId, seatRole));
    return json({ type: 6 });
  }
  if (!["approve", "reject"].includes(action) || !requestId) return json({ type: 4, data: { content: "Invalid interaction action.", flags: 64 } });
  // Acknowledge the component within Discord's three-second deadline. All database
  // checks and Live synchronization run after the interaction has been accepted.
  EdgeRuntime.waitUntil(processDecision(interaction, action, requestId));
  return json({ type: 6 });
});
