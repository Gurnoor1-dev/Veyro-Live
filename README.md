# VEYRO LIVE — Discord Integration

The Bun service combines the original VEYRO LIVE booking-approval integration with a single-message countdown.

## Existing VEYRO LIVE booking workflow

The original Discord interaction endpoint and its booking workflow are retained:

- Discord Ed25519 signature verification and interaction endpoint at `/discord/interactions`
- Approve/reject booking buttons
- Organisation approval-channel and allowed-role checks
- VEYRO profile and active owner/admin membership verification
- Supabase booking status updates and audit events
- Infinite Flight approval synchronisation through the `sync-approval` Supabase Edge Function
- Health checks at `/` and `/health`

The existing booking workflow continues to use Supabase. The countdown does not use Supabase.

## Countdown

- **Target:** 13 November 2026 at 00:00 GMT (UTC)
- **Display:** DD · HH · MM · SS
- **Command:** `/countdown`
- **Refresh:** The same Discord message is edited every minute
- **Image:** 1600 × 900 custom-designed PNG, regenerated on every refresh
- **Storage:** A local `countdown-state.json` file stores the channel and message identifiers only

The target is fixed in `countdown.ts`. Only one countdown message is maintained. After the target is reached, the completed design is published and automatic refreshes stop.

The `/countdown` command is registered automatically at startup and requires the Discord **Manage Server** permission.

## Setup

Use Bun 1.2 or newer:

```sh
bun install
bun run check
bun run check:countdown
bun run start
```

For local development:

```sh
bun run dev
```

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `DISCORD_BOT_TOKEN` | Yes | Bot authentication, message posting and slash-command registration |
| `DISCORD_PUBLIC_KEY` | Yes | Verifies signed Discord HTTP interactions |
| `SUPABASE_URL` | Yes | Existing VEYRO LIVE booking integration |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Existing server-side booking and audit operations |

Keep all credentials in the host's private environment/secrets. Never commit them.

## Discord setup

1. Keep the bot installed in the server with the `applications.commands` scope.
2. Configure the Discord Interactions Endpoint URL to point to this service's `/discord/interactions` route.
3. Ensure the bot has **View Channel**, **Send Messages**, **Embed Links**, **Attach Files**, and **Read Message History** in the countdown channel.
4. Ensure the bot has permission to manage application commands, or use a token/application configuration that permits command registration.
5. Add all four environment variables above to the host.
6. Start the service. It registers `/countdown` automatically.

Run `/countdown` in the channel where the countdown should appear. Running it again returns the existing message instead of creating another one.

## State and hosting

The countdown stores `countdown-state.json` beside the application. This file is only a pointer to the Discord message; it contains no booking or user data. Keep the application's working directory on persistent storage if the host replaces its filesystem on redeploy. Otherwise, the bot may lose the pointer and could create a second countdown after a restart.

The process must remain running for minute-by-minute image updates. A serverless or scale-to-zero host is not suitable for the countdown scheduler.

## Project files

- `index.ts` — Original VEYRO LIVE HTTP interaction service, booking approval workflow, and countdown command dispatch/registration.
- `countdown.ts` — Countdown state, Discord message lifecycle, minute scheduler, and custom image renderer.
- `package.json` — Bun scripts and dependencies for both systems.
