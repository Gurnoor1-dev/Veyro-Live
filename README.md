# VEYRO Live — Discord service

A lightweight Bun HTTP service for the VEYRO Live Discord approval workflow. It uses Discord's signed Interactions Endpoint; it does **not** keep a Gateway/WebSocket connection open.

## What it does

1. Receives Discord button interactions for booking request cards.
2. Verifies Discord's Ed25519 signature and rejects stale requests.
3. Confirms the request is still pending and that the click came from the exact message, guild and channel configured for that organisation.
4. Checks the configured Discord role allowlist.
5. Checks that the Discord account is linked to an active VEYRO owner/admin membership for that organisation.
6. Records the decision with a conditional update so two admins cannot both decide the same request.
7. On approval, invokes the existing `sync-approval` Supabase Edge Function. VEYRO marks a request approved only after Infinite Flight confirms the crew assignment.
8. Disables the buttons and updates the Discord message after the decision.

The existing Supabase `booking-request` Edge Function creates the pending booking and posts the approval card to the configured channel using `DISCORD_BOT_TOKEN`. This Bun service receives the resulting button interactions. The Bot Token is also used here to update the approval card after review.

## Hosting

Select **Bun** as the runtime.

Build/start command:
```sh
bun install
bun run start
```

Health check:
`GET /health`

Discord Interactions Endpoint URL:
`https://YOUR-HOST/discord/interactions`

## Environment variables

Configure these as private server-side environment variables:

| Variable | Required | Purpose |
|---|---|---|
| `DISCORD_PUBLIC_KEY` | Yes | Verifies signed Discord interactions |
| `DISCORD_BOT_TOKEN` | Yes | Updates the approval card after a decision |
| `SUPABASE_URL` | Yes | VEYRO Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only access to booking and membership records |
| `PORT` | Host-provided | HTTP listener port; defaults to 3000 |

Never expose the service-role key or bot token in frontend code or commit them to Git.

## Supabase configuration

The website's existing `booking-request` Edge Function also sends the initial Discord approval card. Keep `DISCORD_BOT_TOKEN` configured in **Supabase → Edge Functions → Secrets** as well as in this Bun host, until outbound notification delivery is moved into this service.

The existing `discord-interactions` Edge Function can remain deployed as a fallback, but the Discord Developer Portal's Interactions Endpoint URL must point to the Bun URL above when you switch over.

## Database fields used

- `booking_requests`: `id`, `organization_id`, `status`, `discord_message_id`, `discord_interaction_id`, `reviewed_by`, `reviewed_at`
- `discord_settings`: `guild_id`, `approval_channel_id`, `allowed_approver_role_ids`, `enabled`
- `profiles`: `discord_user_id`
- `organization_memberships`: active owner/admin membership
- `audit_events`: records Discord decisions

## Important current site limitation

The current Veyro-Live `main` frontend is still a foundation: it displays Live schedules and fleet data, but it does not yet expose the complete pilot booking form, Discord account-linking flow, or organisation Discord settings UI. The server validates the existing database fields, but the account-link and settings setup must be completed in the website before production use. Do not manually trust a Discord username; the link must be tied to the authenticated VEYRO profile.

## Local development

```sh
bun install
bun run dev
```

Use a private Discord test server and test organization first. Verify one rejection and one approval end to end before enabling this for real bookings.
