# Changelog

Status: Current

## 2026-09-02

- Added a mutually exclusive S$0.50 Testing checkout for live Stripe and
  calendar-flow validation, explicitly carrying no service entitlement.
- Added `TESTING` service code, server-recomputed test pricing, Stripe metadata,
  calendar labeling, and customer/operations safeguards.

## 2026-09-01

- Replaced stepped Condition & Standard pricing with Essential Health Check and
  Electrical Assurance packages plus independent cleaning and monitoring.
- Added server-recomputed, whole-SGD line-item pricing and package service codes.
- Hardened checkout parsing and calendar fulfillment with single-line customer
  fields, strict numeric input, Graph transaction IDs, and retryable webhook
  failures.
- Removed the customer roof-access question; cleaning and monitoring now carry
  explicit manual confirmation statuses.
- Deferred other-installer onboarding until durable first-visit history exists.
- Added dedicated `Fomo Maintenance` secondary-calendar resolution through
  Microsoft Graph.
- Availability now combines conflicts from the primary mailbox calendar and
  the maintenance calendar.
- Paid Stripe bookings are created only in the maintenance calendar.
- Added an optional calendar-ID setting and deterministic calendar-name tests.
- Deployed the calendar separation to production on Vercel and verified live
  Microsoft Graph availability.
