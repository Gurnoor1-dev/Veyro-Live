import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { json, fail } from "../_shared/http.ts";
import { decryptSecret, encryptSecret } from "../_shared/crypto.ts";
import { ifRequest, IfApiRateLimitError, refreshAuthorizationToken } from "../_shared/infinite-flight.ts";

const pilotCache = new Map<string, { expiresAt: number; value: any }>();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return fail("Method not allowed", 405);
  const auth = req.headers.get("Authorization");
  if (!auth) return fail("Unauthorized", 401);
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.organizationId || typeof body.organizationId !== "string") return fail("Missing Live organization ID", 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const cacheKey = user.id + ":" + body.organizationId;
  if (!body.pendingId) {
    const cached = pilotCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      // The cache contains data fetched only after this user's Live membership was
      // verified. Keep it short-lived and in memory; do not persist API membership data.
      return json(cached.value);
    }
  }
  try {
    let token: string;
    let refreshCiphertext: string | null = null;
    let expiry: string | null = null;
    let scopes: string[] = [];

    if (body.pendingId) {
      const { data: pending } = await admin.from("oauth_pending_connections").select("*")
        .eq("id", body.pendingId).eq("user_id", user.id).single();
      if (!pending || new Date(pending.expires_at).getTime() < Date.now()) return fail("Infinite Flight authorization expired. Please reconnect.", 410);
      token = await decryptSecret(pending.access_token_ciphertext);
      refreshCiphertext = pending.refresh_token_ciphertext;
      expiry = pending.access_token_expires_at;
      scopes = pending.granted_scopes ?? [];
    } else {
      const { data: connection } = await admin.from("user_if_connections").select("*").eq("user_id", user.id).single();
      if (!connection) return fail("Connect Infinite Flight to open your pilot dashboard.", 401);
      scopes = connection.granted_scopes ?? [];
      refreshCiphertext = connection.refresh_token_ciphertext;
      expiry = connection.token_expires_at;
      const expiresAt = expiry ? new Date(expiry).getTime() : 0;
      if (expiresAt > Date.now() + 90_000) token = await decryptSecret(connection.access_token_ciphertext);
      else {
        if (!refreshCiphertext) return fail("Your Infinite Flight session expired. Reconnect your account.", 401);
        const refreshed = await refreshAuthorizationToken(await decryptSecret(refreshCiphertext));
        token = refreshed.access_token as string;
        expiry = new Date(Date.now() + Number(refreshed.expires_in ?? 1800) * 1000).toISOString();
        refreshCiphertext = refreshed.refresh_token ? await encryptSecret(refreshed.refresh_token as string) : refreshCiphertext;
        const { error } = await admin.from("user_if_connections").update({
          access_token_ciphertext: await encryptSecret(token),
          refresh_token_ciphertext: refreshCiphertext,
          token_expires_at: expiry,
        }).eq("user_id", user.id);
        if (error) return fail("Could not refresh your Infinite Flight connection.", 500);
      }
    }

    const required = ["live:organizations.read", "live:members.read", "live:aircraft.read", "live:schedules.read"];
    const missing = required.filter((scope) => !scopes.includes(scope));
    if (missing.length) return fail("Reconnect Infinite Flight and approve these scopes: " + missing.join(", "), 403);

    const organizations = await ifRequest<Array<{ id: string; name: string; role: number }>>(token, "/live/organizations");
    const organization = organizations.find((item) => item.id === body.organizationId);
    if (!organization) return fail("Your Infinite Flight account is not a member of this organization.", 403);
    // Infinite Flight's OAuth user-info endpoint is served by the auth v2 connect API.
    // Do not depend on an issuer discovery document at the root auth hostname.
    const userInfoResponse = await fetch("https://api.infiniteflight.com/auth/v2/connect/userinfo", {
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    });
    if (!userInfoResponse.ok) {
      console.error("[pilot-live-data] Infinite Flight userinfo failed", { status: userInfoResponse.status });
      throw new Error(userInfoResponse.status === 401
        ? "Your Infinite Flight session expired. Reconnect and try again."
        : "Infinite Flight could not verify your account profile (HTTP " + userInfoResponse.status + ").");
    }
    const userInfo = await userInfoResponse.json();
    const members = await ifRequest<Array<{ userId: string; username?: string | null; role?: number; activeLifts?: number; joinedAt?: string }>>(token, "/live/organizations/" + organization.id + "/members");
    const subject = String(userInfo.sub ?? "");
    const username = String(userInfo.preferred_username ?? userInfo.username ?? userInfo.name ?? "").toLowerCase();
    const matchedMember = members.find((member) => (subject && member.userId === subject) || (username && String(member.username ?? "").toLowerCase() === username));
    if (!matchedMember) return fail("Could not match your Infinite Flight identity to a member of this organization.", 403);
    const ifUserId = matchedMember.userId;
    const { data: portal } = await admin.from("organizations").select("id,slug").eq("live_organization_id", organization.id).eq("is_active", true).single();
    if (!portal || !user.email) return fail("This organization does not have a Veyro pilot portal.", 404);
    const { data: invite } = await admin.from("organization_pilot_invites").select("id,pilot_name,status,accepted_user_id").eq("organization_id", portal.id).ilike("email", user.email.toLowerCase()).in("status", ["invited", "accepted"]).maybeSingle();
    const { data: existingMembership } = await admin.from("organization_memberships").select("role,is_active").eq("organization_id", portal.id).eq("user_id", user.id).maybeSingle();
    if (existingMembership && !existingMembership.is_active) return fail("Your pilot access has been disabled by the organization administrator.", 403);
    const hasLiveAdminAccess = organization.role === 1 || organization.role === 2;
    if (!invite && !existingMembership && !hasLiveAdminAccess) {
      return fail("Your email has not been invited by this organization. Ask an administrator to add you.", 403);
    }
    if (invite?.status === "accepted" && invite.accepted_user_id !== user.id) {
      return fail("This pilot invitation has already been used by another account.", 403);
    }
    // Only create Veyro membership records when the airline has invited this
    // account. Infinite Flight roles/membership data stay in the short-lived API
    // response and are not copied into Veyro tables.
    if (!existingMembership && invite) {
      const { error: memberError } = await admin.from("organization_memberships").insert({
        organization_id: portal.id, user_id: user.id, role: "pilot", is_active: true,
      });
      if (memberError) return fail("Could not activate your pilot membership.", 500);
    }
    if (invite && invite.status === "invited") {
      const { error: inviteError } = await admin.from("organization_pilot_invites").update({
        status: "accepted", accepted_user_id: user.id, accepted_at: new Date().toISOString(),
      }).eq("id", invite.id);
      if (inviteError) return fail("Your pilot invitation could not be accepted. Please retry.", 500);
    }
    // Infinite Flight API data must not be persisted; keep only Veyro-owned profile details.
    const { error: profileError } = await admin.from("profiles").upsert({
      id: user.id,
      display_name: invite?.pilot_name ?? user.user_metadata?.name ?? user.email.split("@")[0],
    }, { onConflict: "id" });
    if (profileError) return fail("Could not save your Veyro pilot profile.", 500);

    if (body.pendingId) {
      const { error } = await admin.from("user_if_connections").upsert({
        user_id: user.id,
        access_token_ciphertext: await encryptSecret(token),
        refresh_token_ciphertext: refreshCiphertext,
        token_expires_at: expiry,
        granted_scopes: scopes,
      }, { onConflict: "user_id" });
      if (error) return fail("Could not securely save your pilot connection.", 500);
    }

    const [aircraft, schedules] = await Promise.all([
      ifRequest(token, "/live/organizations/" + organization.id + "/aircraft"),
      ifRequest(token, "/live/organizations/" + organization.id + "/schedules"),
    ]);
    const payload = { organization, aircraft, schedules, members, role: organization.role, portal: { id: portal.id, slug: portal.slug }, portalId: portal.id, pilotId: user.id, mode: "pilot-portal" };
    pilotCache.set(cacheKey, { expiresAt: Date.now() + 30_000, value: payload });
    return json(payload);
  } catch (error) {
    console.error("[pilot-live-data] failed", error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error));
    if (error instanceof IfApiRateLimitError) return fail(error.message, 429, { "Retry-After": String(error.retryAfterSeconds) });
    return fail(error instanceof Error ? error.message : "Could not load this organization's Live data.", 502);
  }
});
