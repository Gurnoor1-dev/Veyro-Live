# Architecture

## Product model
VEYRO Live is a multi-tenant SaaS. One deployment serves many independent Infinite Flight Live organizations. Each organization receives a path-based portal at `/org/:slug`. Organization configuration, app roles, booking requests, Discord settings and integration connections are tenant-scoped.

The Live website remains the source of truth for fleet and schedules. VEYRO Live reads those resources through PublicApi v3 on demand; administrators continue publishing schedules in Infinite Flight Live.

## Runtime boundaries
- **Vercel:** Static React/Vite frontend and SPA rewrites only.
- **Supabase Auth:** VEYRO application sessions.
- **Supabase PostgreSQL:** Tenant configuration, app roles, reservations, approval state, integration references and audit metadata.
- **Supabase Edge Functions:** Infinite Flight OAuth, token refresh, all PublicApi v3 calls, Discord interaction verification, approval processing and notifications.
- **Discord:** Approval interface for authorized organization administrators.

The browser must not call Infinite Flight directly and must never receive access tokens, refresh tokens, client secrets, Discord bot tokens, service-role keys or encryption keys.

## Main flows

### Organization connection
1. An owner/admin signs in with Infinite Flight OAuth2 Authorization Code + PKCE.
2. The callback Edge Function validates state and exchanges the code server-side.
3. The server reads the user's organizations and verifies the selected organization and role.
4. Tokens are encrypted before storage; the organization connection records granted scopes and the connecting account.
5. Only an organization Owner/Admin with `live:schedules.write` can authorize assignment synchronization.

### Schedule browsing
1. A signed-in pilot opens the organization's flight board.
2. The Edge Function verifies Supabase identity and active membership in that VEYRO tenant.
3. It fetches current schedules and aircraft from PublicApi v3.
4. It returns a minimal response to the UI. No durable Live snapshot is written to the database.

### Booking and Discord approval
1. The pilot selects a published Live schedule and submits a leg request.
2. PostgreSQL creates a pending reservation using a transaction and a unique active-reservation constraint for the Live schedule ID.
3. The Discord approval message is posted to the configured organization channel.
4. A Discord interaction is verified cryptographically and checked against the tenant's configured admin role allowlist and VEYRO app permissions.
5. Approval is idempotent. The server assigns the pilot through `PUT /live/schedules/{scheduleId}/crew/{userId}`.
6. The Edge Function confirms the V3 response before setting the request to `approved`. API failure leaves a retryable `sync_failed` state.
7. Rejection or cancellation updates the request and notifies the pilot.

### Booking concurrency
A database unique partial index permits only one active VEYRO reservation per Live schedule, matching the initial single-booking product rule. The database is authoritative for reservation contention. A booking is not represented as a confirmed Live crew assignment until the API returns success.

## Data model principles
- Never mirror the Live fleet, member roster, schedules, flight logs, pilot flight times or derived analytics into persistent tables.
- Store only VEYRO-owned transaction state and the minimum external identifiers needed to execute or reconcile a user-requested booking. Review this treatment against Infinite Flight's current data rules before production.
- Use short-lived in-memory responses and avoid persistent caches for Live API payloads.
- Store tokens encrypted with an application-managed AES-GCM key supplied as a Supabase secret.
- Keep tenant membership and app roles separate from Infinite Flight's current member list; re-check Live membership/role before privileged operations.

## Edge Functions
- `if-oauth-start`: create PKCE verifier/challenge and state.
- `if-oauth-callback`: validate state, exchange code and encrypt tokens.
- `if-api`: allowlisted read operations against V3; no arbitrary URL proxy.
- `booking-request`: create/cancel reservations and trigger Discord notification.
- `discord-interactions`: verify Discord signatures and process approve/reject actions.
- `sync-approval`: retry a failed V3 crew assignment idempotently.
- `health`: deployment readiness endpoint with no secrets or sensitive metadata.

## API preview caveat
PublicApi v3 is a preview. Keep endpoint paths, scopes, DTO validation and response mapping inside `supabase/functions/_shared/infinite-flight.ts`. Do not couple React components or database schema to raw API response objects.
