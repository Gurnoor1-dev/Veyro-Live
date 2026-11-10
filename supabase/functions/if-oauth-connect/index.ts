import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { json, fail } from "../_shared/http.ts";
import { decryptSecret } from "../_shared/crypto.ts";
import { ifRequest } from "../_shared/infinite-flight.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return fail("Method not allowed", 405);
  const auth = req.headers.get("Authorization");
  if (!auth) return fail("Unauthorized", 401);
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.pendingId || !body?.liveOrganizationId || !body?.slug || !body?.displayName) return fail("Missing organization setup fields");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(body.slug) || String(body.displayName).trim().length < 2) return fail("Invalid organization name or URL slug");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: pending } = await admin.from("oauth_pending_connections").select("*").eq("id", body.pendingId).eq("user_id", user.id).single();
  if (!pending || new Date(pending.expires_at).getTime() < Date.now()) return fail("Authorization expired. Please reconnect.", 410);
  if (!pending.granted_scopes.includes("live:schedules.write")) return fail("Reconnect and grant schedule write permission.", 403);
  try {
    const token = await decryptSecret(pending.access_token_ciphertext);
    const orgs = await ifRequest<Array<{ id: string; role: number }>>(token, "/live/organizations");
    const selected = orgs.find((org) => org.id === body.liveOrganizationId);
    if (!selected || ![1, 2].includes(selected.role)) return fail("You must be an Infinite Flight organization Owner or Admin.", 403);
    const { data: org, error: orgError } = await admin.from("organizations").insert({
      slug: body.slug,
      display_name: String(body.displayName).trim().slice(0, 80),
      live_organization_id: selected.id,
      created_by: user.id,
    }).select("id,slug,display_name").single();
    if (orgError) return fail(orgError.code === "23505" ? "This organization or portal slug is already connected." : "Could not create organization.", 409);
    await admin.from("profiles").upsert({ id: user.id, display_name: user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Pilot" }, { onConflict: "id", ignoreDuplicates: true });
    const { error: memberError } = await admin.from("organization_memberships").insert({ organization_id: org.id, user_id: user.id, role: "owner" });
    if (memberError) throw memberError;
    const { error: connectionError } = await admin.from("if_connections").insert({
      organization_id: org.id,
      connected_by: user.id,
      access_token_ciphertext: pending.access_token_ciphertext,
      refresh_token_ciphertext: pending.refresh_token_ciphertext,
      token_expires_at: pending.access_token_expires_at,
      granted_scopes: pending.granted_scopes,
      live_role: selected.role,
    });
    if (connectionError) throw connectionError;
    await admin.from("oauth_pending_connections").delete().eq("id", pending.id);
    return json({ organization: org });
  } catch { return fail("Organization connection failed. No Live data was saved.", 502); }
});
