import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { fail } from "../_shared/http.ts";
import { decryptSecret, encryptSecret } from "../_shared/crypto.ts";
import { exchangeAuthorizationCode, ifRequest } from "../_shared/infinite-flight.ts";
Deno.serve(async (req) => {
  if (req.method !== "GET") return fail("Method not allowed", 405);
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return fail("Missing OAuth code or state", 400);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state));
  const stateHash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: transaction, error } = await admin.from("oauth_transactions").select("*").eq("state_hash", stateHash).single();
  if (error || !transaction || new Date(transaction.expires_at).getTime() < Date.now()) return fail("Invalid or expired OAuth state", 400);
  await admin.from("oauth_transactions").delete().eq("state_hash", stateHash);
  try {
    const verifier = await decryptSecret(transaction.code_verifier_ciphertext);
    const token = await exchangeAuthorizationCode(code, verifier);
    const accessToken = token.access_token as string;
    const organizations = await ifRequest<Array<{ id: string; role: number }>>(accessToken, "/live/organizations");
    // Organization selection and encrypted token persistence are completed in the next onboarding milestone.
    const encryptedAccess = await encryptSecret(accessToken);
    const encryptedRefresh = token.refresh_token ? await encryptSecret(token.refresh_token as string) : null;
    // Avoid returning credentials or ciphertext to the browser. The token payload is deliberately not persisted by this scaffold.
    void encryptedAccess; void encryptedRefresh; void transaction.user_id; void organizations;
    return new Response(null, { status: 302, headers: { Location: (Deno.env.get("APP_BASE_URL") ?? "/") + "/login?oauth=authorized" } });
  } catch {
    return fail("Infinite Flight authorization failed", 502);
  }
});
