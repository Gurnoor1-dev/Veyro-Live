# Organization owner and administrator guide

## Organization model

Every VA has one isolated Veyro organization record linked to exactly one Infinite Flight Live organization ID. The portal slug is the public URL segment; the display name and optional logo are presentation settings. Memberships are stored separately from Infinite Flight roles.

Veyro roles:
- **Owner:** initial portal creator and highest-level organization administrator.
- **Admin:** can manage the VA's Veyro settings and approve operational workflows.
- **Pilot:** can access the pilot workspace and request eligible flights.

Infinite Flight roles are separate. A Live Member can join an existing Veyro portal as a pilot. Only a Live Owner/Admin can create a new Veyro portal and establish its first Veyro owner.

## Connect a VA for the first time

1. Sign in to Veyro using your email.
2. Authorize Infinite Flight.
3. Choose the Live organization where your Infinite Flight role is Owner or Admin.
4. Enter a display name and unique URL slug.
5. Confirm the connection. The server verifies the Live role and required schedule-write scope.
6. Veyro creates the organization, encrypts and stores the OAuth tokens server-side, and adds the creator as the Veyro owner.

The first owner is created by the server-side if-oauth-connect function. There is no public endpoint that lets a user promote themselves.

## Invite and onboard pilots

Share the VA portal URL with pilots. Each pilot signs in with their own email and authorizes their own Infinite Flight account. They select the VA from the list of Live organizations returned for that account. The server matches the Live organization ID to the Veyro portal and adds a pilot membership after verifying the membership. The pilot does not need Live Owner/Admin privileges.

If a VA is not shown, check that:
- The VA owner completed initial portal connection.
- The Live organization ID is the expected one.
- The pilot's Infinite Flight account is an active member of that organization.
- The OAuth client has the approved organization-read scope.

## Discord approval setup

Follow [Discord setup](DISCORD-SETUP.md). Configure a guild, approval channel and allowed approver roles for each organization. The Discord interaction endpoint must verify the signature, guild, channel, Discord role and the actor's Veyro owner/admin membership for the same organization.

## Schedule and fleet data

Infinite Flight Live remains the source of truth. Veyro reads the current organization, aircraft and schedule data through the if-api Edge Function. Do not use Veyro as a second schedule editor or persist a mirrored schedule database unless Infinite Flight has explicitly approved the data use and retention.

## Booking review

Pilots create pending requests. The approval message includes pilot, route, callsign and request ID. Admins review it in the configured channel. Approval is not complete until the crew assignment call succeeds in Live. If synchronization fails, retain a retryable state and inspect the server logs; do not tell the pilot the crew assignment succeeded.

## Operational checklist

- Keep the OAuth connection valid and rotate credentials if compromised.
- Confirm Discord bot permissions and channel access.
- Keep allowed approver roles limited to trusted staff.
- Review membership changes and audit events.
- Monitor Edge Function logs and rate-limit responses.
- Do not share or expose OAuth tokens, encryption keys or service-role credentials.
- Keep a separate test organization for destructive testing.


## Organization control center

Open `/:slug/admin` as an active Owner/Admin to edit the public organization profile, update the administrator display name, manage pilot invitations, choose booking policy, configure Discord reviewer roles, and manage schedules.

### Fleet and schedule operations

The schedule editor groups schedules under each persistent aircraft record. Create, edit, update flight plans, and delete operations are sent to Infinite Flight PublicApi v3 using the encrypted organization OAuth connection. The connected account must retain `live:schedules.write` and an Infinite Flight Owner/Admin role. VEYRO does not create a duplicate schedule database.

### Booking approval policy

- **Manual review:** pilot requests are posted to the configured Discord channel with Approve and Reject buttons. The configured Discord server, channel, role allowlist, and linked Veyro Owner/Admin membership are checked before a decision is accepted.
- **Pre-approved:** the request is assigned directly to the Live schedule using the crew assignment endpoint. A booking is only shown as approved after Live confirms the assignment.

After a successful manual approval, the original Discord message is replaced with a compact status card naming the reviewer. If Live synchronization fails, the booking remains in a retryable synchronization state.


Live fleet, schedule, and member responses are cached in memory for up to 30 seconds to reduce duplicate PublicApi v3 calls. Mutating admin actions invalidate the admin portal cache. Live API data is not persisted as a local copy.
