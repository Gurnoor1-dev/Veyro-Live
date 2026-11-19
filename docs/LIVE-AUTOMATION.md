# VEYRO Live — Real Flight Automation

This workflow is event-driven by actual Infinite Flight Live data. It does not generate sample embeds or simulated booking events.

## What runs automatically

Supabase Cron invokes `live-automation` once per minute. The worker uses the encrypted Infinite Flight OAuth connection already linked by an organisation Owner/Admin and the organisation's configured Discord approval channel.

### Landing → next-leg dispatch

1. A pilot flies an actual scheduled organisation aircraft leg in Infinite Flight.
2. Infinite Flight marks the persistent schedule as Arrived and records its actual arrival time.
3. The worker checks the aircraft's persisted position and the current Live session flight lists. Stale position data alone is not sufficient.
4. The worker matches the completed schedule by aircraft and sequence, finds the next scheduled/boarding/delayed leg, and resolves its assigned crew member to a VEYRO profile with a linked Discord account.
5. Discord receives one message in the configured channel. It displays the previous pilot's IFC username as plain text and mentions only the next assigned pilot.
6. A database event key based on the completed schedule ID prevents duplicate messages.

### Unassigned first-leg notification

If an aircraft has no earlier scheduled legs and its first Scheduled/Delayed leg has no crew assigned, the worker posts a self-service claim card as soon as Infinite Flight reports a fresh on-ground position and no active session flight. Pilots can choose Captain or First Officer; the organisation's connected Infinite Flight Admin/Owner account assigns the crew directly. This path does not require a previous arrival or a 12-hour wait. The claim handler rechecks that the leg is still the first leg, remains unassigned, and the aircraft is still grounded before writing the assignment.

### 12-hour schedule revisor → direct crew assignment

1. An aircraft completes a scheduled leg and remains on the ground.
2. At least 12 hours after the completed schedule's actual arrival, the worker verifies that the aircraft is still on the ground and that the next leg remains Scheduled or Delayed.
3. If the next schedule has an available crew position and no active VEYRO booking request, Discord receives one real self-service claim card.
4. An eligible pilot selects **Assign**, then chooses **Captain** or **First Officer**.
5. VEYRO verifies the pilot's linked Discord account, active VEYRO organisation membership, current Infinite Flight organisation membership, schedule availability and crew capacity.
6. The organisation's encrypted Owner/Admin OAuth connection performs the Infinite Flight crew assignment immediately. No Discord administrator approval is involved.
7. The claim card is updated with the latest crew list and its Assign control is removed when the schedule reaches three crew members.

## Required setup

- The organisation must have an active Infinite Flight OAuth connection with `live:aircraft.read`, `live:members.read`, `live:schedules.read` and `live:schedules.write`.
- The connected Infinite Flight account must be an organisation Admin or Owner.
- Discord integration must be enabled and the bot must be able to send messages and embeds in the configured approval channel.
- Pilots must have their Discord and Infinite Flight accounts linked in VEYRO Live and be active members of the VEYRO organisation.
- The pilot's Infinite Flight account must still be a member of the matching Infinite Flight Live organisation.

## Real-world test procedure (Infinite Flight simulator)

### Test the landing dispatcher

1. In Infinite Flight Live, create or use a real aircraft schedule with a completed leg followed by a next leg.
2. Assign a different linked pilot to the next leg's crew.
3. Have the previous pilot fly the completed leg in Infinite Flight and land at the scheduled destination.
4. Keep the simulator reporting the parked aircraft for a short period so the persisted position reflects the landing.
5. Allow the one-minute worker to scan the aircraft. The next pilot should receive the only Discord mention; the previous pilot's IFC username should appear without a mention.
6. Check the Supabase Edge Function logs and the `live_automation_events` row for the completed schedule ID. A second scan must not create a duplicate post.

### Test the 12-hour revisor and direct assignment

1. Use a real aircraft whose previous scheduled leg has an `actualArrivalUtc` at least 12 hours in the past and whose current persisted state is on the ground.
2. Ensure the next schedule is still Scheduled or Delayed, has fewer than three crew members, and has no pending/approved VEYRO booking request.
3. Wait for the scheduled worker. It should publish a single self-service card in the configured Discord channel.
4. Sign in to Discord as a linked, active organisation pilot and click **Assign**.
5. Choose Captain or First Officer. VEYRO should perform the Infinite Flight API crew assignment directly and update the Discord card.
6. Verify the pilot appears in the crew list for that exact schedule in Infinite Flight Live. No organisation administrator needs to approve the claim in Discord.

## Monitoring and troubleshooting

- Supabase Dashboard → **Integrations → Cron → Jobs**: inspect `veyro-live-automation` and its run history.
- Supabase Dashboard → **Edge Functions → live-automation / discord-interactions → Logs**: inspect worker and interaction failures.
- `public.live_automation_runtime` stores only session IDs, a scan cursor, lock state and safe operational error codes.
- `public.live_automation_events` stores schedule/aircraft identifiers, Discord message IDs and delivery state for idempotency. It does not store Live API response bodies.
- `public.live_schedule_claims` stores the pilot's claim choice and assignment state, not a copy of the Live schedule.
- A `live_assignment_failed` response means Infinite Flight did not confirm the assignment. The claim can be retried after the failed state is released; check the organisation OAuth role, scopes, current member status and schedule crew capacity.

## Infinite Flight API compliance

The worker refreshes the server list no more often than every 10 minutes and checks session flight lists no more often than once per minute. It uses the slowest polling interval needed for the workflow, processes Live API responses in memory, and does not build a flight history, position history or persistent Live-data cache. Only identifiers needed for API calls and application idempotency are retained.

Official references:
- [PublicApi v3 overview](https://infiniteflight.com/guide/developer-reference/live-api-v3/overview)
- [Get Aircraft Position](https://infiniteflight.com/guide/developer-reference/live-api-v3/aircraft-position)
- [Assign or Update Schedule Crew](https://infiniteflight.com/guide/developer-reference/live-api-v3/assign-schedule-crew)
- [API Usage and Data Rules](https://infiniteflight.com/guide/developer-reference/api-rules/usage-and-data-rules)
