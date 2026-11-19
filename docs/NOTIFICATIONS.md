# VEYRO Live notification channels

VEYRO Live keeps booking approvals separate from automated operations notifications. Configure these destinations in **Organisation Admin → Notifications**.

## Channel destinations

| Setting | Purpose |
| --- | --- |
| Live Dispatch | A confirmed landing dispatch for the next assigned pilot. |
| Unassigned Legs | The first eligible schedule for an aircraft when it has no preceding completed leg and no assigned crew. The message includes the self-service Assign action. |
| Schedule Revisor | Eligible scheduled or delayed legs after the revisor threshold. The message includes the self-service Assign action. |
| Live Activity | Reserved destination for organisation activity-log messages. |

The **Discord Integration** page separately stores the server ID, booking approvals channel ID and permitted reviewer role IDs. Booking Approve / Reject interactions continue to use that approval channel.

## Database migration

The migration `20261119115558_discord_notification_channels.sql` adds the four optional text columns to `public.discord_settings`. It does not overwrite any existing channel IDs.

## Set channel IDs with SQL

After applying the migration, replace each placeholder below with the channel ID copied from Discord Developer Mode. Keep the values quoted.

~~~sql
UPDATE public.discord_settings
SET
  landing_dispatch_channel_id = NULLIF('PASTE_LIVE_DISPATCH_CHANNEL_ID', 'PASTE_LIVE_DISPATCH_CHANNEL_ID'),
  unassigned_legs_channel_id = NULLIF('PASTE_UNASSIGNED_LEGS_CHANNEL_ID', 'PASTE_UNASSIGNED_LEGS_CHANNEL_ID'),
  schedule_revisor_channel_id = NULLIF('PASTE_SCHEDULE_REVISOR_CHANNEL_ID', 'PASTE_SCHEDULE_REVISOR_CHANNEL_ID'),
  approval_channel_id = 'PASTE_BOOKING_APPROVALS_CHANNEL_ID',
  activity_log_channel_id = NULLIF('PASTE_LIVE_ACTIVITY_CHANNEL_ID', 'PASTE_LIVE_ACTIVITY_CHANNEL_ID')
WHERE organization_id = 'PASTE_ORGANIZATION_UUID';
~~~

Replace `PASTE_ORGANIZATION_UUID` with the target organisation's UUID from `public.organizations`. The `WHERE` clause is intentional: it prevents channel IDs from being overwritten across every organisation.

Blank notification destinations disable that notification type. Keep the booking approvals channel configured separately.

## Discord permissions

The bot needs View Channel and Send Messages in each configured destination. For Unassigned Legs and Schedule Revisor, it also needs permission to use the interaction components delivered with the message. Do not make these channels public unless that is intentional for your organisation.


## Automation cadence

The `veyro-live-automation` cron job runs every five minutes (`*/5 * * * *`). This reduces Infinite Flight polling while preserving the existing eligibility checks and idempotent event delivery.

## Test a notification

Open **Organisation Admin → Notifications**, choose a notification destination in **Send a test notification**, and press **Send test embed**. The server verifies the signed-in organisation administrator, uses the saved channel ID, and sends the corresponding automation-style embed with sample data. The test does not call the Infinite Flight API, create an automation event, or change a schedule. Claim buttons in test messages are disabled. The Live Activity option tests channel permissions and the example activity-log layout; it does not enable an activity-log publisher.
