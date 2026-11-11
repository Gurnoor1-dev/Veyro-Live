# VEYRO LIVE — Countdown Bot

A single-purpose Discord bot built with Bun. It publishes one custom countdown image and edits that same Discord message every minute.

## Countdown

- **Target:** 13 November 2026 at 00:00 GMT (UTC)
- **Display:** DD · HH · MM · SS
- **Command:** `/countdown`
- **Refresh:** Every minute, aligned to the minute
- **Image:** 1600 × 900 custom-designed PNG, regenerated on every refresh
- **Storage:** One small local state file containing the Discord channel/message IDs. No database and no Supabase.

The target date is intentionally fixed in `countdown.ts`; this bot supports one countdown only. After the target is reached, it publishes the completed design and stops refreshing.

## Setup

Use Bun 1.2 or newer:

```sh
bun install
bun run check
bun run start
```

For local development:

```sh
bun run dev
```

## Environment

Only one secret is required:

| Variable | Required | Purpose |
|---|---|---|
| `DISCORD_BOT_TOKEN` | Yes | Authenticates the bot with Discord |

No Supabase credentials, Discord public key, HTTP interaction endpoint, or database are used.

## Discord setup

1. Create or select the bot in the Discord Developer Portal.
2. Enable the **bot** and **applications.commands** scopes in its OAuth2 invite URL.
3. Invite it to the server.
4. Grant it **View Channel**, **Send Messages**, **Embed Links**, **Attach Files**, and **Read Message History** permissions in the channel where the countdown should appear.
5. The person running `/countdown` must have Discord's **Manage Server** permission.
6. Add `DISCORD_BOT_TOKEN` to the host's private secrets.
7. Start the service and wait for the `/countdown` command to register.

Run `/countdown` once in the channel where the image should live. Re-running the command will point to the existing countdown instead of creating another one.

## State and hosting

The bot writes `countdown-state.json` beside `index.ts` after creating the message. This is only a pointer to the single Discord message, not a database. Keep the application's working directory on persistent storage if the host replaces its filesystem on redeploy; otherwise the bot may not be able to rediscover the previous message after a restart.

The bot needs to remain running for minute-by-minute image updates. A serverless/scale-to-zero host is not suitable for this workload.

## Project files

- `index.ts` — Discord Gateway client, slash-command registration, single-message lifecycle and minute scheduler.
- `countdown.ts` — Fixed target, DD HH MM SS calculation and premium countdown image renderer.
- `package.json` — Bun scripts and runtime dependencies.
