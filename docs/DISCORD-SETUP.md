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

Use the Developer Portal's Installation page. Grant only the permissions needed in the chosen approval channel:

- View Channel
- Send Messages
- Embed Links
- Read Message History (only if the deployment later needs to inspect existing messages)

The current flow posts approval cards directly to the configured channel. It does not require message-content intent or a gateway connection.

## 4. Configure Supabase secrets

In Supabase → Edge Functions → Secrets, add:

- `DISCORD_BOT_TOKEN`
- `DISCORD_PUBLIC_KEY`

Never put either value in Vercel environment variables, frontend code, GitHub, or a message to support.

## 5. Configure an organization's approval channel

The current database stores one Discord guild and approval channel per organization, plus an allowlist of Discord role IDs. The current frontend does not yet provide a settings screen for these values, so do not enable approvals until an authenticated admin-only setup path has been deployed and verified.

Approvers must:
- Be in the configured guild.
- Click a button in the configured approval channel.
- Hold at least one configured allowed Discord role.
- Also be linked to an active VEYRO organization owner/admin account.

## 6. Test safely

Use a private test server and an Infinite Flight OAuth test account. Submit one test request, reject it, then submit another and approve it. Confirm that the Discord interaction is acknowledged, the request is authorized, and Live confirms the crew assignment before showing it as approved.

Do not use production bookings for initial testing. Infinite Flight PublicApi v3 is still a preview, and its data-use rules must be reviewed before enabling persisted booking requests or sending Live-derived details into Discord.
