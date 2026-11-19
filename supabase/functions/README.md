# Supabase Edge Functions

All Infinite Flight API access belongs here. The browser must call only these Edge Functions.

## Required secrets
Set these in Supabase, never in Vercel Vite variables:
- INFINITE_FLIGHT_CLIENT_ID
- INFINITE_FLIGHT_CLIENT_SECRET (confidential OAuth client only)
- INFINITE_FLIGHT_REDIRECT_URI
- TOKEN_ENCRYPTION_KEY (base64-encoded 32-byte key)
- DISCORD_APPLICATION_ID
- DISCORD_PUBLIC_KEY
- DISCORD_BOT_TOKEN
- APP_BASE_URL

The Supabase runtime provides SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.

## Deployment preparation
1. Link the Supabase project.
2. Apply migrations.
3. Set secrets.
4. Deploy functions individually with the Supabase CLI.
5. Register the Discord interactions endpoint and OAuth callback URL.
6. Test in a dedicated Infinite Flight OAuth testing client.

## Scaffold status
OAuth PKCE state handling, encrypted pending-token staging, organization selection, V3 reads, Discord approval-card creation, signed Discord interactions and a basic crew-assignment sync path are scaffolded. Pilot OAuth identity linking, bot installation/setup UX, full production token-rotation race handling, robust retries/notifications and end-to-end tests remain before production. These handlers are an initial scaffold, not a production security certification.


## Live automation

The `live-automation` Edge Function is invoked by Supabase Cron every minute. It uses the organisation's encrypted Infinite Flight OAuth connection and the configured Discord approval channel.

- **Landing dispatcher:** confirms an Arrived schedule, on-ground aircraft state and a current session/position cross-check; then notifies only the next assigned pilot. The previous pilot is displayed using the Infinite Flight username and is never mentioned.
- **12-hour schedule revisor:** when the aircraft has remained grounded for at least 12 hours and the next schedule is still Scheduled/Delayed, posts a self-service claim card. A linked active organisation pilot selects Captain or First Officer. The backend validates the organisation membership and assigns the crew member through the organisation's Admin/Owner OAuth connection.
- **No simulated test messages:** test by flying a real scheduled leg in Infinite Flight and by claiming a real eligible schedule in the configured Discord channel.
- The automation's internal invocation secret is generated and stored in Supabase Vault. Do not add it to GitHub, Vercel, browser variables or Discord.
- The worker caches only session IDs for the API-required 10-minute session refresh interval. Live responses are processed in memory and are not persisted as historical records.
