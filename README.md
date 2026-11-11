# VEYRO Live — Discord interactions bot

This branch contains only the standalone Discord interactions service. It is intentionally kept at the repository root rather than inside a `Discord bot/` directory.

## Runtime

- Deno
- Supabase JS client
- Discord Interactions Endpoint (HTTP; no Gateway process or privileged message-content intent)

## Required environment variables

- `DISCORD_PUBLIC_KEY` — application public key from Discord Developer Portal
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — service-role key; keep private and configure only in the server runtime
- `APP_BASE_URL` — optional allowed origin for CORS responses

Never commit secrets or place them in frontend code.

## Run locally

```sh
deno task check
deno task start
```

Configure the Discord application's **Interactions Endpoint URL** to the deployed HTTPS endpoint for this service. Discord sends a signed PING during endpoint validation.

## Approval flow

The service verifies Discord's Ed25519 signature and timestamp, validates the configured guild, channel, and approver role, then verifies that the Discord account is linked to an active VEYRO organization owner/admin profile. It records the decision in Supabase and invokes the `sync-approval` Edge Function for accepted requests.

The service expects the VEYRO Live database tables and Edge Function to exist in the connected Supabase project. It does not include frontend, database migrations, or unrelated application files.
