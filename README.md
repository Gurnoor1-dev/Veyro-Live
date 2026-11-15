# VEYRO Live

VEYRO Live is a multi-tenant operations portal for Infinite Flight Live Virtual Airlines. Each VA receives an isolated workspace where pilots can discover published schedules, request flight legs, track approval, and view fleet information. Authorized VA administrators manage their portal and review booking requests through Discord.

> **Project status:** Active development. The repository contains the Vite client, Supabase schema and Edge Functions for OAuth, Live data access, booking requests and Discord approvals. Before public production use, complete the deployment checklist, verify the current Infinite Flight API contract/scopes with Infinite Flight staff, and run the end-to-end tests described below.

## What the platform does

- **One portal, multiple VAs:** every organization is isolated by organization membership and PostgreSQL Row Level Security.
- **Infinite Flight is the source of truth:** organization, aircraft and schedule data are fetched from the Live API when needed. Veyro does not mirror schedule/fleet/member snapshots into its database.
- **Pilot workspace:** authenticated pilots should be able to choose any Veyro-connected VA for which their Infinite Flight account is a member, including when their Live role is Member. Pilot access is separate from VA administrator privileges.
- **Booking workflow:** pilots request an available schedule; the server validates membership and current schedule state, stores a pending request, and sends a Discord approval message. Approval triggers a Live crew assignment; a booking is shown as approved only after synchronization succeeds.
- **VA administration:** organization owners/admins connect the VA, manage portal settings and members, configure Discord approval, and review operational activity.
- **Secure integrations:** Infinite Flight client secrets, OAuth tokens, Discord bot tokens, Supabase service-role keys and encryption keys stay in Supabase Edge Function secrets. Never put them in Vite environment variables.

## User journeys

### VA owner / first administrator

1. Create a Supabase project and deploy the migrations.
2. Configure the required Supabase Edge Function secrets.
3. Deploy the web client and configure the public Supabase URL/key.
4. Open the site, sign in by email magic link, and authorize Infinite Flight.
5. Select the Live organization where the authorizing account is an Owner or Admin.
6. Create the Veyro portal slug and display name. The OAuth connection creates the first Veyro owner membership.
7. Configure the Discord bot, guild, approval channel and approver roles.
8. Invite pilots by sharing the portal URL. Pilots authenticate independently and must be current Live members.

### Pilot

1. Open the VA portal or the global sign-in page and authenticate with email.
2. Connect Infinite Flight to prove which Live organizations the pilot belongs to.
3. Select a VA from the matched Veyro organizations. A Live Member is eligible; the pilot does not need to be an Owner/Admin.
4. Enter the pilot workspace. The app loads current schedules and fleet data from Live through the server-side Edge Function.
5. Open a schedule, review the route and details, and request the leg.
6. Track the request as Pending, Approved, Rejected, Cancelled or Sync failed.
7. On approval, Veyro asks Infinite Flight Live to assign the pilot to the schedule. The app must not show a successful assignment until the Live API confirms it.

**Important:** membership discovery and safe binding of the authenticated OAuth identity to the Infinite Flight userId are separate security requirements. Do not trust a pilot-entered user ID or a client-supplied organization ID. See [Pilot identity and onboarding](docs/PILOTS.md) and [the implementation notes](docs/DEVELOPER-SETUP.md).

## Documentation

| Guide | Purpose |
| --- | --- |
| [Developer setup](docs/DEVELOPER-SETUP.md) | Fork, create Supabase, migrations, secrets, first admin, local development, deployment and troubleshooting |
| [Architecture](docs/ARCHITECTURE.md) | System boundaries, data flow, tenancy and integration design |
| [Organization guide](docs/ORGANISATIONS.md) | Owner/admin setup, VA onboarding and organization lifecycle |
| [Pilot guide](docs/PILOTS.md) | Pilot sign-in, membership selection, schedules and bookings |
| [Discord setup](docs/DISCORD-SETUP.md) | Bot permissions, interactions endpoint and approval channel |
| [Security guide](docs/SECURITY.md) | RLS, secrets, OAuth, roles and production hardening |
| [API compliance](docs/API-COMPLIANCE.md) | Infinite Flight API data-use and retention requirements |
| [Infinite Flight testing compliance](docs/INFINITE-FLIGHT-TESTING-COMPLIANCE.md) | Testing limits and operational safeguards |
| [Contributing](docs/CONTRIBUTING.md) | Branching, migrations, reviews and coding standards |

## Technology

- React 19, TypeScript, Vite and React Router
- Supabase Auth and PostgreSQL with RLS
- Supabase Edge Functions (Deno) for privileged server-side work
- Infinite Flight OAuth and Public API v3
- Discord interactions and bot messaging
- Vercel for static frontend hosting

## Quick start

~~~bash
git clone https://github.com/Gurnoor1-dev/Veyro-Live.git
cd Veyro-Live
cp .env.example .env.local
npm install
npm run dev
~~~

Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local. These are browser-safe project values; they are not service-role credentials. For a complete clean-room setup, follow [Developer setup](docs/DEVELOPER-SETUP.md).

## Commands

~~~bash
npm run dev        # local Vite development server
npm run typecheck  # TypeScript project checks
npm run build      # production TypeScript + Vite build
npm run preview    # preview the built dist/ directory
~~~

## Supabase layout

- supabase/migrations/ — ordered, timestamped SQL migrations
- supabase/functions/ — deployable Edge Functions
- supabase/functions/_shared/ — shared HTTP, encryption, OAuth and Infinite Flight helpers
- supabase/config.toml — local Supabase CLI function configuration

Apply migrations in order with supabase db push. Never manually edit an already-applied migration on a shared environment; create a new migration for every schema change.

## Security and product boundaries

- The browser never receives Infinite Flight client secrets, access/refresh tokens, Discord bot tokens, encryption keys or Supabase service-role keys.
- The Edge Functions validate the Supabase session and organization membership before accessing tenant data.
- PostgreSQL RLS is the final database access boundary; hiding a button in React is not authorization.
- Live schedules and fleet remain authoritative in Infinite Flight. Avoid retaining Live data unless the current API agreement explicitly allows it.
- Discord button interactions must be signature-verified and must check both configured Discord roles and Veyro organization administrator membership.
- Booking status must reflect the actual Live crew synchronization result, not merely a Discord button click.

## Before public launch

- [ ] Confirm the current Infinite Flight API version, OAuth scopes, redirect URI and data-use rules with Infinite Flight staff.
- [ ] Apply all migrations to a clean Supabase project and run database advisors.
- [ ] Deploy every Edge Function and configure all secrets.
- [ ] Configure Supabase Auth redirect URLs and email delivery.
- [ ] Configure Discord application interactions URL, bot permissions and approver roles.
- [ ] Verify pilot identity binding; do not enable booking if it is not secure.
- [ ] Test owner, admin, pilot, non-member and cross-tenant access separately.
- [ ] Test duplicate requests, stale schedules, Discord delivery failures, rejected requests and failed Live sync.
- [ ] Point Vercel production at the frontend branch and run a clean production build.
- [ ] Review [Security](docs/SECURITY.md) and [API compliance](docs/API-COMPLIANCE.md).

VEYRO Live is independent third-party software and is not affiliated with Infinite Flight.
