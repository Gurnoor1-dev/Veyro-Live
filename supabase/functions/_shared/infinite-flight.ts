export const IF_AUTH = "https://api.infiniteflight.com/auth/v2/connect";
export const IF_API = "https://api.infiniteflight.com/public/v3";
export async function ifRequest<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  if (!path.startsWith("/live/") || path.includes("..")) throw new Error("Unsupported API path");
  const response = await fetch(IF_API + path, { ...init, headers: { Authorization: "Bearer " + token, Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers } });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.errorCode !== 0) throw new Error("Infinite Flight API request failed with HTTP " + response.status);
  return payload.result as T;
}
export async function exchangeAuthorizationCode(code: string, verifier: string) {
  const clientId = Deno.env.get("INFINITE_FLIGHT_CLIENT_ID");
  const clientSecret = Deno.env.get("INFINITE_FLIGHT_CLIENT_SECRET");
  const redirectUri = Deno.env.get("INFINITE_FLIGHT_REDIRECT_URI");
  if (!clientId || !redirectUri) throw new Error("OAuth is not configured");
  const body = new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, code, redirect_uri: redirectUri, code_verifier: verifier });
  if (clientSecret) body.set("client_secret", clientSecret);
  const response = await fetch(IF_AUTH + "/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error("Token exchange failed");
  return await response.json();
}

export async function refreshAuthorizationToken(refreshToken: string) {
  const clientId = Deno.env.get("INFINITE_FLIGHT_CLIENT_ID");
  const clientSecret = Deno.env.get("INFINITE_FLIGHT_CLIENT_SECRET");
  if (!clientId) throw new Error("OAuth is not configured");
  const body = new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, refresh_token: refreshToken });
  if (clientSecret) body.set("client_secret", clientSecret);
  const response = await fetch(IF_AUTH + "/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error("Token refresh failed");
  return await response.json();
}
