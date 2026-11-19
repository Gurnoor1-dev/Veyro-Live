import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { json, fail } from "../_shared/http.ts";
import { getUserInfiniteFlightToken } from "../_shared/user-if-token.ts";
import { ifRequest, IfApiRateLimitError, reserveIfApiRequests } from "../_shared/infinite-flight.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const adminPortalCache = new Map<string, { expiresAt: number; value: any }>();
const discordBotToken = Deno.env.get("DISCORD_BOT_TOKEN") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return fail("Method not allowed", 405);
  const body = await req.json().catch(() => null);
  if (!body || typeof body.action !== "string") return fail("Invalid request", 400);

  if (body.action === "check_pilot_invite") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const slug = String(body.slug ?? "").trim().toLowerCase();
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !slug) return fail("Enter a valid email and organization.", 400);
    const authorization = req.headers.get("Authorization");
    if (!authorization) return fail("Sign in with the invited email first.", 401);
    const identity = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user: signedInUser } } = await identity.auth.getUser();
    if (!signedInUser?.email || signedInUser.email.toLowerCase() !== email) return fail("The signed-in email does not match this invitation.", 403);
    const { data: org } = await admin.from("organizations").select("id,slug,display_name").eq("slug", slug).eq("is_active", true).maybeSingle();
    if (!org) return fail("Organization not found.", 404);
    const { data: invite } = await admin.from("organization_pilot_invites").select("pilot_name,status").eq("organization_id", org.id).eq("email", email).in("status", ["invited", "accepted"]).maybeSingle();
    if (!invite) return fail("This email has not been invited by the organization administrator.", 403);
    return json({ allowed: true, pilotName: invite.pilot_name, organization: { slug: org.slug, displayName: org.display_name } });
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization) return fail("Unauthorized", 401);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return fail("Unauthorized", 401);
  if (body.action === "update_admin_profile") {
    const name = String(body.displayName ?? "").trim();
    const discordId = String(body.discordUserId ?? "").trim();
    if (name.length < 1 || name.length > 80) return fail("Enter a name between 1 and 80 characters.", 400);
    if (discordId && !/^\d{17,20}$/.test(discordId)) return fail("Enter a valid Discord user ID.", 400);
    const { error } = await admin.from("profiles").upsert({ id: user.id, display_name: name, discord_user_id: discordId || null }, { onConflict: "id" });
    if (error) return fail("Could not update your profile. The Discord ID may already be linked to another account.", 500);
    adminPortalCache.clear();
    return json({ displayName: name, discordUserId: discordId || null });
  }

  const requestedOrganizationId = String(body.organizationId ?? "");
  const slug = String(body.slug ?? "").trim().toLowerCase();
  if (!requestedOrganizationId && !slug) return fail("Missing organization identifier", 400);
  const orgQuery = admin.from("organizations")
    .select("id,slug,display_name,logo_url,tagline,description,website_url,discord_invite_url,live_organization_id,booking_mode,created_by")
    .eq("is_active", true);
  const { data: org, error: orgError } = requestedOrganizationId
    ? await orgQuery.eq("id", requestedOrganizationId).maybeSingle()
    : await orgQuery.eq("slug", slug).maybeSingle();
  if (orgError || !org) return fail("This organization portal could not be found or is inactive.", 404);
  const resolvedOrganizationId = org.id;
  const { data: membership } = await admin.from("organization_memberships")
    .select("role,is_active").eq("organization_id", resolvedOrganizationId).eq("user_id", user.id).maybeSingle();
  const databaseAdmin = Boolean((membership?.is_active && ["owner", "admin"].includes(membership.role)) || org.created_by === user.id);
  if (!databaseAdmin) return fail("Organization administrator access required.", 403);
  const organizationId = resolvedOrganizationId;
  if (body.action === "send_notification_test") {
    const notificationType = String(body.notificationType ?? "");
    const channelFields: Record<string, string> = {
      landing_dispatch: "landing_dispatch_channel_id",
      initial_schedule_open: "unassigned_legs_channel_id",
      schedule_revisor: "schedule_revisor_channel_id",
      activity_log: "activity_log_channel_id",
    };
    const field = channelFields[notificationType];
    if (!field) return fail("Choose a supported notification channel.", 400);
    const { data: settings, error: settingsError } = await admin.from("discord_settings")
      .select("guild_id,enabled,landing_dispatch_channel_id,unassigned_legs_channel_id,schedule_revisor_channel_id,activity_log_channel_id")
      .eq("organization_id", organizationId).maybeSingle();
    if (settingsError || !settings?.enabled) return fail("Discord integration is not enabled for this organisation.", 400);
    const channelId = String((settings as Record<string, unknown>)[field] ?? "");
    if (!/^\\d{17,20}$/.test(channelId)) return fail("Configure and save this notification channel before sending a test.", 400);
    if (!discordBotToken) return fail("Discord bot token is not configured on the server.", 503);
    const pilotId = "1477116751710912613";
    const route = "KJFK → LFPG";
    const aircraft = "IF-GNRT";
    const timestamp = new Date().toISOString();
    let payload: Record<string, unknown>;
    if (notificationType === "landing_dispatch") {
      payload = {
        content: "**Hilo** has landed at **KJFK**. You're on the next leg (**KJFK - LFPG**), <@" + pilotId + ">",
        embeds: [{ title: "NEXT LEG DISPATCH", color: 5793266, fields: [
          { name: "Next flight", value: "TEST", inline: true },
          { name: "Aircraft", value: aircraft, inline: true },
          { name: "Route", value: route, inline: true },
        ], footer: { text: "VEYRO Live • Automatic landing dispatch • TEST" }, timestamp }],
        allowed_mentions: { parse: [], users: [pilotId] },
      };
    } else if (notificationType === "initial_schedule_open" || notificationType === "schedule_revisor") {
      const initial = notificationType === "initial_schedule_open";
      payload = {
        content: "A scheduled leg is now open for eligible pilots to claim.",
        embeds: [{ title: "SCHEDULE OPEN · SELF-SERVICE", description: (initial
          ? "This is the aircraft's first scheduled leg and it has no assigned crew. Claim an available crew position below. Assignments are sent directly to Infinite Flight."
          : "The aircraft has remained on the ground for at least 12 hours. Claim an available crew position below. Assignments are sent directly to Infinite Flight.") + "\\n\\n**TEST MESSAGE** — sample only; no Live schedule will be changed.",
          color: 5793266, fields: [
            { name: "Flight", value: "TEST", inline: true },
            { name: "Aircraft", value: aircraft, inline: true },
            { name: "Route", value: route, inline: true },
            { name: "Departure", value: "Not scheduled", inline: true },
            { name: "Arrival", value: "Not scheduled", inline: true },
            { name: "Current crew", value: "0 / 3", inline: true },
          ], footer: { text: "VEYRO Live • Choose Assign to select Captain or First Officer • TEST" }, timestamp }],
        components: [{ type: 1, components: [{ type: 2, style: 1, label: "Assign", custom_id: "test-notification-disabled", emoji: { name: "🛫" }, disabled: true }] }],
        allowed_mentions: { parse: [] },
      };
    } else {
      payload = {
        content: "",
        embeds: [{ title: "ORGANISATION ACTIVITY", color: 5793266, description: "This is a test of the organisation activity notification destination.",
          fields: [
            { name: "Event", value: "Notification test", inline: true },
            { name: "Pilot", value: "<@" + pilotId + ">", inline: true },
            { name: "Leg", value: route, inline: true },
            { name: "Aircraft", value: aircraft, inline: true },
            { name: "Previous pilot", value: "Hilo", inline: true },
          ], footer: { text: "VEYRO Live • Organisation activity • TEST" }, timestamp }],
        allowed_mentions: { parse: [], users: [pilotId] },
      };
    }
    const response = await fetch("https://discord.com/api/v10/channels/" + channelId + "/messages", {
      method: "POST",
      headers: { Authorization: "Bot " + discordBotToken, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const message = await response.json().catch(() => null);
    if (!response.ok || !message?.id) {
      console.warn("[organization-admin] Discord test delivery failed", response.status);
      return fail(response.status === 403 ? "The bot cannot send messages in this channel. Check View Channel and Send Messages permissions." :
        response.status === 404 ? "The configured channel was not found or is not accessible to the bot." : "Discord rejected the test message (HTTP " + response.status + ").", 502);
    }
    await admin.from("audit_events").insert({ organization_id: organizationId, actor_user_id: user.id,
      event_type: "discord.notification_test_sent", metadata: { notificationType, channelId, messageId: String(message.id) } });
    return json({ ok: true, channelId, messageId: String(message.id) });
  }
  const portalCacheKey = organizationId + ":" + user.id;
  if (body.action === "get_admin_portal") {
    const cachedPortal = adminPortalCache.get(portalCacheKey);
    if (cachedPortal && cachedPortal.expiresAt > Date.now()) return json(cachedPortal.value);
  }

  // Start the dashboard's independent database reads while the IF token and role are being verified.
  const adminReadsPromise = body.action === "get_admin_portal"
    ? Promise.all([
        admin.from("organization_memberships").select("user_id,role,is_active,created_at").eq("organization_id", organizationId).order("created_at"),
        admin.from("organization_pilot_invites").select("id,email,pilot_name,status,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }),
        admin.from("discord_settings").select("guild_id,approval_channel_id,allowed_approver_role_ids,landing_dispatch_channel_id,unassigned_legs_channel_id,schedule_revisor_channel_id,activity_log_channel_id,enabled").eq("organization_id", organizationId).maybeSingle(),
        admin.from("profiles").select("display_name,discord_user_id").eq("id", user.id).maybeSingle(),
        admin.from("schedule_simbrief_xml").select("schedule_id,file_name,updated_at").eq("organization_id", organizationId),
        admin.from("booking_requests").select("id,pilot_user_id,pilot_if_user_id,live_schedule_id,live_aircraft_id,status,seat_role,reference_code,discord_message_id,created_at,reviewed_at,reviewed_by").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(30),
      ])
    : null;

  let userToken: string;
  let userScopes: string[];
  let liveOrganization: { id: string; name?: string; role: number } | undefined;
  try {
    const connection = await getUserInfiniteFlightToken(user.id);
    userToken = connection.token;
    userScopes = connection.scopes;
    await reserveIfApiRequests(1);
    const liveOrganizations = await ifRequest<Array<{id:string;name?:string;role:number}>>(userToken, "/live/organizations", {}, undefined, false, true);
    liveOrganization = liveOrganizations.find((item) => item.id === org.live_organization_id);
    if (!liveOrganization || ![1,2].includes(liveOrganization.role)) {
      return fail("Your connected Infinite Flight account is not an Admin or Owner of this Live organization.", 403);
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not verify your Infinite Flight administrator access.", 401);
  }

  if (body.action !== "get_admin_portal") adminPortalCache.clear();
  try {
    if (body.action === "get_admin_portal") {
      const [membersResult, invitesResult, discordResult, profileResult, simbriefResult, bookingsResult] = await adminReadsPromise!;
      const memberIds = (membersResult.data ?? []).map((m) => m.user_id);
      const profileIds = [...new Set([...memberIds, ...(bookingsResult.data ?? []).flatMap((b: any) => [b.pilot_user_id, b.reviewed_by]).filter(Boolean)])];
      const token = userToken;
      await reserveIfApiRequests(3);
      const [profilesResult, liveData] = await Promise.all([
        profileIds.length ? admin.from("profiles").select("id,display_name,discord_user_id").in("id", profileIds) : Promise.resolve({ data: [] }),
        Promise.all([
          ifRequest<Array<Record<string, unknown>>>(token, "/live/organizations/" + org.live_organization_id + "/aircraft", {}, undefined, false, true),
          ifRequest<Array<Record<string, unknown>>>(token, "/live/organizations/" + org.live_organization_id + "/schedules", {}, undefined, false, true),
          ifRequest<Array<{ userId: string; username?: string }>>(token, "/live/organizations/" + org.live_organization_id + "/members", {}, undefined, false, true),
        ]),
      ]);
      const profileMap = new Map((profilesResult.data ?? []).map((p: any) => [p.id, { display_name: p.display_name, discord_user_id: p.discord_user_id }]));
      const [aircraft, schedules, liveMembers] = liveData;
      const portalPayload = {
        organization: org,
        adminProfile: profileResult.data ?? null,
        members: (membersResult.data ?? []).map((m) => ({ ...m, display_name: profileMap.get(m.user_id)?.display_name ?? null })),
        bookingRequests: (bookingsResult.data ?? []).map((b: any) => { const liveSchedule = schedules.find((schedule: any) => schedule.id === b.live_schedule_id); return { ...b, flight_number: liveSchedule?.callsign ?? "Flight leg", origin_icao: liveSchedule?.originIcao ?? "", destination_icao: liveSchedule?.destinationIcao ?? "", pilot_display_name: profileMap.get(b.pilot_user_id)?.display_name ?? null, reviewer_display_name: b.reviewed_by ? profileMap.get(b.reviewed_by)?.display_name ?? null : null }; }),
        invites: invitesResult.data ?? [],
        discord: discordResult.data ?? null,
        simbriefPlans: simbriefResult.data ?? [],
        aircraft, schedules, liveMembers
      };
      adminPortalCache.set(portalCacheKey, { expiresAt: Date.now() + 15_000, value: portalPayload });
      return json(portalPayload);
    }

    if (body.action === "update_profile") {
      const patch: Record<string, unknown> = {};
      for (const key of ["display_name", "logo_url", "tagline", "description", "website_url", "discord_invite_url"]) {
        if (key in body) patch[key] = body[key] === "" ? null : body[key];
      }
      if (!Object.keys(patch).length) return fail("No profile fields supplied.", 400);
      const { data, error } = await admin.from("organizations").update(patch).eq("id", organizationId)
        .select("id,slug,display_name,logo_url,tagline,description,website_url,discord_invite_url").single();
      if (error) return fail("Could not update organization profile.", 500);
      await admin.from("audit_events").insert({ organization_id: organizationId, actor_user_id: user.id, event_type: "organization.profile_updated" });
      return json({ organization: data });
    }

    if (body.action === "invite_pilot") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const pilotName = String(body.pilotName ?? "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || pilotName.length < 1 || pilotName.length > 80) return fail("Enter a valid pilot name and email.", 400);
      const { data, error } = await admin.from("organization_pilot_invites").upsert({
        organization_id: organizationId, email, pilot_name: pilotName, status: "invited", invited_by: user.id,
        accepted_user_id: null, accepted_at: null
      }, { onConflict: "organization_id,email" }).select("id,email,pilot_name,status").single();
      if (error) return fail("Could not create the pilot invitation.", 500);
      await admin.from("audit_events").insert({ organization_id: organizationId, actor_user_id: user.id, event_type: "pilot.invited", subject_id: data.id });
      return json({ invite: data });
    }

    if (body.action === "revoke_pilot_invite") {
      const { error } = await admin.from("organization_pilot_invites").update({ status: "revoked" })
        .eq("organization_id", organizationId).eq("id", body.inviteId).eq("status", "invited");
      if (error) return fail("Could not revoke invitation.", 500);
      return json({ ok: true });
    }

    if (body.action === "set_pilot_active") {
      const targetUserId = String(body.userId ?? "");
      if (!targetUserId || typeof body.isActive !== "boolean") return fail("Invalid pilot membership update.", 400);
      const { data: target } = await admin.from("organization_memberships").select("role").eq("organization_id", organizationId).eq("user_id", targetUserId).maybeSingle();
      if (!target || target.role !== "pilot") return fail("Only pilot memberships can be changed here.", 403);
      const { error } = await admin.from("organization_memberships").update({ is_active: body.isActive }).eq("organization_id", organizationId).eq("user_id", targetUserId);
      if (error) return fail("Could not update pilot access.", 500);
      await admin.from("audit_events").insert({ organization_id: organizationId, actor_user_id: user.id, event_type: body.isActive ? "pilot.reactivated" : "pilot.deactivated", subject_id: targetUserId });
      return json({ ok: true, isActive: body.isActive });
    }

    if (body.action === "set_booking_mode") {
      const mode = body.mode === "preapproved" ? "preapproved" : body.mode === "manual" ? "manual" : null;
      if (!mode) return fail("Invalid booking mode.", 400);
      const { error } = await admin.from("organizations").update({ booking_mode: mode }).eq("id", organizationId);
      if (error) return fail("Could not update booking mode.", 500);
      await admin.from("audit_events").insert({ organization_id: organizationId, actor_user_id: user.id, event_type: "organization.booking_mode_changed", metadata: { mode } });
      return json({ bookingMode: mode });
    }

    if (body.action === "save_discord") {
      const guildId = String(body.guildId ?? "").trim();
      const channelId = String(body.channelId ?? "").trim();
      const roles = Array.isArray(body.roleIds) ? body.roleIds.map((v: unknown) => String(v).trim()).filter(Boolean).slice(0, 30) : [];
      const channelFields = {
        landing_dispatch_channel_id: String(body.landingDispatchChannelId ?? "").trim() || null,
        unassigned_legs_channel_id: String(body.unassignedLegsChannelId ?? "").trim() || null,
        schedule_revisor_channel_id: String(body.scheduleRevisorChannelId ?? "").trim() || null,
        activity_log_channel_id: String(body.activityLogChannelId ?? "").trim() || null,
      };
      if (!/^\d{17,20}$/.test(guildId) || !/^\d{17,20}$/.test(channelId)) return fail("Enter valid Discord server and booking approvals channel IDs.", 400);
      if (roles.some((role) => !/^\d{17,20}$/.test(role))) return fail("Every approver role must be a valid Discord role ID.", 400);
      if (Object.values(channelFields).some((id) => id !== null && !/^\d{17,20}$/.test(id))) return fail("Every notification destination must be a valid Discord channel ID, or left blank.", 400);
      const { error } = await admin.from("discord_settings").upsert({
        organization_id: organizationId, guild_id: guildId, approval_channel_id: channelId,
        allowed_approver_role_ids: roles, ...channelFields, enabled: true, updated_at: new Date().toISOString()
      }, { onConflict: "organization_id" });
      if (error) return fail("Could not save Discord and notification settings.", 500);
      await admin.from("audit_events").insert({ organization_id: organizationId, actor_user_id: user.id, event_type: "organization.discord_settings_updated" });
      return json({ ok: true });
    }

    if (body.action === "create_schedule" || body.action === "update_schedule" || body.action === "delete_schedule" || body.action === "update_flightplan" || body.action === "reorder_schedule" || body.action === "assign_schedule_crew" || body.action === "remove_schedule_crew") {
      const token = userToken;
      if (!userScopes.includes("live:schedules.write")) return fail("Reconnect Infinite Flight from My Veyro and approve the live:schedules.write permission.", 403);
      const scheduleId = String(body.scheduleId ?? "");
      let result: unknown;
      if (body.action === "assign_schedule_crew" || body.action === "remove_schedule_crew") {
        const userId = String(body.userId ?? "");
        if (!scheduleId || !userId) return fail("Choose a schedule and Infinite Flight crew member.", 400);
        if (body.action === "assign_schedule_crew") {
          const role = Number(body.role);
          if (![0, 1].includes(role)) return fail("Choose Captain or First Officer.", 400);
          result = await ifRequest(token, "/live/schedules/" + scheduleId + "/crew/" + userId, { method: "PUT", body: JSON.stringify({ role }) });
        } else {
          result = await ifRequest(token, "/live/schedules/" + scheduleId + "/crew/" + userId, { method: "DELETE" });
        }
      } else if (body.action === "reorder_schedule") {
        const aircraftId = String(body.aircraftId ?? "");
        if (!aircraftId || !scheduleId) return fail("Select an aircraft and schedule.", 400);
        result = await ifRequest(token, "/live/aircraft/" + aircraftId + "/schedules/reorder", { method: "PUT", body: JSON.stringify({ scheduleId, afterId: body.afterId ?? null }) });
      } else if (body.action === "create_schedule") {
        const aircraftId = String(body.aircraftId ?? "");
        if (!aircraftId) return fail("Select an aircraft.", 400);
        result = await ifRequest(token, "/live/aircraft/" + aircraftId + "/schedules", { method: "POST", body: JSON.stringify(body.schedule ?? {}) });
      } else if (body.action === "update_schedule") {
        if (!scheduleId) return fail("Missing schedule ID.", 400);
        result = await ifRequest(token, "/live/schedules/" + scheduleId, { method: "PUT", body: JSON.stringify(body.schedule ?? {}) });
      } else if (body.action === "delete_schedule") {
        if (!scheduleId) return fail("Missing schedule ID.", 400);
        result = await ifRequest(token, "/live/schedules/" + scheduleId, { method: "DELETE" });
      } else {
        if (!scheduleId) return fail("Missing schedule ID.", 400);
        result = await ifRequest(token, "/live/schedules/" + scheduleId + "/flightplan", { method: "PUT", body: JSON.stringify({ flightPlan: body.flightPlan ?? null }) });
      }
      const resolvedScheduleId = scheduleId || String((result as any)?.id ?? (result as any)?.schedule?.id ?? (result as any)?.data?.id ?? "");
      if (body.action === "delete_schedule" && scheduleId) {
        await admin.from("schedule_simbrief_xml").delete().eq("organization_id", organizationId).eq("schedule_id", scheduleId);
      }
      if (typeof body.simbriefXml === "string" && body.simbriefXml.trim()) {
        if (body.simbriefXml.length > 1500000) return fail("SimBrief XML must be smaller than 1.5 MB.", 413);
        if (!resolvedScheduleId) return fail("The Live schedule was saved, but its ID could not be resolved for the SimBrief attachment. Refresh schedules and attach the XML while editing.", 502);
        const { error: xmlError } = await admin.from("schedule_simbrief_xml").upsert({
          organization_id: organizationId, schedule_id: resolvedScheduleId,
          file_name: String(body.simbriefFileName ?? "simbrief.xml").slice(0, 180),
          xml_content: body.simbriefXml, uploaded_by: user.id, updated_at: new Date().toISOString(),
        }, { onConflict: "organization_id,schedule_id" });
        if (xmlError) throw new Error("Schedule saved, but the SimBrief XML attachment could not be stored.");
      }
      await admin.from("audit_events").insert({ organization_id: organizationId, actor_user_id: user.id, event_type: "schedule." + body.action, metadata: { scheduleId: resolvedScheduleId || null, simbriefAttached: typeof body.simbriefXml === "string" && !!body.simbriefXml } });
      return json({ result, scheduleId: resolvedScheduleId || null });
    }

    return fail("Unsupported organization administration action.", 400);
  } catch (error) {
    if (error instanceof IfApiRateLimitError) return fail(error.message, 429, { "Retry-After": String(error.retryAfterSeconds) });
    console.error("[organization-admin] action failed", error);
    return fail(error instanceof Error ? error.message : "Organization administration failed.", 502);
  }
});
