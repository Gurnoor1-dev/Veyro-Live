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
  const { pendingId } = await req.json().catch(() => ({}));
  if (!pendingId) return fail("Missing pending authorization", 400);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: pending } = await admin.from("oauth_pending_connections").select("*").eq("id", pendingId).eq("user_id", user.id).single();
  if (!pending || new Date(pending.expires_at).getTime() < Date.now()) return fail("Authorization expired. Please reconnect.", 410);
  try {
    const token = await decryptSecret(pending.access_token_ciphertext);
    const organizations = await ifRequest<Array<{ id: string; name?: string; role: number }>>(token, "/live/organizations");
    return json({ organizations: organizations.map((org) => ({ id: org.id, name: org.name ?? "Live organization", role: org.role })) });
  } catch { return fail("Could not load your Live organizations.", 502); }
});
