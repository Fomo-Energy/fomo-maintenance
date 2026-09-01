# Changelog

Status: Current

## 2026-09-01

- Added dedicated `Fomo Maintenance` secondary-calendar resolution through
  Microsoft Graph.
- Availability now combines conflicts from the primary mailbox calendar and
  the maintenance calendar.
- Paid Stripe bookings are created only in the maintenance calendar.
- Added an optional calendar-ID setting and deterministic calendar-name tests.
- Deployed the calendar separation to production on Vercel and verified live
  Microsoft Graph availability.
