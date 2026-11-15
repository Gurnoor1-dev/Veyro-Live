# Pilot guide

## Who can use a VA portal?

A pilot needs:
- A VEYRO account authenticated through Supabase email sign-in.
- An Infinite Flight account that is an active member of the VA's Live organization.
- An active Veyro membership for that organization.

The pilot does **not** need to be an Infinite Flight Owner or Admin. Live Owner/Admin is required only when initially connecting a VA and creating its portal.

## First-time sign-in

1. Open the VA's Veyro portal link or the global sign-in page.
2. Enter your email and use the secure one-time sign-in link.
3. Choose **Continue with Infinite Flight** and authorize the requested scopes.
4. Veyro retrieves the Live organizations associated with the signed-in Infinite Flight account.
5. Select the VA you want to access:
   - If the VA already has a Veyro portal, select it and continue as a pilot. A Live Member role is sufficient.
   - If the VA has not connected a Veyro portal, ask its Owner/Admin to onboard the VA first.
   - If you are a Live Owner/Admin for a VA that has no portal, you can create the portal through the owner onboarding flow.
6. Veyro verifies membership on the server and adds an active pilot membership without changing an existing owner/admin role.
7. You are redirected to that VA's workspace.

The organization list is based on the Infinite Flight OAuth identity, not a list of all Veyro tenants. A pilot should only see VA portals that correspond to Live organizations they belong to.

## What a pilot can see

The organization workspace currently reads:
- Current Live organization information
- Current fleet aircraft
- Current published schedules

Data is fetched on demand from Infinite Flight through the server-side if-api Edge Function. The browser does not receive the VA's stored OAuth token. Veyro should not persist Live schedule/fleet snapshots unless the applicable Infinite Flight agreement explicitly permits it.

## Booking and crew assignment

The intended booking lifecycle is:

1. Pilot opens a schedule and reviews route, callsign, aircraft and other available details.
2. Pilot requests the leg and may include a short note.
3. The server checks the Supabase session, active Veyro membership, linked Infinite Flight identity, Live organization membership, and that the schedule still exists.
4. The server creates a Pending approval record. A partial unique index prevents duplicate active reservations for the same organization/schedule.
5. Veyro posts an approval card to the VA's configured Discord channel.
6. A permitted Discord approver approves or rejects the request.
7. On approval, Veyro calls the Live crew assignment endpoint.
8. The request becomes Approved only after Live confirms the assignment. A failed synchronization remains retryable and must not be displayed as a successful assignment.

Possible statuses:
- Pending approval
- Approved
- Rejected
- Sync failed
- Cancelled

## Identity and booking safety

Booking requests require profiles.infinite_flight_user_id. That ID must be bound to the same Infinite Flight OAuth account that the pilot authorized. Do not type or paste another person's user ID into a profile and do not trust a browser-supplied user ID.

The backend must verify the linked ID against the selected Live organization's members list before allowing a booking. If the OAuth profile identity cannot be verified against the Live member userId, the app must keep booking disabled and show a clear explanation rather than accepting an unverified ID.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| No organizations appear | Confirm you signed into the correct Infinite Flight account and that the account belongs to a Live organization. |
| VA is missing from the selection list | Ask the VA Owner/Admin whether the organization has connected a Veyro portal. |
| You can see the VA but schedules fail | Ask an admin to check the organization's Infinite Flight connection and schedule-read scope. |
| Booking says your IF account is not linked | Reconnect Infinite Flight and let the server verify the profile identity. Never enter a guessed user ID. |
| Booking says schedule is unavailable | Refresh the schedule list; the VA may have changed or removed the schedule. |
| Discord approval is not received | Ask the VA admin to check Discord integration settings and bot permissions. |
| Approval is pending for a long time | Contact the VA admin; Discord approval is an administrator-controlled step. |
| Approved request is not assigned in Live | The request may be in Sync failed. The VA admin should inspect the synchronization error and retry. |
| You cannot open a different VA | Sign in with the Infinite Flight account that is a member of that VA and select it from the organization chooser. |

Never share your email sign-in link, password, OAuth access token or refresh token with anyone.
