export const IF_AUTH = "https://api.infiniteflight.com/auth/v2/connect";
export const IF_API = "https://api.infiniteflight.com/public/v3";

type ApiEnvelope<T> = { errorCode: number; result: T };

export async function ifRequest<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  if (!path.startsWith("/live/") || path.includes("..")) throw new Error("Unsupported API path");

  const method = (init.method ?? "GET").toUpperCase();
  const requestUrl = new URL(IF_API + path);
  if (method === "GET" && !requestUrl.searchParams.has("page")) {
    requestUrl.searchParams.set("page", "1");
    requestUrl.searchParams.set("pageSize", "100");
  }

  const send = async (url: URL): Promise<ApiEnvelope<T>> => {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.errorCode !== 0) {
      const status = response.status;
      const code = Number(payload?.errorCode);
      throw new Error("Infinite Flight API request failed (HTTP " + status + (Number.isFinite(code) ? ", error " + code : "") + ")");
    }
    return payload as ApiEnvelope<T>;
  };

  const first = await send(requestUrl);
  const result = first.result as unknown;
  if (!result || typeof result !== "object" || !Array.isArray((result as { items?: unknown }).items)) {
    return first.result;
  }

  const page = result as { items: unknown[]; page?: number; pageSize?: number; totalPages?: number };
  const items = [...page.items];
  const totalPages = Number(page.totalPages ?? 1);
  const pageSize = Number(page.pageSize ?? 100);
  if (!Number.isInteger(totalPages) || totalPages < 1 || totalPages > 20) {
    throw new Error("Infinite Flight returned an unsupported page count");
  }

  for (let pageNumber = 2; pageNumber <= totalPages; pageNumber += 1) {
    const nextUrl = new URL(requestUrl);
    nextUrl.searchParams.set("page", String(pageNumber));
    nextUrl.searchParams.set("pageSize", String(pageSize));
    const next = await send(nextUrl);
    const nextResult = next.result as { items?: unknown[] } | null;
    if (!nextResult || !Array.isArray(nextResult.items)) {
      throw new Error("Infinite Flight returned an invalid paged response");
    }
    items.push(...nextResult.items);
  }

  return items as T;
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
