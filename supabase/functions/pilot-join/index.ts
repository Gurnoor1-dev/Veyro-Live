import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { json, fail } from "../_shared/http.ts";
import { decryptSecret } from "../_shared/crypto.ts";
import { ifRequest, IfApiRateLimitError } from "../_shared/infinite-flight.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return fail("Method not allowed", 405);
  const auth = req.headers.get("Authorization");
  if (!auth) return fail("Unauthorized", 401);

  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return fail("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.pendingId || !body?.liveOrganizationId) return fail("Missing organization selection", 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: pending } = await admin.from("oauth_pending_connections").select("*").eq("id", body.pendingId).eq("user_id", user.id).single();
  if (!pending || new Date(pending.expires_at).getTime() < Date.now()) return fail("Authorization expired. Please reconnect Infinite Flight.", 410);

  try {
    const token = await decryptSecret(pending.access_token_ciphertext);
    const liveOrganizations = await ifRequest<Array<{ id: string; name?: string; role: number }>>(token, "/live/organizations");
    const liveOrganization = liveOrganizations.find((item) => item.id === body.liveOrganizationId);
    if (!liveOrganization) return fail("Your Infinite Flight account is not a member of this organization.", 403);

    const { data: organization } = await admin.from("organizations")
      .select("id,slug,display_name,live_organization_id")
      .eq("live_organization_id", liveOrganization.id)
      .eq("is_active", true)
      .single();
    if (!organization) return fail("This VA has not connected a Veyro portal yet. Ask its owner to onboard the organization.", 404);

    const { error: membershipError } = await admin.from("organization_memberships").upsert({
      organization_id: organization.id,
      user_id: user.id,
      role: "pilot",
      is_active: true,
    }, { onConflict: "organization_id,user_id", ignoreDuplicates: true });
    if (membershipError) return fail("Could not add your pilot membership. Contact the VA administrator.", 500);

    await admin.from("profiles").upsert({
      id: user.id,
      display_name: user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Pilot",
    }, { onConflict: "id", ignoreDuplicates: true });

    await admin.from("audit_events").insert({
      organization_id: organization.id,
      actor_user_id: user.id,
      event_type: "membership.pilot_joined",
      metadata: { source: "infinite_flight_oauth" },
    });

    return json({ organization: { id: organization.id, slug: organization.slug, displayName: organization.display_name }, role: "pilot" });
  } catch (error) {
    if (error instanceof IfApiRateLimitError) return fail(error.message, 429, { "Retry-After": String(error.retryAfterSeconds) });
    return fail("Could not verify your Infinite Flight membership.", 502);
  }
});
