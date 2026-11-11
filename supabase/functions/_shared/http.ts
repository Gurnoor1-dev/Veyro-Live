export const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_BASE_URL") ?? "https://example.invalid",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
export function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, ...extraHeaders, "Content-Type": "application/json; charset=utf-8" } });
}
export function fail(message: string, status = 400, extraHeaders: Record<string, string> = {}): Response {
  return json({ error: message }, status, extraHeaders);
}
