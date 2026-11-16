# Infinite Flight API compliance

PublicApi v3 is currently documented as an active preview. Endpoint paths, scopes, fields, validation, rate limits and app-review requirements may change. Do not treat this scaffold as production-approved.

## Data handling
Infinite Flight's developer documentation states that Live API data may only be used for simulated-flight features and must not be stored, accumulated or shared. The restriction includes organization members, aircraft flight logs, pilot flight times and statistics calculated from them.

Accordingly, VEYRO Live is designed to:
- Fetch fleet and schedules on demand through Edge Functions.
- Avoid durable copies of Live member rosters, aircraft snapshots, schedules, flight logs and pilot flight-time data.
- Avoid long-lived caches of API payloads.
- Persist only VEYRO-owned reservation/approval transaction state and the minimum Live object identifiers needed to reconcile a user-initiated booking.
- Discard transient Live responses after serving the current request.

**Important:** Even external identifiers associated with a booking may be considered Live-derived data. Before public launch, confirm this minimal transaction-reference approach with Infinite Flight and follow any additional written requirements. If the policy does not permit it, the booking design must be changed before launch.


## PublicApi v3 request and pagination contract

All Live requests use `https://api.infiniteflight.com/public/v3`, a user OAuth access token in the Bearer header, and the documented `{ errorCode, result }` response envelope. OAuth authorization and token exchange use `https://api.infiniteflight.com/auth/v2/connect/authorize` and `/token`.

The Edge Functions now distinguish array responses from Page responses instead of adding pagination parameters to every GET:

- `GET /live/organizations`: organization array; `live:organizations.read`.
- `GET /live/organizations/{organizationId}`: one organization; `live:organizations.read`.
- `GET /live/organizations/{organizationId}/members`: organization member collection; `live:members.read`.
- `GET /live/organizations/{organizationId}/aircraft`: aircraft array; `live:aircraft.read`.
- `GET /live/organizations/{organizationId}/schedules`: paged schedule collection; `live:schedules.read`.
- `GET /live/aircraft/{aircraftId}/schedules`: schedule array; `live:schedules.read`.
- `GET /live/aircraft/{aircraftId}/flights`: paged flight collection; `live:aircraft.read`.

For Page-based endpoints, VEYRO requests the documented one-based `page` with `pageSize=100` and returns that page to the caller. It does not eagerly request an unbounded number of pages: every extra page is another rate-limited API request. Array endpoints receive no pagination query parameters. There is no arbitrary 20-page rejection.

Schedule mutations use the documented v3 resources and request bodies: create via `POST /live/aircraft/{aircraftId}/schedules`; update/delete via `/live/schedules/{scheduleId}`; flight-plan update via `/live/schedules/{scheduleId}/flightplan`; crew assignment via `/live/schedules/{scheduleId}/crew/{userId}`; and reorder via `PUT /live/aircraft/{aircraftId}/schedules/reorder` with `{ scheduleId, afterId }`.

## OAuth scopes
Request the minimum scopes needed:
- `openid`, `profile`, `offline_access`
- `live:organizations.read`
- `live:members.read`
- `live:aircraft.read`
- `live:schedules.read`
- `live:schedules.write` only for the organization connection that performs crew assignment.

## Crew assignment
The current preview documents:
`PUT /public/v3/live/schedules/{scheduleId}/crew/{userId}`
with a JSON body such as `{"role":0}`. The user must be an organization member and the authenticated OAuth account must be an organization Owner/Admin with `live:schedules.write`. A schedule supports up to three crew members.

VEYRO's initial reservation policy intentionally permits only one active booking per schedule, even though the Live API can support multiple crew assignments. Revisit only as an explicit product decision.

## Official references
- [PublicApi v3 overview](https://infiniteflight.com/guide/developer-reference/live-api-v3/overview)
- [OAuth2 authorization](https://infiniteflight.com/guide/developer-reference/live-api-v3/oauth)
- [Assign or update schedule crew](https://infiniteflight.com/guide/developer-reference/live-api-v3/assign-schedule-crew)
- [Developer reference and API rules](https://infiniteflight.com/guide/developer-reference/)

Never use Live data for real-world aviation operations or for AI training, fine-tuning or evaluation.
