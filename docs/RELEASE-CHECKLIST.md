# Release and quality checklist

This checklist is the release gate for VEYRO Live. A successful frontend build is necessary, but it does not prove that external OAuth, Supabase policies, Discord interactions or Infinite Flight crew synchronization work in production.

## Automated checks

Run these checks for every pull request and push to `main`:

~~~bash
npm install --no-audit --no-fund
npm run build
~~~

The build command runs TypeScript project checks before creating the Vite production bundle.

## Route smoke-test matrix

| Route | Expected result | Manual verification |
| --- | --- | --- |
| `/` | Public landing page and organisation directory render | Check directory loading, search, no-results and portal links |
| `/login` | Infinite Flight sign-in entry point renders | Complete OAuth start and callback with an approved test account |
| `/account` | My Veyro restores the signed-in session | Verify portal memberships, invitations and reconnect flow |
| `/apply` | Organisation application flow renders | Verify Owner/Admin eligibility, validation and tracking |
| `/application-status/:trackingCode` | Application status is scoped to the supplied tracking code | Verify valid, invalid and already-reviewed codes |
| `/:slug` | Approved public organisation portal renders | Verify logo, profile details, external links and pilot entry |
| `/:slug/pilot-sign-in` | Organisation pilot sign-in renders | Verify valid and invalid membership |
| `/:slug/pilot/:pilotId` | Pilot workspace renders for the authenticated member | Verify schedules, fleet, bookings and role restrictions |
| `/:slug/admin` | Admin control centre renders for authorized admins | Verify settings, member controls and Discord configuration |
| `/docs` and `/docs/:guide` | Documentation index and article render | Verify search, keyboard shortcut, navigation and code copy |
| Unknown route | Helpful 404 with recovery links | Verify on desktop and mobile |

## Responsive and accessibility checks

- [ ] 320px, 375px, 768px, 1024px and wide desktop layouts have no unintended horizontal page overflow.
- [ ] Public directory search is usable with touch, keyboard and screen reader.
- [ ] Documentation sidebar opens, closes with Escape, and exposes its expanded state.
- [ ] Documentation search works with Ctrl+K / Command+K and searches guide content.
- [ ] All controls have visible focus, meaningful labels and disabled/loading states.
- [ ] Light and dark themes remain readable on every public and authenticated route.
- [ ] Reduced-motion preference is respected.
- [ ] Long organization names, route codes, URLs and error messages wrap without covering controls.

## Integration and security checks

- [ ] Infinite Flight OAuth callback succeeds, rejects invalid state and handles expired authorization.
- [ ] A pilot can only see Live organizations returned for their own Infinite Flight identity.
- [ ] Organization data remains isolated between tenants under Supabase RLS.
- [ ] Non-admin users cannot access admin actions by changing routes or request payloads.
- [ ] Discord approval interactions verify guild, channel, reviewer role and request state server-side.
- [ ] Approved crew is synchronized to Infinite Flight only after a successful API response.
- [ ] Duplicate approval clicks and concurrent requests cannot assign the same seat twice.
- [ ] Failed crew synchronization is visible and can be safely retried without duplicate assignment.
- [ ] Rate limits, expired OAuth tokens and upstream API errors produce actionable messages.
- [ ] No service-role key, Discord bot token, Infinite Flight client secret or encryption key is shipped to the browser.

## Release decision

A release is ready only when the automated build passes and the route, responsive, authorization and integration checks above have been completed against a dedicated test organization. Do not use production pilots or organizations as test fixtures.

Record the test date, deployment URL, tester, test organization and any known limitations in the release notes. Keep checks that require Infinite Flight staff approval or unavailable test credentials explicitly marked as blocked; never mark them passed based on a frontend build alone.
