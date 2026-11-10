# Organization guide

This guide is for Live organization owners and administrators launching a portal on VEYRO Live.

## Before onboarding
- Your Infinite Flight account must be an Owner or Admin of the target Live organization for schedule/crew write operations.
- Create an Infinite Flight PublicApi v3 OAuth client and register the exact callback URL supplied by VEYRO.
- Request only the scopes required by the product: `openid profile offline_access live:organizations.read live:members.read live:aircraft.read live:schedules.read live:schedules.write`.
- During the API preview, OAuth testing clients are limited to their owner and up to five invited test users until the app is reviewed.

## Launch checklist
1. Sign in to VEYRO Live and choose **Connect organization**.
2. Complete Infinite Flight authorization.
3. Select the organization returned for your account.
4. Confirm the role shown by Live. The account used for assignment sync must be an Owner/Admin with `live:schedules.write`.
5. Choose an organization slug and display settings.
6. Connect the VEYRO Discord bot to your server.
7. Select the approval channel and configure the Discord role IDs allowed to approve requests.
8. Test a request using a test pilot and verify both the Discord action and the resulting Live crew assignment.
9. Share your portal URL: `/org/<your-slug>`.

## Schedule publishing
Schedules are created, edited, reordered and removed in Infinite Flight Live. VEYRO Live reads the current published schedule list; it is not an alternative schedule editor.

A pilot can request a published schedule. The request is not a confirmed crew assignment until an authorized administrator approves it and the V3 assignment endpoint confirms success.

## Discord approvals
- Keep the approval channel private to trusted staff.
- Configure only trusted Discord role IDs.
- Do not share the bot token or OAuth credentials.
- Use the Discord message's Approve/Reject controls; do not approve requests by forwarding or editing messages.
- If V3 is temporarily unavailable, the request remains in a retryable sync-failed state and must not be shown as confirmed.
- Discord role membership is checked at interaction time; VEYRO app administrator status is also required.

## Disconnecting
Disconnecting Infinite Flight revokes or invalidates the integration where supported, removes stored encrypted credentials and stops synchronization. Pending reservations should be resolved or cancelled first. Live API-derived transient data is discarded.
