# Pilot guide

## Who can use the pilot preview?

Any authenticated Veyro user can connect their own Infinite Flight account and open a read-only dashboard for **any active Live organization that account belongs to**. The organization does not need to have been onboarded into Veyro, and the pilot does not need to be an Owner or Admin. A Live Member is enough.

This is deliberately separate from the shared VA portal:
- **Pilot preview:** personal, read-only access using the pilot's own Infinite Flight OAuth token. Works for any organization returned by the user's `GET /live/organizations`.
- **Connected VA portal:** shared Veyro workspace with organization membership, admin controls, Discord approval and (when fully identity-verified) booking workflows. The VA Owner/Admin must onboard this portal.

## First-time sign-in and dashboard access

1. Open the Veyro website and sign in with your email magic link.
2. Choose **Continue with Infinite Flight**.
3. Authorize the requested scopes: `live:organizations.read`, `live:aircraft.read`, and `live:schedules.read` (plus other scopes shown for the full application).
4. Veyro retrieves the Live organizations associated with your Infinite Flight account.
5. Select **any** organization in that list, including one where your role is Member and which has never been connected to Veyro.
6. Choose **Open pilot dashboard**.
7. The server verifies that the selected organization is in the authenticated user's Live organization list, then fetches the organization's current aircraft and schedules using that pilot's own token.
8. You land on the read-only Pilot Workspace. Use the Schedules/Fleet tabs and Refresh to fetch current data again.

You can only see organizations that Infinite Flight itself returns for your signed-in account. Veyro does not provide a bypass to private organizations or organizations you are not a member of.

## How personal OAuth credentials are handled

The pilot's access/refresh tokens are encrypted server-side and stored in `user_if_connections`, separate from the VA owner's `if_connections`. The browser never reads these credentials. Expired access tokens are refreshed server-side. The database does not store schedules, aircraft, member lists or other Live API response snapshots; the dashboard fetches those when requested.

A new migration, `20261115083550_pilot_personal_if_connections.sql`, creates this protected token table. Apply it before deploying `pilot-live-data`.

## What the pilot preview displays

- The selected Live organization's name and the signed-in user's Live role.
- Current organization fleet aircraft.
- Current published schedules.
- Counts and last refresh time.

The preview is intentionally read-only. It does not create bookings, assign crew, or grant Veyro admin privileges. A pilot does not gain access to another user's organizations by changing the organization ID in the browser; the Edge Function checks membership with Infinite Flight on every request.

## Connected VA portal and booking workflow

For a VA that has onboarded a Veyro portal, a pilot can additionally join the Veyro organization. The shared portal uses organization membership and RLS. The intended booking lifecycle is:

1. Pilot opens a schedule and reviews route, callsign, aircraft and other available details.
2. Pilot requests the leg and may include a short note.
3. The server checks the Supabase session, active Veyro membership, linked Infinite Flight identity, Live organization membership, and that the schedule still exists.
4. The server creates a Pending approval record. A partial unique index prevents duplicate active reservations for the same organization/schedule.
5. Veyro posts an approval card to the VA's configured Discord channel.
6. A permitted Discord approver approves or rejects the request.
7. On approval, Veyro calls the Live crew assignment endpoint.
8. The request becomes Approved only after Live confirms the assignment. A failed synchronization remains retryable and must not be displayed as a successful assignment.

Possible statuses: Pending approval, Approved, Rejected, Sync failed, Cancelled.

**Booking remains a separate privileged workflow.** The pilot preview intentionally does not enable booking or crew assignment. The backend must securely bind the OAuth-authenticated pilot to the correct Live member `userId` before crew assignment can be enabled.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| No organizations appear | Confirm you signed into the correct Infinite Flight account and that it belongs to a Live organization. |
| An organization is missing | Infinite Flight only returns organizations where the signed-in account is an active member. |
| Dashboard says reconnect | The personal OAuth session expired or no refresh token was issued. Reconnect Infinite Flight. |
| Missing scope message | Reconnect and approve organization, aircraft and schedule read scopes. |
| Schedules or fleet fail | Check Edge Function logs, API availability and rate-limit responses. |
| Refresh returns 429 | Wait for the Retry-After interval. The app has a shared 20 requests/minute guard for the approved testing allowance. |
| VA is not in the shared portal | Ask the VA Owner/Admin to onboard it. The read-only preview can still work without that portal. |
| Booking is unavailable | This is expected in pilot preview mode. Booking requires a connected Veyro VA and verified pilot identity binding. |

Never share your email sign-in link, password, OAuth access token or refresh token with anyone.
