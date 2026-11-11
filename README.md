# VEYRO Live Discord Bot (Bun)

Standalone Discord interactions service, written in TypeScript and designed to run on **Bun**.

## Runtime selection

Choose **Bun** in your hosting provider's runtime options. Bun provides a fast JavaScript/TypeScript runtime and an HTTP server without a separate framework.

## Install and run

```sh
bun install
bun run start
```

The server listens on the port supplied by `PORT`, or port `3000` locally.

## Environment variables

- `DISCORD_PUBLIC_KEY` — Discord application's public key
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — service-role key; keep it secret and configure only in the server environment
- `APP_BASE_URL` — optional CORS origin

Do not commit secrets or expose them in browser code.

## Discord setup

Set the Discord application's Interactions Endpoint URL to the public HTTPS URL of this service. Discord sends a signed PING to validate the endpoint.

## Approval flow

The bot verifies Discord's Ed25519 signature and timestamp, validates the configured guild, channel and approver role, then checks that the Discord account is linked to an active VEYRO organization owner/admin profile. It records the decision in Supabase and invokes the existing `sync-approval` Edge Function for approved requests.

The bot expects VEYRO Live's Supabase tables and `sync-approval` Edge Function to exist. This repository branch intentionally contains only the bot's root-level runtime files.
