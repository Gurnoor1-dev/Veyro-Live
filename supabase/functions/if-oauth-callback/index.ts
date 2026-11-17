import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { fail } from "../_shared/http.ts";
import { decryptSecret, encryptSecret } from "../_shared/crypto.ts";
import { exchangeAuthorizationCode } from "../_shared/infinite-flight.ts";
Deno.serve(async (req) => {
  if (req.method !== "GET") return fail("Method not allowed", 405);
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return fail("Missing OAuth code or state", 400);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state));
  const stateHash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // Atomically consume the state in one database round-trip. A replayed callback
  // cannot obtain the same transaction or exchange the same authorization code twice.
  const { data: transaction, error } = await admin.from("oauth_transactions")
    .delete().eq("state_hash", stateHash).select("*").single();
  if (error || !transaction || new Date(transaction.expires_at).getTime() < Date.now()) return fail("Invalid or expired OAuth state", 400);
  try {
    const startedAt = performance.now();
    const verifier = await decryptSecret(transaction.code_verifier_ciphertext);
    const token = await exchangeAuthorizationCode(code, verifier);
    const tokenExchangedAt = performance.now();
    const pendingId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    const tokenExpiresAt = new Date(Date.now() + Number(token.expires_in ?? 1800) * 1000).toISOString();
    // Encrypt once and reuse the ciphertext for the temporary hand-off and the
    // durable refreshable connection, avoiding duplicate WebCrypto work.
    const accessTokenCiphertext = await encryptSecret(token.access_token as string);
    const refreshTokenCiphertext = token.refresh_token ? await encryptSecret(token.refresh_token as string) : null;
    const scopes = String(token.scope ?? "").split(" ").filter(Boolean);
    const [{ error: saveError }, { error: connectionError }] = await Promise.all([
      admin.from("oauth_pending_connections").insert({
        id: pendingId,
        user_id: transaction.user_id,
        access_token_ciphertext: accessTokenCiphertext,
        refresh_token_ciphertext: refreshTokenCiphertext,
        access_token_expires_at: tokenExpiresAt,
        granted_scopes: scopes,
        expires_at: expiresAt,
      }),
      admin.from("user_if_connections").upsert({
        user_id: transaction.user_id,
        access_token_ciphertext: accessTokenCiphertext,
        refresh_token_ciphertext: refreshTokenCiphertext,
        token_expires_at: tokenExpiresAt,
        granted_scopes: scopes,
      }, { onConflict: "user_id" }),
    ]);
    if (saveError) throw saveError;
    if (connectionError) throw connectionError;
    console.info("[if-oauth-callback] completed", {
      tokenExchangeMs: Math.round(tokenExchangedAt - startedAt),
      persistenceMs: Math.round(performance.now() - tokenExchangedAt),
    });
    const rawBase = Deno.env.get("APP_BASE_URL") ?? "";
    const base = rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;
    const requestedPath = String(transaction.redirect_path ?? "/login");
    const safePath = requestedPath.startsWith("/") && !requestedPath.startsWith("//") && !requestedPath.includes("://") ? requestedPath : "/login";
    const destination = new URL(safePath, base || new URL(req.url).origin);
    destination.searchParams.set("if_connected", "1");
    destination.searchParams.set("pending", pendingId);
    return new Response(null, { status: 302, headers: { Location: destination.toString() } });
  } catch {
    return fail("Infinite Flight authorization failed", 502);
  }
});
