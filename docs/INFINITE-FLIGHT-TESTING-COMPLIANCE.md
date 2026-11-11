# Infinite Flight PublicApi v3 testing controls

This repository is configured for the VEYRO Live testing client.

## Access boundary

- Infinite Flight's OAuth testing-client restriction is authoritative: the client owner and up to five invited test users can authorize while the client remains in Testing.
- Invite the test users in the Infinite Flight API client settings. Do not create a parallel list of user emails or IDs in frontend code.
- A VEYRO account by itself does not grant Infinite Flight access. Live data and write actions must be authorized by the user's Infinite Flight OAuth token and the relevant organization role/scope.
- Do not attempt to bypass a failed OAuth authorization, a missing scope, or a Live organization membership check.

## API request ceiling

The project owner reports that Infinite Flight staff approved a ceiling of **20 PublicApi v3 requests per rolling 60 seconds** for this testing client.

VEYRO enforces this centrally in Postgres:

- One shared counter is used by all Edge Function instances and all signed-in users.
- Every outbound PublicApi v3 HTTP request is reserved before it is sent.
- Every additional page in a paginated response consumes another request.
- At request 21 within the rolling minute, VEYRO blocks the call locally and returns HTTP 429 with a `Retry-After` header.
- If Infinite Flight itself responds with HTTP 429, VEYRO respects its retry delay and does not automatically retry.
- The limiter fails closed if the database guard cannot be reached.
- OAuth authorization-code exchange and token refresh use the separate OAuth service; they are not PublicApi v3 Live endpoint calls and are not counted in this Live API budget.

Do not raise this limit without fresh written approval from Infinite Flight staff. Do not run frequent polling loops. Fetch organization, fleet and schedule data only when needed, use the whole-fleet schedules endpoint where possible, and let the user refresh on demand. Keep API traffic comfortably below the ceiling rather than planning to consume all 20 requests continuously.

## Operational safeguards

- OAuth tokens and refresh tokens remain encrypted in Supabase; never put them in the browser, Discord messages, logs, or GitHub.
- Ask only for scopes needed by the current feature. The present admin workflow requests organization, member, aircraft, schedule read and schedule write scopes.
- Read operations require organization membership and the relevant read scope.
- Schedule and crew writes require `live:schedules.write` and an Infinite Flight organization owner/admin token.
- Re-check current Live membership and schedule availability before booking/assignment. A failed or rate-limited request must not be shown as a successful Live assignment.
- On a 429, show a retry-later state; do not retry in a tight loop.
- Treat API v3 as a preview contract. Recheck Infinite Flight's current developer reference before changing endpoint paths, scopes, pagination, enums, or request payloads.

## Testing checklist

1. Confirm the OAuth client is in Testing and the intended users are the owner plus no more than five invited testers.
2. Confirm every tester authorizes through Infinite Flight and only sees organizations they belong to.
3. Confirm a member cannot perform organization-admin write actions.
4. Confirm the global request counter is shared across multiple Edge Functions.
5. Confirm 20 requests in a rolling minute are admitted and the next request is blocked with 429 and Retry-After.
6. Confirm paginated pages count individually.
7. Confirm rate limiting never marks a booking as approved or reports a crew assignment as successful.
8. Confirm a later retry works after the retry window, without duplicate booking or crew assignment.
