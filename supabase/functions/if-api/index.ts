import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { json, fail } from "../_shared/http.ts";
import { getOrganizationAccessToken } from "../_shared/org-token.ts";
import { ifRequest } from "../_shared/infinite-flight.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return fail("Method not allowed", 405);
  const auth = req.headers.get("Authorization");
  if (!auth) return fail("Unauthorized", 401);
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.organizationSlug || !["organization", "aircraft", "schedules"].includes(body.action)) return fail("Invalid request");
  const { data: org } = await userClient.from("organizations").select("id,live_organization_id").eq("slug", body.organizationSlug).eq("is_active", true).single();
  if (!org) return fail("Organization not found", 404);
  const { data: member } = await userClient.from("organization_memberships").select("user_id").eq("organization_id", org.id).eq("user_id", user.id).eq("is_active", true).single();
  if (!member) return fail("Forbidden", 403);
  try {
    const token = await getOrganizationAccessToken(org.id);
    const path = body.action === "organization" ? "/live/organizations/" + org.live_organization_id : body.action === "aircraft" ? "/live/organizations/" + org.live_organization_id + "/aircraft" : "/live/organizations/" + org.live_organization_id + "/schedules";
    const result = await ifRequest(token, path);
    return json({ result });
  } catch { return fail("Live data could not be retrieved. Retry or reconnect the organization.", 502); }
});
