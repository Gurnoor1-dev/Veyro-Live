import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { json, fail } from "../_shared/http.ts";

/**
 * Fetch the signed-in pilot's latest SimBrief OFP on demand.
 * The public SimBrief fetcher is used only after an explicit user action;
 * Veyro does not poll it or persist the returned flight plan.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return fail("Method not allowed", 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return fail("Unauthorized", 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authorization } } },
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return fail("Your Veyro session has expired. Sign in again.", 401);

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  if (!username || username.length > 80 || /[\u0000-\u001f\u007f]/.test(username)) {
    return fail("Enter a valid SimBrief username or Navigraph alias.", 400);
  }

  const url = new URL("https://www.simbrief.com/api/xml.fetcher.php");
  url.searchParams.set("username", username);
  url.searchParams.set("client", "VEYRO-Live");

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/xml, text/xml;q=0.9, */*;q=0.1" },
      signal: AbortSignal.timeout(15_000),
    });
    const xml = await response.text();
    if (!response.ok) {
      console.warn("[simbrief-ofp] SimBrief returned an error", { status: response.status });
      return fail("SimBrief could not find a flight plan for that username. Check the alias and generate an OFP first.", 422);
    }
    if (xml.length > 3_000_000) return fail("The returned SimBrief OFP is too large to import.", 413);
    if (!/<OFP(?:\s|>)/i.test(xml) || /<error(?:\s|>)/i.test(xml)) {
      return fail("SimBrief did not return a valid OFP. Check your username and try again.", 422);
    }

    return json({
      xml,
      username,
      fetchedAt: new Date().toISOString(),
      source: "SimBrief",
    });
  } catch (error) {
    console.error("[simbrief-ofp] request failed", error instanceof Error ? error.message : String(error));
    return fail("Could not reach SimBrief right now. Please try again shortly.", 502);
  }
});
