import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { decryptSecret, encryptSecret } from "./crypto.ts";
import { refreshAuthorizationToken } from "./infinite-flight.ts";

export async function getOrganizationAccessToken(organizationId: string): Promise<string> {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: connection, error } = await admin.from("if_connections").select("*").eq("organization_id", organizationId).single();
  if (error || !connection) throw new Error("Live organization connection not found");
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 90_000) return decryptSecret(connection.access_token_ciphertext);
  if (!connection.refresh_token_ciphertext) throw new Error("Reconnect the Infinite Flight organization");
  const refreshToken = await decryptSecret(connection.refresh_token_ciphertext);
  const rotated = await refreshAuthorizationToken(refreshToken);
  const expiresIn = Number(rotated.expires_in ?? 1800);
  const nextAccess = await encryptSecret(rotated.access_token as string);
  const nextRefresh = rotated.refresh_token ? await encryptSecret(rotated.refresh_token as string) : connection.refresh_token_ciphertext;
  const { error: updateError } = await admin.from("if_connections").update({
    access_token_ciphertext: nextAccess,
    refresh_token_ciphertext: nextRefresh,
    token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
  }).eq("id", connection.id);
  if (updateError) throw new Error("Could not rotate Infinite Flight credentials");
  return rotated.access_token as string;
}
