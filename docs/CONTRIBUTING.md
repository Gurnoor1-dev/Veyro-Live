# Contribution guide

Thank you for your interest in VEYRO Live. The project is proprietary; contributions are accepted only from people who have received explicit permission from the VEYRO project owner.

## Before contributing
- Read the root [LICENSE](../LICENSE).
- Obtain written authorization before submitting code, design work, documentation or derivative material.
- Do not copy secrets, production data, user tokens or private Discord content into issues or pull requests.
- Do not add dependencies without a clear reason; pin versions and commit the lockfile.

## Development setup
1. Install a supported Node.js LTS release.
2. Copy `.env.example` to `.env.local`.
3. Add only the Supabase project URL and public browser key.
4. Run `npm install` and `npm run dev`.
5. Use a dedicated development Supabase project.
6. Apply migrations with the Supabase CLI.
7. Configure Edge Function secrets separately in Supabase.

## Project conventions
- React components contain presentation and interaction only.
- All Infinite Flight API access belongs in Supabase Edge Functions.
- Keep API request/response mapping in `supabase/functions/_shared`.
- Validate every request server-side; never trust a tenant slug or role supplied by the browser.
- Use database transactions and idempotency for booking and approval operations.
- Enable RLS on every exposed table.
- Never persist mirrored Live data or create historical analytics from it.
- Keep secrets out of Git, Vite variables, browser bundles and logs.

## Pull requests
Include a clear problem statement, implementation summary, tenant-isolation and RLS impact, API scopes/endpoints affected, migration and rollback considerations, tests, and screenshots for UI changes. Do not deploy or run production migrations from a contribution branch.
