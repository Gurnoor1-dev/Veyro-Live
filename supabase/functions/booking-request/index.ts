import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { json, fail } from "../_shared/http.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return fail("Method not allowed", 405);
  const auth = req.headers.get("Authorization");
  if (!auth) return fail("Unauthorized", 401);
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.organizationId || !body?.scheduleId || !body?.aircraftId || !body?.pilotIfUserId) return fail("Missing booking details");
  const { data: member } = await client.from("organization_memberships").select("user_id").eq("organization_id", body.organizationId).eq("user_id", user.id).eq("is_active", true).single();
  if (!member) return fail("Not an active organization member", 403);
  const { data: booking, error } = await client.from("booking_requests").insert({ organization_id: body.organizationId, pilot_user_id: user.id, pilot_if_user_id: body.pilotIfUserId, live_schedule_id: body.scheduleId, live_aircraft_id: body.aircraftId, request_note: typeof body.note === "string" ? body.note.slice(0, 500) : null, status: "pending_approval" }).select("id,status,created_at").single();
  if (error) return error.code === "23505" ? fail("This schedule already has an active reservation.", 409) : fail("Could not create booking request", 500);
  // Discord approval message creation is the next integration milestone.
  return json({ booking });
});
