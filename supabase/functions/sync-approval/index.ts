import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { json, fail } from "../_shared/http.ts";
import { getOrganizationAccessToken } from "../_shared/org-token.ts";
import { ifRequest } from "../_shared/infinite-flight.ts";
Deno.serve(async (req) => {
  if (req.method !== "POST") return fail("Method not allowed", 405);
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (req.headers.get("Authorization") !== "Bearer " + serviceKey) return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.bookingRequestId) return fail("Missing booking request ID");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  const { data: booking } = await admin.from("booking_requests").select("*").eq("id", body.bookingRequestId).single();
  if (!booking || booking.status !== "sync_failed") return fail("Booking is not awaiting synchronization", 409);
  try {
    const token = await getOrganizationAccessToken(booking.organization_id);
    const result = await ifRequest(token, "/live/schedules/" + booking.live_schedule_id + "/crew/" + booking.pilot_if_user_id, { method: "PUT", body: JSON.stringify({ role: 0 }) });
    const { error } = await admin.from("booking_requests").update({ status: "approved", sync_error_code: null }).eq("id", booking.id).eq("status", "sync_failed");
    if (error) throw error;
    await admin.from("audit_events").insert({ organization_id: booking.organization_id, actor_user_id: booking.reviewed_by, event_type: "booking.live_assignment_confirmed", subject_id: booking.id });
    return json({ success: true, result });
  } catch {
    await admin.from("booking_requests").update({ sync_error_code: "live_assignment_failed" }).eq("id", booking.id);
    return fail("Live crew assignment failed. Request remains retryable.", 502);
  }
});
