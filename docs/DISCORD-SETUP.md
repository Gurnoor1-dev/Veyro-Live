# Discord integration setup

VEYRO Live uses a serverless Discord interactions endpoint. There is no always-on bot process to host or keep online. The Supabase Edge Functions send approval messages with the bot token and receive signed button interactions through Discord's Interactions Endpoint URL.

## 1. Create the Discord application

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Create an application and open **Bot**.
3. Add a bot user and copy its token once. Store it only as the Supabase Edge Function secret `DISCORD_BOT_TOKEN`.
4. On **General Information**, copy the **Public Key** and store it as `DISCORD_PUBLIC_KEY`.
5. Copy the **Application ID** for your records. The current Edge Function code does not read `DISCORD_APPLICATION_ID`; it is useful for generating the install URL and identifying the app.

## 2. Configure the interactions endpoint

Set the application's **Interactions Endpoint URL** to:

```
https://nzdsuodhxgarsuhuiqmj.supabase.co/functions/v1/discord-interactions
```

Discord sends a PING when validating this URL. The endpoint must have `DISCORD_PUBLIC_KEY` configured before Discord can verify it.

## 3. Install the bot in each VA server

Use the Developer Portal's Installation page. Grant the bot these permissions in every configured destination channel:

- View Channel
- Send Messages
- Embed Links
- Read Message History (only if the deployment later needs to inspect existing messages)

The interaction endpoint handles button clicks. It does not require message-content intent or an always-on gateway connection.

## 4. Configure Supabase secrets

In Supabase → Edge Functions → Secrets, add:

- `DISCORD_BOT_TOKEN`
- `DISCORD_PUBLIC_KEY`

Never put either value in Vercel environment variables, frontend code, GitHub, or a message to support.

## 5. Configure an organisation

Open the organisation's **Admin Panel → Discord Integration** page and set:

- Discord Server ID.
- Booking Approvals Channel ID.
- Allowed Approver Role IDs (comma-separated).

Booking Approve / Reject cards continue to use only the Booking Approvals channel.

Then open **Admin Panel → Notifications** and set the dedicated destinations:

- **Live Dispatch** — confirmed landing dispatch for the next assigned pilot.
- **Unassigned Legs** — first eligible unassigned schedule; includes the self-service Assign action.
- **Schedule Revisor** — eligible scheduled/delayed legs after the revisor threshold; includes the self-service Assign action.
- **Live Activity** — destination field for organisation activity-log notifications.

Leave an optional notification destination blank to disable that notification type. All channel IDs must belong to the configured Discord server.

Approvers must:
- Be in the configured guild.
- Click a button in the configured Booking Approvals channel.
- Hold at least one configured allowed Discord role.
- Also be linked to an active VEYRO organisation owner/admin account.

Self-service schedule claims are validated against the Unassigned Legs or Schedule Revisor channel matching the message type.

## 6. Test safely

Use a private test server and an Infinite Flight OAuth test account. Submit one test request, reject it, then submit another and approve it. Confirm that the Discord interaction is acknowledged, the request is authorized, and Live confirms the crew assignment before showing it as approved.

Do not use production bookings for initial testing. Infinite Flight PublicApi v3 is still a preview, and its data-use rules must be reviewed before enabling persisted booking requests or sending Live-derived details into Discord.
