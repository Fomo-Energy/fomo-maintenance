# Booking Flow Hardening and Polish Audit

Status: Historical

Date: 2026-09-03

## Scope

Independent QA/QC and UI/UX reviews examined the public quote and booking flow,
Stripe lifecycle handling, database reservations, Microsoft calendar
fulfilment, customer manage access, document upload, rescheduling,
transactional email, environment separation, mobile layout, accessibility, and
recovery messages. The reviews were intentionally constrained to polishing the
existing one-page journey rather than redesigning it.

## Principal findings

- A Checkout Session was created before its database hold. Two concurrent
  customers could therefore reach Stripe for the same appointment.
- Checkout expiry and asynchronous payment events did not release or fulfil
  database holds.
- Refunds and disputes did not update the booking, calendar, manage credential,
  or operations workflow.
- Public availability and Checkout routes had no application rate limits.
- GitHub CI ran only part of the repository verification suite.
- A seven-column mobile calendar overflowed a 375 px viewport.
- The payment button looked actionable before all required fields and the
  appointment were complete.
- Stripe cancellation restored cached contact details but not the selected
  quote.
- Manage-link and no-replacement-slot failures lacked a direct service contact.
- Minor copy, field-validation, and manage-page ordering issues added friction.

## Approved resolution

- Reserve the slot atomically in Postgres before Stripe creation; bind the
  Session with a retry-stable request key and Stripe idempotency key.
- Handle completed, expired, asynchronous-success, and asynchronous-failure
  Checkout events. Handle full and partial refunds and new disputes with
  conservative calendar/token/slot rules and durable operations alerts.
- Apply database-backed, HMAC-IP rate limits because Vercel custom firewall
  rules are unavailable on the current team plan.
- Run the full verification suite, TypeScript, production dependency audit, and
  build in CI.
- Keep the current visual system while fitting weekdays on mobile, improving
  field errors and disabled states, preserving quote-only browser state, moving
  rescheduling above documents, and adding direct recovery links.
- Add baseline web security headers and classify malformed upload callbacks as
  client errors.

## Rollout boundary

Staging is the first deployment and uses its existing Stripe sandbox, Preview
Neon database, Blob store, Microsoft test calendar, and Graph email setup.
Production uses a newly provisioned, separate Neon database. Production does
not inherit staging secrets, customer-recipient overrides, Blob storage, or
email feature flags. Database migrations precede feature activation in each
environment. A paid staging browser test and any Stripe Dashboard subscription
changes require explicit action-time confirmation.

## 2026-09-04 implementation re-audit

The implementation passed independent UI/UX review after the requested polish
changes. The first backend QA pass then blocked release on lifecycle edge cases:
partial refunds and disputes retained credential rows but could not use them,
and an interrupted refund/dispute handler could strand a booking in a busy
state. Those findings were corrected before rollout.

The final QA pass verified that paid, partially refunded, and disputed bookings
retain Manage Booking, upload, and reschedule access while refunded and
cancelled bookings are denied. Full refunds block access immediately; Microsoft
calendar deletion and slot cleanup retry safely. Lifecycle event ownership can
be reclaimed by the same stale Stripe event without allowing a fresh competing
event to take over. The complete verification suite, TypeScript, production
build, production dependency audit, and diff checks passed. Code sign-off:
**approved**.
