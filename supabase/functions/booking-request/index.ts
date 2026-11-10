import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { json, fail } from "../_shared/http.ts";
import { getOrganizationAccessToken } from "../_shared/org-token.ts";
import { ifRequest } from "../_shared/infinite-flight.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return fail("Method not allowed", 405);
  const auth = req.headers.get("Authorization");
  if (!auth) return fail("Unauthorized", 401);
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.organizationId || !body?.scheduleId || !body?.aircraftId) return fail("Missing booking details");
  const { data: member } = await client.from("organization_memberships").select("user_id").eq("organization_id", body.organizationId).eq("user_id", user.id).eq("is_active", true).single();
  if (!member) return fail("Not an active organization member", 403);
  const { data: profile } = await client.from("profiles").select("infinite_flight_user_id").eq("id", user.id).single();
  if (!profile?.infinite_flight_user_id) return fail("Link and verify your Infinite Flight account before requesting a leg.", 409);
  const { data: org } = await client.from("organizations").select("id,live_organization_id").eq("id", body.organizationId).eq("is_active", true).single();
  if (!org) return fail("Organization not found", 404);
  try {
    const token = await getOrganizationAccessToken(org.id);
    const members = await ifRequest<Array<{ userId: string }>>(token, "/live/organizations/" + org.live_organization_id + "/members");
    if (!members.some((item) => item.userId === profile.infinite_flight_user_id)) return fail("Your Infinite Flight account is not currently a member of this Live organization.", 403);
    const schedules = await ifRequest<Array<{ id: string; aircraftId?: string }>>(token, "/live/aircraft/" + body.aircraftId + "/schedules");
    if (!schedules.some((schedule) => schedule.id === body.scheduleId)) return fail("This schedule is no longer available. Refresh the flight board.", 409);
    const { data: booking, error } = await client.from("booking_requests").insert({
      organization_id: org.id,
      pilot_user_id: user.id,
      pilot_if_user_id: profile.infinite_flight_user_id,
      live_schedule_id: body.scheduleId,
      live_aircraft_id: body.aircraftId,
      request_note: typeof body.note === "string" ? body.note.slice(0, 500) : null,
      status: "pending_approval",
    }).select("id,status,created_at").single();
    if (error) return error.code === "23505" ? fail("This schedule already has an active reservation.", 409) : fail("Could not create booking request", 500);
    // Discord approval message creation is handled by the bot notification integration.
    return json({ booking });
  } catch {
    return fail("Could not verify the current Live schedule. Please retry.", 502);
  }
});
