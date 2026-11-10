# Security

## Secret placement

### Vercel environment variables
Only browser-safe configuration belongs in Vercel's Vite build environment:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (or the publishable key)

Vite embeds VITE_ variables into the client bundle. Never put secrets there.

### Supabase Edge Function secrets
Configure these only in the Supabase project secret store:
- `INFINITE_FLIGHT_CLIENT_ID`
- `INFINITE_FLIGHT_CLIENT_SECRET` (confidential client only; if using a public client, omit it)
- `INFINITE_FLIGHT_REDIRECT_URI`
- `TOKEN_ENCRYPTION_KEY` (32-byte key encoded as base64)
- `DISCORD_APPLICATION_ID`
- `DISCORD_PUBLIC_KEY`
- `DISCORD_BOT_TOKEN`
- `APP_BASE_URL`

The Supabase runtime provides SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY; never copy the service-role key to the frontend.

## OAuth
Use Authorization Code + PKCE. Validate one-time state and the PKCE verifier. Exchange and refresh tokens server-side. Encrypt token material at rest using AES-GCM and rotate refresh tokens atomically. Never log authorization codes, access tokens, refresh tokens or secrets.

## Edge Functions
- Require a valid Supabase user session for user-facing operations.
- Derive user identity from verified JWT claims, never request body fields.
- Resolve the organization from authenticated tenant membership.
- Use a strict endpoint allowlist; do not expose a generic URL proxy.
- Validate Discord Ed25519 signatures against the exact raw request body and timestamp.
- Enforce Discord guild, channel and role allowlists.
- Make approval actions idempotent and audit who approved/rejected.
- Rate-limit OAuth, booking and Discord interaction routes.
- Return minimal error messages; keep provider response bodies and secrets out of client errors.

## Database
RLS is enabled for every public table. Tenant reads require a matching organization membership. Writes are restricted to the pilot's own booking requests or organization admins. Integration credentials and internal audit data are not directly accessible to authenticated browser clients.

## Incident response
If a secret is exposed, rotate it immediately in its provider dashboard, invalidate affected sessions/tokens, inspect logs, and remove the secret from repository history. Deleting the latest file alone is not sufficient.
