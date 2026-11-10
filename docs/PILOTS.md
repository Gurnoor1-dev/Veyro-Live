# Pilot guide

## Joining your organization's VEYRO Live portal
1. Open the portal link supplied by your Virtual Airline.
2. Sign in using the approved Infinite Flight authentication flow.
3. Select the organization you belong to, if prompted.
4. Complete the organization's membership verification.
5. Open your pilot dashboard.

## Finding a flight
- **Available flights** shows schedules currently published in Infinite Flight Live.
- Open a flight to inspect the live schedule details returned by the API.
- Select **Request this leg** to send a booking request to your organization.
- A request is pending until an administrator approves it.
- Once approved and successfully synchronized with Live, the flight appears under **My bookings** as confirmed.

## Request statuses
- **Pending approval:** submitted and waiting for an administrator.
- **Approved:** administrator approved and V3 confirmed the crew assignment.
- **Rejected:** administrator declined the request.
- **Sync failed:** administrator approved, but Live did not confirm the assignment. The organization administrator must retry or resolve it.
- **Cancelled:** request was withdrawn or cancelled.

## Booking rules
The initial VEYRO Live booking model allows one active reservation per schedule. A schedule becomes unavailable to other pilots while a reservation is active. If an administrator rejects or a pilot cancels a request, the reservation may become available again.

The Live schedule is still authoritative. If it is removed, changed, or assigned outside VEYRO, the portal must re-check its status before showing a reservation as confirmed.

## Important
VEYRO Live is a simulated-flight tool. It is not intended for real-world aviation dispatch or operational flight planning. Never share your Infinite Flight password or authentication tokens with anyone.
