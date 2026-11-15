# Organisation portal applications

## Applicant flow

1. Sign in to VEYRO Live with email magic link.
2. Connect the applicant's own Infinite Flight account.
3. Choose a Live organisation where the applicant is an Owner or Admin. Member-only access cannot submit an application.
4. Confirm the automatically fetched Live organisation identity and role, then provide the public portal name, preferred slug, tagline, description, optional website and Discord invite, and organisation logo.
5. Submit the application. VEYRO creates a high-entropy tracking code and posts the full application to the configured Discord review channel.
6. The applicant can open `/application-status/<tracking-code>` to see Pending, Approved or Rejected status and public reviewer notes.

The tracking code is displayed only once after successful submission. The database stores only its SHA-256 hash. Treat the code like a private access credential.

## Discord review setup

Configure these Supabase Edge Function secrets:

- `DISCORD_BOT_TOKEN`: bot token for the VEYRO review bot.
- `DISCORD_APPLICATION_GUILD_ID`: ID of the Discord server where applications are reviewed.
- `DISCORD_APPLICATION_CHANNEL_ID`: ID of the review channel in that server.
- `DISCORD_APPLICATION_REVIEWER_ROLE_IDS`: comma-separated Discord role IDs allowed to approve, reject and add notes.
- `DISCORD_PUBLIC_KEY`: Discord application public key used to verify signed interactions.
- `APP_BASE_URL`: exact public web origin used by Edge Function CORS and OAuth callback redirects.

The bot needs View Channel, Send Messages and Embed Links in the review channel. In the Discord Developer Portal, set the Interactions Endpoint URL to:

```
https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/organization-application-discord
```

Discord sends signed button and modal interactions to that endpoint. The endpoint verifies the signature, server, channel and reviewer role before applying a decision. Reviewers can add a note from the application embed; notes appear on the applicant's tracking page.

## Approval result

Approval creates the public organisation record, assigns the applicant the initial VEYRO owner membership, attaches the applicant's encrypted Infinite Flight connection, and publishes the organisation in the homepage directory. The requested slug is checked again at approval time. Rejected applications do not create a public portal and can be resubmitted.

## Database and storage

Apply `supabase/migrations/20261115150000_organization_application_portals.sql` before deploying the two new functions. The migration creates private application and note tables, adds public profile fields to organisations, and creates the public-read `organization-logos` bucket. Application tables have RLS enabled and no direct client grants; reads and writes go through Edge Functions with the service-role key.

Deploy:

- `organization-application` with JWT verification enabled.
- `organization-application-discord` with JWT verification disabled because it verifies Discord Ed25519 request signatures itself.

Do not put the Discord bot token, service-role key, encryption key or Infinite Flight OAuth secret in Vercel client environment variables.
