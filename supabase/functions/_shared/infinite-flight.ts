import { createClient } from "npm:@supabase/supabase-js@2.56.0";

export const IF_AUTH = "https://api.infiniteflight.com/auth/v2/connect";
export const IF_API = "https://api.infiniteflight.com/public/v3";

type ApiEnvelope<T> = { errorCode: number; result: T };
export type IfApiRateLimitState = { remaining: number | null; resetAt: string | null; isPro: boolean };
type IfApiRateLimitObserver = (state: IfApiRateLimitState) => void;

export class IfApiRateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super("VEYRO has reached its Infinite Flight API request limit. Please retry shortly.");
    this.name = "IfApiRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

let rateLimitAdminClient: ReturnType<typeof createClient> | null = null;

function getRateLimitAdminClient() {
  if (rateLimitAdminClient) return rateLimitAdminClient;
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) throw new Error("API rate-limit guard is not configured");
  rateLimitAdminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return rateLimitAdminClient;
}

export async function reserveIfApiRequests(count: number): Promise<void> {
  if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error("Invalid Infinite Flight API reservation size");
  const { data, error } = await getRateLimitAdminClient().rpc("reserve_if_api_requests", { p_count: count });
  if (error || !Array.isArray(data) || !data[0]) {
    console.error("[Infinite Flight] batch rate reservation failed", error?.message ?? "empty response");
    throw new Error("Could not verify the Infinite Flight API request allowance");
  }
  if (!data[0].allowed) {
    throw new IfApiRateLimitError(Math.max(1, Number(data[0].retry_after_seconds) || 3));
  }
}

async function reserveIfApiRequest(): Promise<void> {
  return reserveIfApiRequests(1);
}

const PAGED_LIVE_ENDPOINTS = [
  // These two v3 collection routes return result.items + Page metadata.
  // Organization aircraft, organization members, and aircraft schedules
  // return plain arrays and must not receive paging query parameters.
  /^\/live\/organizations\/[^/]+\/schedules$/,
  /^\/live\/aircraft\/[^/]+\/flights$/,
]

function isPagedLiveEndpoint(pathname: string): boolean {
  return PAGED_LIVE_ENDPOINTS.some((pattern) => pattern.test(pathname));
}

export async function ifRequest<T>(token: string, path: string, init: RequestInit = {}, onRateLimit?: IfApiRateLimitObserver, returnPage = false, alreadyReserved = false): Promise<T> {
  if (!path.startsWith("/live/") || path.includes("..")) throw new Error("Unsupported API path");

  const method = (init.method ?? "GET").toUpperCase();
  const requestUrl = new URL(IF_API + path);
  const pagedEndpoint = method === "GET" && isPagedLiveEndpoint(requestUrl.pathname);

  // PublicApi v3 uses one-based page numbers and a maximum pageSize of 100
  // for its Page-based Live collection endpoints. Do not attach paging
  // parameters to array or single-resource endpoints.
  if (pagedEndpoint) {
    if (!requestUrl.searchParams.has("page")) requestUrl.searchParams.set("page", "1");
    if (!requestUrl.searchParams.has("pageSize")) requestUrl.searchParams.set("pageSize", "100");
  }

  const send = async (url: URL): Promise<ApiEnvelope<T>> => {
    if (!alreadyReserved) await reserveIfApiRequest();
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    const remainingHeader = response.headers.get("X-Rate-Limit-Remaining");
    const resetHeader = response.headers.get("X-Rate-Limit-Reset");
    const proHeader = response.headers.get("X-User-Pro");
    onRateLimit?.({
      remaining: remainingHeader === null ? null : Math.max(0, Number(remainingHeader) || 0),
      resetAt: resetHeader,
      isPro: proHeader?.toLowerCase() === "true",
    });
    const payload = await response.json().catch(() => null);
    if (response.status === 429) {
      const retry = Number(response.headers.get("Retry-After")) || 5;
      throw new IfApiRateLimitError(retry);
    }
    if (!response.ok || payload?.errorCode !== 0) {
      const status = response.status;
      const code = Number(payload?.errorCode);
      throw new Error("Infinite Flight API request failed (HTTP " + status + (Number.isFinite(code) ? ", error " + code : "") + ")");
    }
    return payload as ApiEnvelope<T>;
  };

  const response = await send(requestUrl);
  const result = response.result as unknown;

  // Some v3 endpoints return a plain array (for example List Organizations
  // and List Organization Aircraft); others return a Page with result.items.
  // Return the requested page's items to existing dashboard callers. Additional
  // pages are fetched on demand by passing ?page=N, rather than eagerly firing
  // dozens of requests and exceeding the documented per-user rate limit.
  if (result && typeof result === "object" && Array.isArray((result as { items?: unknown }).items)) {
    const page = result as { items: unknown[]; page?: number; pageSize?: number; totalPages?: number };
    const currentPage = Number(page.page ?? requestUrl.searchParams.get("page") ?? 1);
    const totalPages = Number(page.totalPages ?? currentPage);
    if (!Number.isInteger(currentPage) || currentPage < 1 || !Number.isInteger(totalPages) || totalPages < 0) {
      throw new Error("Infinite Flight returned invalid pagination metadata");
    }
    if (totalPages > currentPage) {
      console.info("[Infinite Flight] paged collection", {
        endpoint: requestUrl.pathname,
        page: currentPage,
        totalPages,
        pageSize: Number(page.pageSize ?? 100),
      });
    }
    return (returnPage ? result : page.items) as T;
  }

  return response.result;
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
