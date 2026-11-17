import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { json, fail } from "../_shared/http.ts";
import { decryptSecret, encryptSecret } from "../_shared/crypto.ts";
import { ifRequest, IfApiRateLimitError, type IfApiRateLimitState, refreshAuthorizationToken, reserveIfApiRequests } from "../_shared/infinite-flight.ts";

const pilotCache = new Map<string, { expiresAt: number; value: any }>();
const pilotAircraftCache = new Map<string, { expiresAt: number; aircraft: Array<{ id: string; registration?: string }> }>();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return fail("Method not allowed", 405);
  const auth = req.headers.get("Authorization");
  if (!auth) return fail("Unauthorized", 401);
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const requestedOrganizationId = typeof body?.organizationId === "string" ? body.organizationId.trim() : "";
  const organizationSlug = typeof body?.organizationSlug === "string" ? body.organizationSlug.trim().toLowerCase() : "";
  if (!requestedOrganizationId && (!organizationSlug || organizationSlug.length > 80)) return fail("Missing Live organization ID", 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (!requestedOrganizationId) {
    const { data: organizationRef, error: organizationLookupError } = await admin.from("organizations")
      .select("live_organization_id").eq("slug", organizationSlug).eq("is_active", true).maybeSingle();
    if (organizationLookupError || !organizationRef?.live_organization_id) return fail("This organization portal could not be found or is inactive.", 404);
    body.organizationId = organizationRef.live_organization_id;
  } else {
    body.organizationId = requestedOrganizationId;
  }
  const cacheScope = typeof body.cacheScope === "string" && /^[0-9a-f-]{36}$/i.test(body.cacheScope) ? body.cacheScope : null;
  const cacheKey = user.id + ":" + body.organizationId + ":" + (cacheScope ?? crypto.randomUUID());
  if (cacheScope && !body.pendingId && !["aircraft_positions", "aircraft_operations", "schedule_page", "organization_members"].includes(String(body.action ?? ""))) {
    const cached = pilotCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      // The cache contains data fetched only after this user's Live membership was
      // verified. Keep it short-lived and in memory; do not persist API membership data.
      return json(cached.value);
    }
  }
  try {
    let token: string;
    let refreshCiphertext: string | null = null;
    let expiry: string | null = null;
    let scopes: string[] = [];

    if (body.pendingId) {
      const { data: pending } = await admin.from("oauth_pending_connections").select("*")
        .eq("id", body.pendingId).eq("user_id", user.id).single();
      if (!pending || new Date(pending.expires_at).getTime() < Date.now()) return fail("Infinite Flight authorization expired. Please reconnect.", 410);
      token = await decryptSecret(pending.access_token_ciphertext);
      refreshCiphertext = pending.refresh_token_ciphertext;
      expiry = pending.access_token_expires_at;
      scopes = pending.granted_scopes ?? [];
    } else {
      const { data: connection } = await admin.from("user_if_connections").select("*").eq("user_id", user.id).single();
      if (!connection) return fail("Connect Infinite Flight to open your pilot dashboard.", 401);
      scopes = connection.granted_scopes ?? [];
      refreshCiphertext = connection.refresh_token_ciphertext;
      expiry = connection.token_expires_at;
      const expiresAt = expiry ? new Date(expiry).getTime() : 0;
      if (expiresAt > Date.now() + 90_000) token = await decryptSecret(connection.access_token_ciphertext);
      else {
        if (!refreshCiphertext) return fail("Your Infinite Flight session expired. Reconnect your account.", 401);
        const refreshed = await refreshAuthorizationToken(await decryptSecret(refreshCiphertext));
        token = refreshed.access_token as string;
        expiry = new Date(Date.now() + Number(refreshed.expires_in ?? 1800) * 1000).toISOString();
        refreshCiphertext = refreshed.refresh_token ? await encryptSecret(refreshed.refresh_token as string) : refreshCiphertext;
        const { error } = await admin.from("user_if_connections").update({
          access_token_ciphertext: await encryptSecret(token),
          refresh_token_ciphertext: refreshCiphertext,
          token_expires_at: expiry,
        }).eq("user_id", user.id);
        if (error) return fail("Could not refresh your Infinite Flight connection.", 500);
      }
    }

    const required = ["live:organizations.read", "live:members.read", "live:aircraft.read", "live:schedules.read"];
    const missing = required.filter((scope) => !scopes.includes(scope));
    if (missing.length) return fail("Reconnect Infinite Flight and approve these scopes: " + missing.join(", "), 403);

    // On-demand reads are authorized against active Veyro membership. Infinite Flight
    // independently validates access to each organization aircraft/schedule resource.
    if (["aircraft_positions", "aircraft_operations", "schedule_page", "organization_members"].includes(String(body.action ?? ""))) {
      const { data: portal } = await admin.from("organizations")
        .select("id,created_by").eq("live_organization_id", body.organizationId).eq("is_active", true).maybeSingle();
      if (!portal) return fail("This organization does not have an active Veyro portal.", 404);
      const { data: membership } = await admin.from("organization_memberships")
        .select("role,is_active").eq("organization_id", portal.id).eq("user_id", user.id).maybeSingle();
      if (!(membership?.is_active && ["pilot", "owner", "admin"].includes(membership.role)) && portal.created_by !== user.id) {
        return fail("Active pilot or administrator access is required to view this fleet.", 403);
      }

      let rateLimitState: IfApiRateLimitState = { remaining: body.apiRateRemaining == null ? null : Math.max(0, Number(body.apiRateRemaining) || 0), resetAt: body.apiRateResetAt ?? null, isPro: Boolean(body.isPro) };
      const observeRateLimit = (state: IfApiRateLimitState) => {
        rateLimitState = {
          remaining: state.remaining ?? rateLimitState.remaining,
          resetAt: state.resetAt ?? rateLimitState.resetAt,
          isPro: state.isPro || rateLimitState.isPro,
        };
      };

      if (body.action === "organization_members") {
        const budget = body.apiRateRemaining == null ? (body.isPro ? 20 : 5) : Math.max(0, Number(body.apiRateRemaining) || 0);
        if (budget <= 0) return json({ members: [], rateLimited: true, rateLimit: rateLimitState });
        const members = await ifRequest<Array<Record<string, unknown>>>(token, "/live/organizations/" + body.organizationId + "/members", {}, observeRateLimit);
        return json({ members, rateLimit: rateLimitState });
      }

      if (body.action === "schedule_page") {
        const budget = body.apiRateRemaining == null ? (body.isPro ? 20 : 5) : Math.max(0, Number(body.apiRateRemaining) || 0);
        if (budget <= 0) return json({ schedules: [], pagination: { page: Number(body.page) || 1, pageSize: 100, totalCount: 0, totalPages: 0 }, rateLimited: true, rateLimit: rateLimitState });
        const pageNumber = Math.max(1, Math.min(10000, Math.floor(Number(body.page) || 1)));
        const pageResult = await ifRequest<{ items: Array<Record<string, unknown>>; page: number; pageSize: number; totalCount: number; totalPages: number }>(
          token, "/live/organizations/" + body.organizationId + "/schedules?page=" + pageNumber + "&pageSize=100", {}, observeRateLimit, true,
        );
        return json({
          schedules: pageResult.items ?? [],
          pagination: { page: pageResult.page, pageSize: pageResult.pageSize, totalCount: pageResult.totalCount, totalPages: pageResult.totalPages },
          rateLimit: rateLimitState,
        });
      }

      const requestedIds = Array.isArray(body.aircraftIds)
        ? [...new Set(body.aircraftIds.map((id: unknown) => String(id)).filter((id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))].slice(0, 100)
        : [];
      const positions: Record<string, unknown> = {};
      const latestFlights: Record<string, unknown> = {};
      const failures: Record<string, string> = {};
      let rateLimited = false;
      let retryAfterSeconds = 0;
      let completed = 0;
      let remainingBudget = body.apiRateRemaining !== undefined && body.apiRateRemaining !== null
        ? Math.min(20, Math.max(0, Number(body.apiRateRemaining) || 0))
        : (body.isPro ? 20 : 5);
      let batchReservationActive = false;
      const observePositionRateLimit = (state: IfApiRateLimitState) => {
        remainingBudget = state.remaining !== null ? state.remaining : Math.max(0, remainingBudget - (batchReservationActive ? 0 : 1));
        rateLimitState = {
          remaining: state.remaining ?? remainingBudget,
          resetAt: state.resetAt ?? rateLimitState.resetAt,
          isPro: state.isPro || rateLimitState.isPro,
        };
      };
      const cachedAircraft = cacheScope ? pilotAircraftCache.get(cacheKey) : null;
      let knownAircraft = cachedAircraft && cachedAircraft.expiresAt > Date.now() ? cachedAircraft.aircraft : null;
      if (!knownAircraft) {
        if (remainingBudget <= 0) return json({ positions, latestFlights, failures, completed, total: requestedIds.length, rateLimited: true, retryAfterSeconds, rateLimit: rateLimitState, updatedAt: new Date().toISOString() });
        knownAircraft = await ifRequest<Array<{ id: string; registration?: string }>>(token, "/live/organizations/" + body.organizationId + "/aircraft", {}, observePositionRateLimit);
        if (cacheScope) pilotAircraftCache.set(cacheKey, { expiresAt: Date.now() + 5 * 60_000, aircraft: knownAircraft });
      }
      const allowedIds = new Set(knownAircraft.map((item) => item.id));
      const aircraftIds = (requestedIds.length ? requestedIds : knownAircraft.map((item) => item.id)).filter((id) => allowedIds.has(id));

      const requestsPerAircraft = body.action === "aircraft_operations" ? 2 : 1;
      const aircraftToProcess = aircraftIds.slice(0, Math.min(aircraftIds.length, Math.floor(remainingBudget / requestsPerAircraft)));
      const reservedRequestCount = aircraftToProcess.length * requestsPerAircraft;
      if (reservedRequestCount > 0) {
        await reserveIfApiRequests(reservedRequestCount);
        remainingBudget = Math.max(0, remainingBudget - reservedRequestCount);
        batchReservationActive = true;
      } else if (aircraftIds.length > 0) {
        rateLimited = true;
      }

      let nextAircraftIndex = 0;
      let stopWorkers = false;
      const worker = async () => {
        while (!stopWorkers) {
          const index = nextAircraftIndex++;
          if (index >= aircraftToProcess.length) return;
          const aircraftId = aircraftToProcess[index];
          try {
            positions[aircraftId] = await ifRequest(token, "/live/aircraft/" + aircraftId + "/position", {}, observePositionRateLimit, false, true);
            if (body.action === "aircraft_operations") {
              const flights = await ifRequest<Array<Record<string, unknown>>>(token, "/live/aircraft/" + aircraftId + "/flights?page=1&pageSize=1", {}, observePositionRateLimit, false, true);
              latestFlights[aircraftId] = flights[0] ?? null;
            }
            completed += 1;
          } catch (error) {
            if (error instanceof IfApiRateLimitError) {
              rateLimited = true;
              retryAfterSeconds = error.retryAfterSeconds;
              remainingBudget = 0;
              stopWorkers = true;
            }
            failures[aircraftId] = error instanceof Error ? error.message : "Position unavailable";
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, aircraftToProcess.length) }, () => worker()));
      if (aircraftToProcess.length < aircraftIds.length) rateLimited = true;
      return json({ positions, latestFlights, failures, completed, total: aircraftIds.length, rateLimited, retryAfterSeconds, rateLimit: rateLimitState, updatedAt: new Date().toISOString() });
    }

    let rateLimitState: IfApiRateLimitState = { remaining: null, resetAt: null, isPro: false };
    const observeRateLimit = (state: IfApiRateLimitState) => { rateLimitState = state; };
    // Resolve the Veyro portal in parallel with the first Live membership check.
    // The Live response is still required before any membership or dashboard data is returned.
    const [organization, portalResult] = await Promise.all([
      ifRequest<{ id: string; name: string; role: number }>(token, "/live/organizations/" + body.organizationId, {}, observeRateLimit),
      admin.from("organizations").select("id,slug").eq("live_organization_id", body.organizationId).eq("is_active", true).maybeSingle(),
    ]);
    if (!organization) return fail("Your Infinite Flight account is not a member of this organization.", 403);
    // The v3 Live organization list is already scoped to the authenticated
    // Infinite Flight user. Confirm membership there; do not call an undocumented
    // OIDC user-info URL (it returns 404 and blocks every dashboard).
    const portal = portalResult.data;
    if (portalResult.error || !portal) return fail("This organization does not have a Veyro pilot portal.", 404);
    const inviteQuery = user.email
      ? admin.from("organization_pilot_invites").select("id,pilot_name,status,accepted_user_id").eq("organization_id", portal.id).ilike("email", user.email.toLowerCase()).in("status", ["invited", "accepted"]).maybeSingle()
      : Promise.resolve({ data: null });
    const [inviteResult, membershipResult] = await Promise.all([
      inviteQuery,
      admin.from("organization_memberships").select("role,is_active").eq("organization_id", portal.id).eq("user_id", user.id).maybeSingle(),
    ]);
    const invite = inviteResult.data;
    const existingMembership = membershipResult.data;
    if (existingMembership && !existingMembership.is_active) return fail("Your pilot access has been disabled by the organization administrator.", 403);
    const hasVerifiedLiveMembership = Number.isInteger(organization.role) && organization.role >= 0 && organization.role <= 2;
    if (!invite && !existingMembership && !hasVerifiedLiveMembership) {
      return fail("Your Infinite Flight membership could not be verified for this organization.", 403);
    }
    if (invite?.status === "accepted" && invite.accepted_user_id !== user.id) {
      return fail("This pilot invitation has already been used by another account.", 403);
    }

    // The Live organization resource is returned only to a verified member.
    // Create the Veyro membership from that verified role so OAuth-only users
    // do not need an email account to enter their organization's portal.
    const verifiedVeyroRole = organization.role === 2 ? "owner" : organization.role === 1 ? "admin" : "pilot";
    const memberWrite = !existingMembership
      ? admin.from("organization_memberships").insert({
          organization_id: portal.id, user_id: user.id, role: verifiedVeyroRole, is_active: true,
        })
      : existingMembership.role === "pilot" && ["admin", "owner"].includes(verifiedVeyroRole)
        ? admin.from("organization_memberships").update({ role: verifiedVeyroRole }).eq("organization_id", portal.id).eq("user_id", user.id)
        : Promise.resolve({ error: null });
    const inviteWrite = invite && invite.status === "invited"
      ? admin.from("organization_pilot_invites").update({
          status: "accepted", accepted_user_id: user.id, accepted_at: new Date().toISOString(),
        }).eq("id", invite.id)
      : Promise.resolve({ error: null });
    // Keep Veyro-owned profile and connection records in parallel; Live API data remains temporary.
    const profileWrite = admin.from("profiles").upsert({
      id: user.id,
      display_name: invite?.pilot_name ?? user.user_metadata?.display_name ?? user.user_metadata?.name ?? (user.email ? user.email.split("@")[0] : "Infinite Flight pilot"),
    }, { onConflict: "id" });
    const connectionWrite = body.pendingId
      ? encryptSecret(token).then((ciphertext) => admin.from("user_if_connections").upsert({
          user_id: user.id,
          access_token_ciphertext: ciphertext,
          refresh_token_ciphertext: refreshCiphertext,
          token_expires_at: expiry,
          granted_scopes: scopes,
        }, { onConflict: "user_id" }))
      : Promise.resolve({ error: null });
    const [memberResult, inviteWriteResult, profileWriteResult, connectionWriteResult] = await Promise.all([
      memberWrite, inviteWrite, profileWrite, connectionWrite,
    ]);
    if (memberResult.error) return fail("Could not activate your organization membership.", 500);
    if (inviteWriteResult.error) return fail("Your pilot invitation could not be accepted. Please retry.", 500);
    if (profileWriteResult.error) return fail("Could not save your Veyro pilot profile.", 500);
    if (connectionWriteResult.error) return fail("Could not securely save your pilot connection.", 500);

    await reserveIfApiRequests(2);
    const [aircraft, schedulesPage, bookingsResult] = await Promise.all([
      ifRequest<Array<Record<string, unknown>>>(token, "/live/organizations/" + organization.id + "/aircraft", {}, observeRateLimit, false, true),
      ifRequest<{ items: Array<Record<string, unknown>>; page: number; pageSize: number; totalCount: number; totalPages: number }>(token, "/live/organizations/" + organization.id + "/schedules?page=1&pageSize=100", {}, observeRateLimit, true, true),
      admin.from("booking_requests").select("id,live_schedule_id,status,request_note,created_at,reviewed_at,rejection_reason")
        .eq("organization_id", portal.id).eq("pilot_user_id", user.id).order("created_at", { ascending: false }).limit(30),
    ]);
    const schedules = schedulesPage.items ?? [];
    const schedulesPagination = { page: schedulesPage.page, pageSize: schedulesPage.pageSize, totalCount: schedulesPage.totalCount, totalPages: schedulesPage.totalPages };
    const payload = { organization, aircraft, schedules, schedulesPagination, bookings: bookingsResult.data ?? [], members: [], role: organization.role, portal: { id: portal.id, slug: portal.slug }, portalId: portal.id, pilotId: user.id, mode: "pilot-portal", rateLimit: rateLimitState };
    if (cacheScope) {
      pilotAircraftCache.set(cacheKey, { expiresAt: Date.now() + 5 * 60_000, aircraft });
      pilotCache.set(cacheKey, { expiresAt: Date.now() + 30_000, value: payload });
    }
    return json(payload);
  } catch (error) {
    console.error("[pilot-live-data] failed", error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error));
    if (error instanceof IfApiRateLimitError) return fail(error.message, 429, { "Retry-After": String(error.retryAfterSeconds) });
    return fail(error instanceof Error ? error.message : "Could not load this organization's Live data.", 502);
  }
});
