import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { json, fail } from "../_shared/http.ts";
import { getOrganizationAccessToken } from "../_shared/org-token.ts";
import { ifRequest, IfApiRateLimitError } from "../_shared/infinite-flight.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

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
    const { data: org } = await admin.from("organizations").select("id,slug,display_name").eq("slug", slug).eq("is_active", true).single();
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
    if (name.length < 1 || name.length > 80) return fail("Enter a name between 1 and 80 characters.", 400);
    const { error } = await admin.from("profiles").upsert({ id: user.id, display_name: name }, { onConflict: "id" });
    if (error) return fail("Could not update your profile.", 500);
    return json({ displayName: name });
  }

  const organizationId = String(body.organizationId ?? "");
  if (!organizationId) return fail("Missing organization ID", 400);
  const { data: membership } = await admin.from("organization_memberships")
    .select("role,is_active").eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (!membership?.is_active || !["owner", "admin"].includes(membership.role)) return fail("Organization administrator access required.", 403);
  const { data: org, error: orgError } = await admin.from("organizations")
    .select("id,slug,display_name,logo_url,tagline,description,website_url,discord_invite_url,live_organization_id,booking_mode")
    .eq("id", organizationId).eq("is_active", true).single();
  if (orgError || !org) return fail("Organization not found.", 404);

  try {
    if (body.action === "get_admin_portal") {
      const [membersResult, invitesResult, discordResult, profileResult] = await Promise.all([
        admin.from("organization_memberships").select("user_id,role,is_active,created_at").eq("organization_id", organizationId).order("created_at"),
        admin.from("organization_pilot_invites").select("id,email,pilot_name,status,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }),
        admin.from("discord_settings").select("guild_id,approval_channel_id,allowed_approver_role_ids,enabled").eq("organization_id", organizationId).maybeSingle(),
        admin.from("profiles").select("display_name,discord_user_id").eq("id", user.id).maybeSingle()
      ]);
      const memberIds = (membersResult.data ?? []).map((m) => m.user_id);
      const profilesResult = memberIds.length ? await admin.from("profiles").select("id,display_name").in("id", memberIds) : { data: [] };
      const profileMap = new Map((profilesResult.data ?? []).map((p) => [p.id, p.display_name]));
      const token = await getOrganizationAccessToken(organizationId);
      const [aircraft, schedules] = await Promise.all([
        ifRequest<Array<Record<string, unknown>>>(token, "/live/organizations/" + org.live_organization_id + "/aircraft"),
        ifRequest<Array<Record<string, unknown>>>(token, "/live/organizations/" + org.live_organization_id + "/schedules")
      ]);
      return json({
        organization: org,
        adminProfile: profileResult.data ?? null,
        members: (membersResult.data ?? []).map((m) => ({ ...m, display_name: profileMap.get(m.user_id) ?? null })),
        invites: invitesResult.data ?? [],
        discord: discordResult.data ?? null,
        aircraft, schedules
      });
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
      if (!/^\d{17,20}$/.test(guildId) || !/^\d{17,20}$/.test(channelId)) return fail("Enter valid Discord server and channel IDs.", 400);
      const { error } = await admin.from("discord_settings").upsert({
        organization_id: organizationId, guild_id: guildId, approval_channel_id: channelId,
        allowed_approver_role_ids: roles, enabled: true, updated_at: new Date().toISOString()
      }, { onConflict: "organization_id" });
      if (error) return fail("Could not save Discord settings.", 500);
      return json({ ok: true });
    }

    if (body.action === "create_schedule" || body.action === "update_schedule" || body.action === "delete_schedule" || body.action === "update_flightplan") {
      const token = await getOrganizationAccessToken(organizationId);
      const connection = await admin.from("if_connections").select("granted_scopes,live_role").eq("organization_id", organizationId).single();
      if (!connection.data || ![1,2].includes(connection.data.live_role) || !connection.data.granted_scopes?.includes("live:schedules.write")) return fail("Reconnect Infinite Flight as an organization Owner/Admin and approve live:schedules.write.", 403);
      const scheduleId = String(body.scheduleId ?? "");
      let result: unknown;
      if (body.action === "create_schedule") {
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
      await admin.from("audit_events").insert({ organization_id: organizationId, actor_user_id: user.id, event_type: "schedule." + body.action, metadata: { scheduleId: scheduleId || null } });
      return json({ result });
    }

    return fail("Unsupported organization administration action.", 400);
  } catch (error) {
    if (error instanceof IfApiRateLimitError) return fail(error.message, 429, { "Retry-After": String(error.retryAfterSeconds) });
    console.error("[organization-admin] action failed", error);
    return fail(error instanceof Error ? error.message : "Organization administration failed.", 502);
  }
});
