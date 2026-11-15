# Developer setup and self-hosting guide

This guide is for developers who fork VEYRO Live and want an independent instance with their own Supabase database, Infinite Flight OAuth application, Discord bot and Vercel deployment.

## 1. Fork and clone

1. Fork [Gurnoor1-dev/Veyro-Live](https://github.com/Gurnoor1-dev/Veyro-Live).
2. Clone your fork and create a working branch. Keep main deployable.
3. Install a current Node.js LTS release supported by Vite 7.

~~~bash
git clone https://github.com/YOUR_GITHUB_USER/Veyro-Live.git
cd Veyro-Live
git checkout -b chore/initial-self-host
npm install
~~~

Every fork should have its own Supabase project, OAuth app, Discord application/bot and deployment environment. Do not reuse another operator's secrets.

## 2. Create your Supabase project

1. Create a new project in your Supabase account.
2. Choose a strong database password and a region close to your users.
3. Wait for provisioning to finish.
4. In Project Settings → API, copy the Project URL and publishable key (or legacy anon key).
5. Put only those browser-safe values in .env.local:

~~~dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
~~~

Never use the service_role key in a VITE_* variable. Vite embeds VITE_* values in the public browser bundle.

## 3. Install and link the Supabase CLI

Install the CLI using the official instructions for your operating system. Check the version and help output because CLI commands change.

~~~bash
supabase --version
supabase --help
supabase login
supabase link --project-ref YOUR_PROJECT_REF
~~~

Verify the project reference before running database writes or deploying functions.

## 4. Create the database from migrations

The migrations in supabase/migrations are the database source of truth. They create profiles, organizations, memberships, encrypted organization and per-pilot Infinite Flight connections, Discord settings, booking requests, audit events, OAuth transactions, policies, indexes and helper functions. The pilot preview migration adds a server-only encrypted token table; it does not persist Live schedules or fleet data.

For a brand-new empty project:

~~~bash
supabase migration list
supabase db push
supabase migration list
~~~

The first command checks migration history; db push applies pending migration files in timestamp order; the final command verifies the history.

### Add a future migration

Never edit a migration that has already been applied to a shared or production database. Create a new migration:

~~~bash
supabase migration new add_your_feature
~~~

The CLI creates a timestamped SQL file under supabase/migrations. Edit that new file. Example pattern:

~~~sql
create table public.example_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null,
  created_at timestamptz not null default now()
);

alter table public.example_records enable row level security;

create policy "example_records_member_read"
on public.example_records
for select to authenticated
using (private.is_org_member(organization_id));
~~~

Before applying a migration, verify RLS on every exposed table, tenant-scoped policies, UPDATE policies with USING and WITH CHECK, restricted function execution, foreign-key indexes, and behavior on both clean and existing databases.

~~~bash
supabase db push
supabase migration list
~~~

For production changes, take a backup first and review the SQL. Never put real user data or secrets in migration files.

## 5. Configure Supabase Auth

In Authentication → URL Configuration:
- Set the Site URL to the deployed frontend URL.
- Add the local development URL and the exact production/preview callback URLs you use.
- Ensure the magic-link redirect returns to /login.
- Configure a reliable SMTP provider before inviting real users. The built-in email service has sending limits.

Test a magic link in a private browser window. For invalid redirect errors, compare scheme, host, port and path exactly with the allowlist.

## 6. Create an Infinite Flight OAuth application

Use the Infinite Flight developer portal and follow its current application approval process. Register this callback URL:

https://YOUR_PROJECT_REF.supabase.co/functions/v1/if-oauth-callback

Configure only the scopes approved for your application. The current code requests organization, member, aircraft and schedule read scopes plus schedule write permission. Confirm exact scope names and API contracts with Infinite Flight staff; do not assume approval.

Keep the OAuth client ID and secret in Supabase Edge Function secrets only.

## 7. Configure Edge Function secrets

Set secrets in Supabase Dashboard → Edge Functions → Secrets, or use the current CLI secrets command after checking supabase secrets --help.

| Secret | Purpose |
| --- | --- |
| INFINITE_FLIGHT_CLIENT_ID | OAuth client identifier |
| INFINITE_FLIGHT_CLIENT_SECRET | OAuth client secret |
| INFINITE_FLIGHT_REDIRECT_URI | Exact registered callback URL |
| APP_BASE_URL | Frontend URL used after OAuth |
| ENCRYPTION_KEY | Encrypts stored OAuth tokens |
| SUPABASE_SERVICE_ROLE_KEY | Server-side privileged database access |
| SUPABASE_ANON_KEY | Validates user sessions in Edge Functions |
| DISCORD_BOT_TOKEN | Sends approval messages |
| DISCORD_PUBLIC_KEY | Verifies signed Discord interactions |

Hosted Supabase normally provides SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY to Edge Functions automatically. Never expose the service-role key to the browser.

Generate a high-entropy encryption key with a cryptographically secure random generator and keep a protected backup. Losing it can make stored OAuth tokens unrecoverable. Never commit secrets or share them in screenshots/issues.

## 8. Deploy Edge Functions

After linking the correct project, deploy the functions:

~~~bash
supabase functions deploy if-oauth-start
supabase functions deploy if-oauth-callback
supabase functions deploy if-oauth-organizations
supabase functions deploy pilot-join
supabase functions deploy pilot-live-data
supabase functions deploy if-oauth-connect
supabase functions deploy if-api
supabase functions deploy booking-request
supabase functions deploy discord-interactions
supabase functions deploy sync-approval
supabase functions deploy health
~~~

If functions are added or renamed, update this list. Check supabase functions --help for current syntax. Confirm deployment in the dashboard and inspect logs after a test request.

