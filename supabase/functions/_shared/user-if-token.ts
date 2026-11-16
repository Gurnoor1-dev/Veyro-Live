import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { decryptSecret, encryptSecret } from "./crypto.ts";
import { refreshAuthorizationToken } from "./infinite-flight.ts";

export async function getUserInfiniteFlightToken(userId: string) {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: connection, error } = await admin.from("user_if_connections").select("*").eq("user_id", userId).maybeSingle();
  if (error || !connection) throw new Error("Connect Infinite Flight once from My Veyro to manage this organization.");
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 90_000) return { token: await decryptSecret(connection.access_token_ciphertext), scopes: connection.granted_scopes ?? [] };
  if (!connection.refresh_token_ciphertext) throw new Error("Your Infinite Flight session expired. Reconnect from My Veyro.");
  const refreshToken = await decryptSecret(connection.refresh_token_ciphertext);
  const rotated = await refreshAuthorizationToken(refreshToken);
  const nextAccess = await encryptSecret(rotated.access_token as string);
  const nextRefresh = rotated.refresh_token ? await encryptSecret(rotated.refresh_token as string) : connection.refresh_token_ciphertext;
  const nextExpiry = new Date(Date.now() + Number(rotated.expires_in ?? 1800) * 1000).toISOString();
  const { error: updateError } = await admin.from("user_if_connections").update({
    access_token_ciphertext: nextAccess,
    refresh_token_ciphertext: nextRefresh,
    token_expires_at: nextExpiry,
    granted_scopes: String(rotated.scope ?? connection.granted_scopes?.join(" ") ?? "").split(" ").filter(Boolean),
  }).eq("user_id", userId);
  if (updateError) throw new Error("Could not refresh your Infinite Flight connection.");
  return { token: rotated.access_token as string, scopes: String(rotated.scope ?? connection.granted_scopes?.join(" ") ?? "").split(" ").filter(Boolean) };
}
