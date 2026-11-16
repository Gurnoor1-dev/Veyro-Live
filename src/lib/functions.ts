import type { SupabaseClient } from "@supabase/supabase-js";

type InvokeOptions = Parameters<SupabaseClient["functions"]["invoke"]>[1];

export async function invokeFunction<T = any>(
  client: SupabaseClient,
  name: string,
  options?: InvokeOptions,
): Promise<{ data: T | null; error: Error | null }> {
  const { data, error } = await client.functions.invoke<T>(name, options);
  if (!error) return { data: data as T, error: null };

  let message = error.message || "The request could not be completed.";
  let status: number | undefined;
  let payload: any = null;

  if ("context" in error && error.context instanceof Response) {
    status = error.context.status;
    payload = await error.context.clone().json().catch(() => null);
    if (typeof payload?.error === "string" && payload.error.trim()) message = payload.error;
    else if (typeof payload?.message === "string" && payload.message.trim()) message = payload.message;
    if (status === 429) message = payload?.error || "Too many requests. Please wait a moment and try again.";
    if (status === 401) message = payload?.error || "Your session has expired. Sign in again to continue.";
    if (status === 403) message = payload?.error || "Your account does not have permission to do that.";
    if (status >= 500 && !payload?.error && !payload?.message) {
      message = "The service is temporarily unavailable. Please try again shortly.";
    }
  } else if (error.name === "FunctionsFetchError") {
    message = "Could not reach the Veyro service. Check your connection and try again.";
  } else if (error.name === "FunctionsRelayError") {
    message = "The Veyro service could not start this request. Please try again shortly.";
  }

  const normalized = new Error(message);
  normalized.name = "VeyroFunctionError";
  Object.assign(normalized, { functionName: name, status, code: payload?.code, details: payload?.details, retryAfter: status === 429 ? 10 : undefined });
  console.error("[veyro] function request failed", { functionName: name, status, message, code: payload?.code, details: payload?.details });
  return { data: null, error: normalized };
}
