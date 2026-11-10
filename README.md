# VEYRO Live

A multi-organization operations and pilot portal for Infinite Flight Live organizations.

> **Status:** Initial foundation. Infinite Flight PublicApi v3 is a preview; production use must wait for API stability and application approval.

## Product
VEYRO Live gives each participating Virtual Airline an isolated organization portal on one shared platform. Organization owners connect their Live organization, pilots sign in, browse published Live schedules, reserve a leg, and request approval. Authorized administrators can approve or reject requests through Discord. Approved assignments are synchronized to Infinite Flight Live through PublicApi v3.

## Documentation
- [Architecture](docs/ARCHITECTURE.md)
- [Organization guide](docs/ORGANISATIONS.md)
- [Pilot guide](docs/PILOTS.md)
- [Developer contribution guide](docs/CONTRIBUTING.md)
- [Security guide](docs/SECURITY.md)
- [Infinite Flight data compliance](docs/API-COMPLIANCE.md)
- [Proprietary licence](LICENSE)

## Stack
- React, TypeScript and Vite
- Supabase Auth, PostgreSQL and Edge Functions
- Vercel hosting (configuration prepared; **not deployed**)

## Local development
1. Copy `.env.example` to `.env.local` and fill in the public Supabase project URL and publishable/anon key.
2. Install dependencies with `npm install`.
3. Run `npm run dev`.
4. Apply migrations using the Supabase CLI after linking your own Supabase project: `supabase db push`.
5. Configure Edge Function secrets using the Supabase dashboard or CLI. Never put privileged secrets in Vite variables.

## Security boundary
The browser may call Supabase Edge Functions, but it must never call Infinite Flight's authenticated API directly. OAuth code exchange, token refresh, Live API requests, Discord interaction verification and V3 crew assignment belong in server-side Edge Functions.

## Current scaffold boundaries
The initial codebase includes the Vite shell, tenant schema, OAuth PKCE start/callback staging, organization selection, read-only V3 Edge Function, booking-request persistence, Discord approval message creation and signed interaction handling. The pilot identity-link flow, end-to-end Discord installation/configuration, full token-refresh race handling, production approval/retry UX and complete pilot/admin screens still need implementation and tests. Booking requests are gated until a verified Infinite Flight user ID is linked to the pilot profile.

## Important limitations
PublicApi v3 is under active development. Its endpoint contracts, scopes, response fields and approval requirements can change. Live API data-use rules also restrict retention and sharing. This scaffold deliberately does not persist mirrored fleet, member, schedule, flight-log or pilot-time snapshots. Review [API compliance](docs/API-COMPLIANCE.md) and obtain Infinite Flight approval before a public launch.

VEYRO Live is an independent third-party project and is not affiliated with Infinite Flight.
