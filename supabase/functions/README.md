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