## 9. Create the first organization administrator

There is no public “make me admin” button and no client-side role override.

1. The VA founder signs in using their email.
2. They authorize Infinite Flight OAuth.
3. The backend fetches the Live organizations associated with that account.
4. The backend verifies the selected organization and requires Live role Owner or Admin.
5. The backend creates the Veyro organization, stores the encrypted connection and creates the founder's Veyro membership as owner.
6. The owner can then manage additional Veyro admins through the organization administration workflow.

A normal Live Member must never be able to create the portal or elevate themselves to Veyro owner/admin. The first-owner bootstrap is performed server-side only after verifying the Live role.

## 10. Pilot sign-in and organization selection

For dashboard testing, any signed-in Infinite Flight user can select any organization returned by their own `GET /live/organizations` response, including organizations where they are only a Member and organizations not yet connected to Veyro. The `pilot-live-data` Edge Function verifies membership with the user's token and reads schedules/aircraft directly. It stores only encrypted OAuth credentials in `user_if_connections`; it does not store Live data. Apply migration `20261115130000_pilot_personal_if_connections.sql` and deploy `pilot-live-data` to enable this preview. The preview is read-only and does not bypass Infinite Flight membership checks.



A pilot does not need to own or administer a Live organization.

Expected pilot onboarding:
1. Pilot signs in with email.
2. Pilot authorizes Infinite Flight using their own account.
3. The server retrieves Live organizations associated with that OAuth identity.
4. The app matches Live organization IDs to Veyro organizations already connected by their owners.
5. The pilot selects a matched VA. A Live Member is eligible.
6. The backend creates an active Veyro pilot membership only after verifying the authenticated OAuth identity is a member of that Live organization.
7. The pilot enters that VA's dashboard.

If the Live organization has not been onboarded to Veyro, show a clear message that the VA portal is not yet available and ask the pilot to contact its owner.

**Identity security requirement:** the OAuth identity must be securely bound to the Infinite Flight userId used for crew assignment. Never trust a user ID submitted by the browser. Until this binding is proven using the currently approved Infinite Flight OAuth/API identity contract, booking submission must remain disabled rather than accepting an arbitrary pilot ID.

## 11. Configure Discord

Follow [Discord setup](DISCORD-SETUP.md). Create a Discord application and bot, invite it with minimum required permissions, configure its interaction endpoint to the deployed discord-interactions Edge Function, and store the public key and bot token as Supabase secrets.

Each Veyro organization configures its own guild, approval channel and approver role IDs. A Discord role alone is not enough: the interaction handler must also verify that the actor is an active Veyro owner/admin for that same organization.

## 12. Deploy the frontend to Vercel

1. Import your fork into Vercel.
2. Select Vite as the framework.
3. Set the root directory to the repository root.
4. Set install command npm install, build command npm run build and output directory dist.
5. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the required Production, Preview and Development environments.
6. Set the production branch to your release branch, normally main.
7. Deploy a preview first, test it, then merge/release to production.

The standalone Bun Discord bot is not the Vite frontend. Never point the static-site production branch at a branch containing only bot files.

## 13. Local checks and testing

~~~bash
npm run typecheck
npm run build
npm run preview
~~~

For database work, apply migrations to a disposable Supabase project. Test at least: VA owner, VA admin, VA pilot, Live member not yet enrolled in Veyro, authenticated non-member, and a user belonging to a different VA.

Verify tenant isolation, RLS, Discord role checks, duplicate booking prevention and failed Live synchronization. See [Security](SECURITY.md) and [Architecture](ARCHITECTURE.md).

## 14. Troubleshooting

| Symptom | Likely cause | What to check |
| --- | --- | --- |
| Backend not configured | Missing browser-safe env vars | Vercel target, exact names, redeploy |
| Magic link does not return | Redirect allowlist or SMTP | Site URL, allowed redirect, email provider logs |
| OAuth invalid state | Expired/reused callback or mismatched URL | Retry; verify exact redirect URI; inspect Edge Function logs |
| OAuth client not configured | Missing server-side secrets | Supabase Edge Function secrets |
| Organization list empty | OAuth scopes or no Live membership | Confirm membership and approved scopes |
| Owner cannot connect VA | Live role is Member or write scope missing | Only Live Owner/Admin can bootstrap |
| Pilot sees no VA choices | VA not connected to Veyro or membership lookup failed | Compare Live organization ID with Veyro organization |
| Schedules fail to load | Expired token, API outage, scope or rate limit | Function logs, token refresh, API status and Retry-After |
| Booking duplicate | Another active request exists | Booking status and partial unique index |
| Discord message missing | Bot token, channel permission or channel ID | Bot can view/send/embed; inspect logs |
| Discord action unauthorized | Wrong guild/channel/role or actor not Veyro admin | IDs, role configuration and Veyro membership |
| Live assignment missing | Crew sync failed or schedule changed | Retryable sync state and current Live schedule |
| Vercel npm executable error | Wrong branch/build environment | Build Vite frontend branch, not bot-only branch |
| RLS returns no rows | No active membership or policy/grant mismatch | Membership, active flag, grants and RLS predicates |

## 15. Production operations

- Keep database backups and test restore procedures.
- Rotate OAuth and Discord credentials if exposed.
- Record API approval, granted scopes and API version.
- Monitor Edge Function logs and database errors.
- Review dependencies and lockfile changes before merging.
- Never run destructive migration resets against production.
- Never disable RLS to make a screen load.
- Keep a tested rollback path for frontend releases and database migrations.

## 16. Contribution workflow

Use feature branches and pull requests. Include migrations for schema changes, update relevant docs, run typecheck/build and describe external setup requirements. Never commit credentials, real pilot data or production database dumps.
