import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { fail } from "../_shared/http.ts";
import { decryptSecret, encryptSecret } from "../_shared/crypto.ts";
import { exchangeAuthorizationCode } from "../_shared/infinite-flight.ts";
function readInfiniteFlightIdentity(idToken: unknown): { userId: string; displayName: string } | null {
  if (typeof idToken !== "string") return null;
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const encoded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = encoded + "=".repeat((4 - encoded.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes));
    const issuer = String(claims.iss ?? "");
    const audience = claims.aud;
    const clientId = Deno.env.get("INFINITE_FLIGHT_CLIENT_ID");
    const audienceMatches = audience === clientId || (Array.isArray(audience) && audience.includes(clientId));
    if (!["https://auth.infiniteflight.com", "https://auth.infiniteflight.com/"].includes(issuer)) return null;
    if (!audienceMatches || Number(claims.exp ?? 0) <= Math.floor(Date.now() / 1000)) return null;
    const userId = typeof claims.sub === "string" ? claims.sub.trim() : "";
    if (!userId || userId.length > 128) return null;
    const displayName = typeof claims.preferred_username === "string" ? claims.preferred_username
      : typeof claims.name === "string" ? claims.name : "Infinite Flight pilot";
    return { userId, displayName: displayName.slice(0, 80) };
  } catch {
    return null;
  }
}

async function persistInfiniteFlightIdentity(admin: ReturnType<typeof createClient>, userId: string, identity: { userId: string; displayName: string }) {
  const { data: existing, error: lookupError } = await admin.from("profiles")
    .select("id").eq("infinite_flight_user_id", identity.userId).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing?.id && existing.id !== userId) {
    const oldId = existing.id as string;
    const { data: currentProfile, error: currentLookupError } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (currentLookupError) throw currentLookupError;
    if (currentProfile) throw new Error("This Veyro session is already linked to a different Infinite Flight account.");
    // An anonymous session may be recreated after browser storage is cleared.
    // The verified Infinite Flight subject is the ownership proof for recovering
    // its existing Veyro profile and associated memberships/bookings.
    const migrations = await Promise.all([
      admin.from("organization_memberships").update({ user_id: userId }).eq("user_id", oldId),
      admin.from("booking_requests").update({ pilot_user_id: userId }).eq("pilot_user_id", oldId),
      admin.from("booking_requests").update({ reviewed_by: userId }).eq("reviewed_by", oldId),
      admin.from("organization_pilot_invites").update({ accepted_user_id: userId }).eq("accepted_user_id", oldId),
      admin.from("organization_pilot_invites").update({ invited_by: userId }).eq("invited_by", oldId),
      admin.from("organizations").update({ created_by: userId }).eq("created_by", oldId),
      admin.from("user_if_connections").delete().eq("user_id", oldId),
    ]);
    const failed = migrations.find((result) => result.error);
    if (failed?.error) throw failed.error;
    const { error: moveProfileError } = await admin.from("profiles").update({
      id: userId, display_name: identity.displayName, infinite_flight_user_id: identity.userId,
    }).eq("id", oldId);
    if (moveProfileError) throw moveProfileError;
    return;
  }
  const { error } = await admin.from("profiles").upsert({
    id: userId, infinite_flight_user_id: identity.userId, display_name: identity.displayName,
  }, { onConflict: "id" });
  if (error) throw error;
}

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
    const ifIdentity = readInfiniteFlightIdentity(token.id_token);
    if (ifIdentity) await persistInfiniteFlightIdentity(admin, transaction.user_id, ifIdentity);
    const profileWrite = Promise.resolve({ error: null });
    const [{ error: saveError }, { error: connectionError }, { error: profileError }] = await Promise.all([
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
      profileWrite,
    ]);
    if (saveError) throw saveError;
    if (connectionError) throw connectionError;
    if (profileError) throw profileError;
    console.info("[if-oauth-callback] completed", {
      tokenExchangeMs: Math.round(tokenExchangedAt - startedAt),
      persistenceMs: Math.round(performance.now() - tokenExchangedAt),
      identityLinked: Boolean(ifIdentity),
    });
    const rawBase = Deno.env.get("APP_BASE_URL") ?? "";
    const base = rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;
    const requestedPath = String(transaction.redirect_path ?? "/login");
    const safePath = requestedPath.startsWith("/") && !requestedPath.startsWith("//") && !requestedPath.includes("://") ? requestedPath : "/login";
    const destination = new URL(safePath, base || new URL(req.url).origin);
    destination.searchParams.set("if_connected", "1");
    destination.searchParams.set("pending", pendingId);
    return new Response(null, { status: 302, headers: { Location: destination.toString() } });
  } catch (error) {
    console.error("[if-oauth-callback] authorization processing failed", error instanceof Error ? error.message : String(error));
    const base = (Deno.env.get("APP_BASE_URL") ?? "").replace(/\/$/, "");
    const destination = new URL("/login", base || new URL(req.url).origin);
    destination.searchParams.set("connect_error", "Infinite Flight could not finish linking this session. Please retry; if this repeats, contact Veyro support.");
    return new Response(null, { status: 302, headers: { Location: destination.toString() } });
  }
});
