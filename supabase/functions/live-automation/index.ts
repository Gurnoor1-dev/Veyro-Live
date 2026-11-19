import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { json, fail } from "../_shared/http.ts";
import { getOrganizationAccessToken } from "../_shared/org-token.ts";
import { ifRequest, IfApiRateLimitError } from "../_shared/infinite-flight.ts";

type Schedule = {
  id: string; aircraftId: string; status: number; callsign?: string;
  originIcao?: string; destinationIcao?: string; sequence: number;
  actualArrivalUtc?: string | null; scheduledDepartureUtc?: string | null;
  scheduledArrivalUtc?: string | null; crew?: Array<{userId:string;username?:string|null;role:number}>;
};
type Aircraft = { id: string; registration?: string };
type Position = {
  id: string; isOnGround: boolean; lastPilotId?: string | null;
  lastPilotUsername?: string | null; updatedAt: string;
};
type ActiveFlight = {
  flightId?: string; aircraftId?: string; altitude?: number; speed?: number;
  lastReport?: string; isConnected?: boolean; pilotState?: number;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const requiredScopes = ["live:aircraft.read", "live:schedules.read", "live:schedules.write", "live:members.read"];

function safeText(value: unknown, max = 100): string {
  return String(value ?? "").replace(/[\\`*_~|<>]/g, "\\$&").replace(/@/g, "@\u200b").slice(0, max) || "—";
}
function utc(value?: string | null): string {
  if (!value) return "Not scheduled";
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? "Not scheduled" : time.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
async function verifyAutomationSecret(value: string): Promise<boolean> {
  if (value.length < 32 || value.length > 256) return false;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  const hash = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const { data, error } = await admin.from("live_automation_security").select("secret_hash,enabled").eq("id", true).maybeSingle();
  return !error && Boolean(data?.enabled) && constantTimeEqual(hash, String(data.secret_hash ?? ""));
}
function latestCompleted(schedules: Schedule[], aircraftId: string): Schedule | null {
  return schedules.filter((s) => s.aircraftId === aircraftId && s.status === 11 && s.actualArrivalUtc)
    .sort((a, b) => Date.parse(String(b.actualArrivalUtc)) - Date.parse(String(a.actualArrivalUtc)))[0] ?? null;
}
function nextLeg(schedules: Schedule[], previous: Schedule): Schedule | null {
  return schedules.filter((s) => s.aircraftId === previous.aircraftId && s.sequence > previous.sequence && [1,2,3,8].includes(Number(s.status)))
    .sort((a, b) => a.sequence - b.sequence)[0] ?? null;
}
function activeFlightMap(flights: ActiveFlight[]): Map<string, ActiveFlight> {
  const map = new Map<string, ActiveFlight>();
  for (const flight of flights) {
    if (flight.isConnected === false) continue;
    for (const key of [flight.flightId, flight.aircraftId]) {
      if (key && !map.has(key)) map.set(key, flight);
    }
  }
  return map;
}
function isCurrentGroundState(position: Position, arrivalMs: number, active?: ActiveFlight): boolean {
  if (position.isOnGround !== true) return false;
  if (active) {
    const reportMs = Date.parse(String(active.lastReport ?? ""));
    const isCurrent = Number.isFinite(reportMs) && Date.now() - reportMs <= 2 * 60_000 && Date.now() >= reportMs - 30_000;
    if (isCurrent) {
      const parked = active.pilotState === 2 || ((Number(active.altitude) || 0) <= 100 && (Number(active.speed) || 0) <= 25);
      return parked;
    }
  }
  const updatedMs = Date.parse(position.updatedAt);
  return Number.isFinite(updatedMs) && Math.abs(updatedMs - arrivalMs) <= 30 * 60_000;
}
function eventPayload(type: "landing_dispatch" | "schedule_revisor" | "initial_schedule_open", previous: Schedule, next: Schedule, aircraft: Aircraft, position?: Position, discordUserId?: string) {
  const route = safeText(next.originIcao, 8) + " → " + safeText(next.destinationIcao, 8);
  if (type === "landing_dispatch") {
    const content = "**" + safeText(position?.lastPilotUsername, 80) + "** has landed at **" +
      safeText(previous.destinationIcao, 8) + "**. You're on the next leg (**" +
      safeText(next.originIcao, 8) + " - " + safeText(next.destinationIcao, 8) + "**), <@" + discordUserId + ">";
    return {
      content,
      embeds: [{
        title: "NEXT LEG DISPATCH",
        color: 5793266,
        fields: [
          { name: "Next flight", value: safeText(next.callsign, 32), inline: true },
          { name: "Aircraft", value: safeText(aircraft.registration, 24), inline: true },
          { name: "Route", value: route, inline: true },
        ],
        footer: { text: "VEYRO Live • Automatic landing dispatch" },
        timestamp: new Date().toISOString(),
      }],
      allowed_mentions: { parse: [], users: [discordUserId] },
    };
  }
  return {
    content: "A scheduled leg is now open for eligible pilots to claim.",
    embeds: [{
      title: "SCHEDULE OPEN · SELF-SERVICE",
      description: type === "initial_schedule_open" ? "This is the aircraft's first scheduled leg and it has no assigned crew. Claim an available crew position below. Assignments are sent directly to Infinite Flight." : "The aircraft has remained on the ground for at least 12 hours. Claim an available crew position below. Assignments are sent directly to Infinite Flight.",
      color: 5793266,
      fields: [
        { name: "Flight", value: safeText(next.callsign, 32), inline: true },
        { name: "Aircraft", value: safeText(aircraft.registration, 24), inline: true },
        { name: "Route", value: route, inline: true },
        { name: "Departure", value: utc(next.scheduledDepartureUtc), inline: true },
        { name: "Arrival", value: utc(next.scheduledArrivalUtc), inline: true },
        { name: "Current crew", value: String((next.crew ?? []).length) + " / 3", inline: true },
      ],
      footer: { text: "VEYRO Live • Choose Assign to select Captain or First Officer" },
      timestamp: new Date().toISOString(),
    }],
    components: [{
      type: 1,
      components: [{ type: 2, style: 1, label: "Assign", custom_id: "schedule-claim:" + next.id, emoji: { name: "🛫" } }],
    }],
    allowed_mentions: { parse: [] },
  };
}
async function publishEvent(orgId: string, channelId: string, event: {
  event_key: string; event_type: "landing_dispatch" | "schedule_revisor" | "initial_schedule_open";
  schedule_id: string; related_schedule_id: string; aircraft_id: string;
}, payload: Record<string, unknown>): Promise<boolean> {
  const { data: existing } = await admin.from("live_automation_events").select("*").eq("event_key", event.event_key).maybeSingle();
  if (existing?.status === "sent") return false;
  let row = existing;
  if (!row) {
    const { data, error } = await admin.from("live_automation_events").insert({
      organization_id: orgId, ...event, status: "pending",
    }).select("*").single();
    if (error) {
      const { data: retryRow } = await admin.from("live_automation_events").select("*").eq("event_key", event.event_key).maybeSingle();
      if (!retryRow) throw error;
      row = retryRow;
    } else row = data;
  }
  if (!BOT_TOKEN) {
    await admin.from("live_automation_events").update({ last_error_code: "discord_bot_not_configured", updated_at: new Date().toISOString() }).eq("id", row.id);
    return false;
  }
  const headers = { Authorization: "Bot " + BOT_TOKEN, "Content-Type": "application/json", Accept: "application/json" };
  let response: Response;
  if (row.discord_message_id) {
    response = await fetch("https://discord.com/api/v10/channels/" + channelId + "/messages/" + row.discord_message_id, {
      method: "PATCH", headers, body: JSON.stringify(payload),
    });
    if (response.status === 404) response = await fetch("https://discord.com/api/v10/channels/" + channelId + "/messages", {
      method: "POST", headers, body: JSON.stringify(payload),
    });
  } else {
    response = await fetch("https://discord.com/api/v10/channels/" + channelId + "/messages", {
      method: "POST", headers, body: JSON.stringify(payload),
    });
  }
  const message = await response.json().catch(() => null);
  if (!response.ok || !message?.id) {
    await admin.from("live_automation_events").update({
      last_error_code: "discord_http_" + response.status, updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    console.warn("[live-automation] Discord delivery failed", response.status);
    return false;
  }
  await admin.from("live_automation_events").update({
    discord_message_id: String(message.id), status: "sent", last_error_code: null, updated_at: new Date().toISOString(),
  }).eq("id", row.id);
  return true;
}
async function runOrganization(org: {id:string;live_organization_id:string}, counters: {scanned:number; dispatched:number; revised:number}) {
  const { data: lockToken, error: lockError } = await admin.rpc("acquire_live_automation_lock", { p_organization_id: org.id });
  if (lockError) throw lockError;
  if (!lockToken) return;
  try {
    const { data: settings } = await admin.from("discord_settings")
      .select("guild_id,approval_channel_id,landing_dispatch_channel_id,unassigned_legs_channel_id,schedule_revisor_channel_id,activity_log_channel_id,enabled").eq("organization_id", org.id).maybeSingle();
    if (!settings?.enabled || !settings.approval_channel_id) return;
    const { data: connection, error: connectionError } = await admin.from("if_connections")
      .select("live_role,granted_scopes").eq("organization_id", org.id).maybeSingle();
    if (connectionError || !connection || ![1,2].includes(Number(connection.live_role)) ||
      !requiredScopes.every((scope) => (connection.granted_scopes ?? []).includes(scope))) {
      throw new Error("organization_connection_not_ready");
    }
    const token = await getOrganizationAccessToken(org.id);
    const [aircrafts, schedulePage] = await Promise.all([
      ifRequest<Aircraft[]>(token, "/live/organizations/" + org.live_organization_id + "/aircraft"),
      ifRequest<{items:Schedule[];totalPages?:number}>(token, "/live/organizations/" + org.live_organization_id + "/schedules", {}, undefined, true),
    ]);
    const schedules = [...(schedulePage?.items ?? [])];
    const totalPages = Math.min(5, Number(schedulePage?.totalPages ?? 1));
    for (let page = 2; page <= totalPages; page++) {
      const nextPage = await ifRequest<{items:Schedule[]}>(token,
        "/live/organizations/" + org.live_organization_id + "/schedules?page=" + page + "&pageSize=100", {}, undefined, true);
      schedules.push(...(nextPage?.items ?? []));
    }

    const { data: runtime } = await admin.from("live_automation_runtime")
      .select("session_ids,sessions_refreshed_at,aircraft_cursor").eq("organization_id", org.id).maybeSingle();
    let sessionIds: string[] = Array.isArray(runtime?.session_ids) ? runtime.session_ids : [];
    const refreshedAt = runtime?.sessions_refreshed_at ? Date.parse(runtime.sessions_refreshed_at) : 0;
    if (!runtime?.sessions_refreshed_at || !refreshedAt || Date.now() - refreshedAt >= 10 * 60_000) {
      const sessions = await ifRequest<Array<{id:string}>>(token, "/sessions");
      sessionIds = (sessions ?? []).map((session) => session.id).filter(Boolean);
      await admin.from("live_automation_runtime").upsert({
        organization_id: org.id, session_ids: sessionIds, sessions_refreshed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id" });
    }
    const activeFlights: ActiveFlight[] = [];
    for (const sessionId of sessionIds) {
      const flights = await ifRequest<ActiveFlight[]>(token, "/sessions/" + sessionId + "/flights");
      activeFlights.push(...(flights ?? []));
    }
    const activeMap = activeFlightMap(activeFlights);
    const relevantAircraft = (aircrafts ?? []).filter((aircraft) => schedules.some((schedule) => schedule.aircraftId === aircraft.id));
    if (!relevantAircraft.length) return;
    let start = 0;
    const cursor = runtime?.aircraft_cursor;
    if (cursor) {
      const index = relevantAircraft.findIndex((aircraft) => aircraft.id === cursor);
      if (index >= 0) start = (index + 1) % relevantAircraft.length;
    }
    let lastScanned: string | null = null;
    for (let offset = 0; offset < relevantAircraft.length; offset++) {
      const aircraft = relevantAircraft[(start + offset) % relevantAircraft.length];
      let position: Position;
      try {
        position = await ifRequest<Position>(token, "/live/aircraft/" + aircraft.id + "/position");
      } catch (error) {
        if (error instanceof IfApiRateLimitError) break;
        console.warn("[live-automation] aircraft position unavailable", error instanceof Error ? error.message : "unknown");
        continue;
      }
      lastScanned = aircraft.id;
      counters.scanned++;
      const completed = latestCompleted(schedules, aircraft.id);
      if (!completed?.actualArrivalUtc) {
        const firstUnassigned = schedules.filter((s) => s.aircraftId === aircraft.id && [1,8].includes(Number(s.status)))
          .sort((a, b) => a.sequence - b.sequence)[0];
        if (!firstUnassigned || (firstUnassigned.crew ?? []).length !== 0 ||
          schedules.some((s) => s.aircraftId === aircraft.id && s.sequence < firstUnassigned.sequence)) continue;
        const positionAge = Date.now() - Date.parse(position.updatedAt);
        if (position.isOnGround !== true || !Number.isFinite(positionAge) || positionAge < -30_000 ||
          positionAge > 2 * 60_000 || activeMap.has(aircraft.id)) continue;
        const initialKey = "initial:" + firstUnassigned.id;
        const { data: priorInitial } = await admin.from("live_automation_events").select("status")
          .eq("event_key", initialKey).maybeSingle();
        if (priorInitial?.status === "sent") continue;
        if (!settings.unassigned_legs_channel_id) { counters.skipped++; continue; }
        const sent = await publishEvent(org.id, settings.unassigned_legs_channel_id, {
          event_key: initialKey, event_type: "initial_schedule_open",
          schedule_id: firstUnassigned.id, related_schedule_id: null, aircraft_id: aircraft.id,
        }, eventPayload("initial_schedule_open", firstUnassigned, firstUnassigned, aircraft));
        if (sent) counters.opened++;
        continue;
      }
      const next = nextLeg(schedules, completed);
      if (!next) continue;
      const arrivalMs = Date.parse(completed.actualArrivalUtc);
      const ageMs = Date.now() - arrivalMs;
      if (!Number.isFinite(arrivalMs) || ageMs < -2 * 60_000) continue;
      const active = activeMap.get(aircraft.id);
      if (!isCurrentGroundState(position, arrivalMs, active)) continue;
      const landingWindow = ageMs <= 30 * 60_000 && ageMs >= 0;
      const revisorWindow = ageMs >= 12 * 60 * 60_000 && [1,8].includes(Number(next.status)) && (next.crew ?? []).length < 3;
      if (!landingWindow && !revisorWindow) continue;
      const landingKey = "landing:" + completed.id;
      const revisorKey = "revisor:" + next.id;
      const { data: priorEvents } = await admin.from("live_automation_events").select("event_key,status")
        .in("event_key", [landingKey, revisorKey]);
      const sentKeys = new Set((priorEvents ?? []).filter((event) => event.status === "sent").map((event) => event.event_key));
      const shouldDispatch = landingWindow && !sentKeys.has(landingKey) && Boolean(position.lastPilotUsername && position.lastPilotId);
      const shouldRevise = revisorWindow && !sentKeys.has(revisorKey);
      if (!shouldDispatch && !shouldRevise) continue;

      // Confirm the persisted schedule against the aircraft's actual Live flight log.
      // A newer active flight invalidates the old ground state.
      const flightPage = await ifRequest<{items:Array<{status:number;originIcao?:string|null;destinationIcao?:string|null;actualArrivalUtc?:string|null;actualDepartureUtc?:string|null}>}>(
        token, "/live/aircraft/" + aircraft.id + "/flights", {}, undefined, true);
      const flightLog = flightPage?.items ?? [];
      const newerActiveFlight = flightLog.some((flight) => Number(flight.status) === 0 &&
        flight.actualDepartureUtc && Date.parse(flight.actualDepartureUtc) >= arrivalMs - 2 * 60_000);
      const matchingCompletedFlight = flightLog.some((flight) => Number(flight.status) === 1 &&
        flight.actualArrivalUtc &&
        Math.abs(Date.parse(flight.actualArrivalUtc) - arrivalMs) <= 30 * 60_000 &&
        String(flight.originIcao ?? "").toUpperCase() === String(completed.originIcao ?? "").toUpperCase() &&
        String(flight.destinationIcao ?? "").toUpperCase() === String(completed.destinationIcao ?? "").toUpperCase());
      if (newerActiveFlight || !matchingCompletedFlight) continue;

      // Landing dispatch: recent, confirmed arrival; only the next assigned pilot is mentioned.
      if (shouldDispatch) {
        const crew = [...(next.crew ?? [])].sort((a, b) => a.role - b.role);
        const assignedPilot = crew.find((member) => member.userId);
        if (assignedPilot) {
          const { data: profile } = await admin.from("profiles").select("discord_user_id")
            .eq("infinite_flight_user_id", assignedPilot.userId).maybeSingle();
          if (profile?.discord_user_id) {
            if (!settings.landing_dispatch_channel_id) { counters.skipped++; }
            else {
            const sent = await publishEvent(org.id, settings.landing_dispatch_channel_id, {
              event_key: "landing:" + completed.id, event_type: "landing_dispatch",
              schedule_id: completed.id, related_schedule_id: next.id, aircraft_id: aircraft.id,
            }, eventPayload("landing_dispatch", completed, next, aircraft, position, profile.discord_user_id));
            if (sent) counters.dispatched++;
            }
          }
        }
      }

      // Revisor: only future legs still in Scheduled/Delayed state, with capacity.
      if (shouldRevise) {
        const { data: existingBooking } = await admin.from("booking_requests").select("id").eq("organization_id", org.id)
          .eq("live_schedule_id", next.id).in("status", ["pending_approval","approved","sync_failed"]).limit(1).maybeSingle();
        if (existingBooking) continue;
        if (!settings.schedule_revisor_channel_id) { counters.skipped++; continue; }
        const sent = await publishEvent(org.id, settings.schedule_revisor_channel_id, {
          event_key: revisorKey, event_type: "schedule_revisor",
          schedule_id: next.id, related_schedule_id: completed.id, aircraft_id: aircraft.id,
        }, eventPayload("schedule_revisor", completed, next, aircraft));
        if (sent) counters.revised++;
      }
    }
    if (lastScanned) await admin.from("live_automation_runtime").update({
      aircraft_cursor: lastScanned, last_run_at: new Date().toISOString(), last_error_code: null, updated_at: new Date().toISOString(),
    }).eq("organization_id", org.id).eq("lock_token", lockToken);
  } finally {
    await admin.from("live_automation_runtime").update({
      lock_token: null, locked_until: null, last_run_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("organization_id", org.id).eq("lock_token", lockToken);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail("Method not allowed", 405);
  const supplied = req.headers.get("x-veyro-automation-secret") ?? "";
  if (!await verifyAutomationSecret(supplied)) return fail("Unauthorized", 401);
  const { data: organizations, error } = await admin.from("organizations")
    .select("id,live_organization_id").eq("is_active", true);
  if (error) return fail("Could not load active organizations", 500);
  const counters = { scanned: 0, dispatched: 0, revised: 0, opened: 0, skipped: 0, failed: 0 };
  for (const org of organizations ?? []) {
    try {
      await runOrganization(org, counters);
    } catch (error) {
      counters.failed++;
      const code = error instanceof IfApiRateLimitError ? "if_rate_limited" :
        error instanceof Error && /^[a-z0-9_]{3,64}$/i.test(error.message) ? error.message : "automation_run_failed";
      await admin.from("live_automation_runtime").upsert({
        organization_id: org.id, last_error_code: code, last_run_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id" });
      console.error("[live-automation] organization run failed", code);
    }
  }
  return json({ ok: true, organizations: organizations?.length ?? 0, ...counters, ranAt: new Date().toISOString() });
});
