import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { json, fail } from "../_shared/http.ts";
import { decryptSecret, encryptSecret } from "../_shared/crypto.ts";
import { ifRequest, IfApiRateLimitError, refreshAuthorizationToken } from "../_shared/infinite-flight.ts";

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

    const required = ["live:organizations.read", "live:aircraft.read", "live:schedules.read"];
    const missing = required.filter((scope) => !scopes.includes(scope));
    if (missing.length) return fail("Reconnect Infinite Flight and approve these scopes: " + missing.join(", "), 403);

    const organizations = await ifRequest<Array<{ id: string; name: string; role: number }>>(token, "/live/organizations");
    const organization = organizations.find((item) => item.id === body.organizationId);
    if (!organization) return fail("Your Infinite Flight account is not a member of this organization.", 403);

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
    return json({ organization, aircraft, schedules, role: organization.role, mode: "pilot-read-only" });
  } catch (error) {
    if (error instanceof IfApiRateLimitError) return fail(error.message, 429, { "Retry-After": String(error.retryAfterSeconds) });
    return fail("Could not load this organization's Live data. Check your approved scopes and try again.", 502);
  }
});
