# Changelog

Status: Current

## 2026-09-02

- Built Part 5 behind a separate disabled rescheduling flag: shared Checkout
  and reschedule slot holds, a 48-hour cutoff, two-change limit, authenticated
  replacement availability, idempotent Graph event updates, and atomic booking
  finalization.
- Split three-month Microsoft free/busy requests into 60-day windows to remain
  below the Graph `getSchedule` 62-day limit.
- Built Part 4 behind a separate disabled upload flag: private direct Vercel
  Blob uploads, opaque pathnames, short-lived scoped upload tokens, basic file
  signature checks, database-enforced ten-document quotas, and authenticated
  application-streamed downloads.
- Scoped the manage credential into `/manage` and `/api/manage` cookies instead
  of sending it to unrelated same-origin routes.
- Built Parts 2–3 of the customer portal behind a disabled server flag: durable
  Stripe event/fulfilment recovery, persisted Graph event IDs, signed manage
  credentials stored only as digests, a fragment-to-HttpOnly-cookie exchange,
  and a private read-only `/manage` booking view.
- Rejected the Vercel Workflow SDK for this phase after its current dependency
  tree introduced 15 high-severity production audit findings; Stripe retryable
  delivery plus the existing Postgres state tables provide the retry driver.
- Began the customer Manage Booking portal as a non-production foundation:
  added the phased delivery plan, Neon/Drizzle schema, reviewed migration,
  lazy server-only database client, idempotent booking/webhook repository
  primitives, and isolated database constraint verification. Part 1 itself did
  not connect a live route to the database.
- Removed the redundant `Other installer` choice from the public calculator and
  expanded the roof-access notice to cover partial safe access and excluded
  third-party access costs.
- Transferred the canonical repository from the maintainer's personal GitHub
  account to the `Fomo-Energy` organisation while preserving its history,
  repository ID, Actions workflow, and Vercel project linkage.
- Simplified the cleaning-card description to the safe-access condition and
  follow-up when access cannot be confirmed; its calculated price is unchanged.
- Moved the shared no-roof-access note above both service options, added the
  annual Essential and biennial Electrical Assurance recommendations, and
  expanded the Electrical Assurance description to explain its cabling,
  insulation, fault, and fire-risk purpose.
- Simplified the booking payment note to say that the displayed amount includes
  GST and that the booking is confirmed after successful payment.
- Changed the left-side service selector to show pre-GST prices explicitly
  marked `subject to GST`; the booking summary continues to show the complete
  GST-inclusive amount.
- Added versioned browser-local persistence for name, phone, email, and site
  address, plus a control for clearing the saved details.
- Added 9% GST to every purchasable line item. Public prices now show
  the complete GST breakdown; a S$199 Essential subtotal shows S$17.91 GST and
  a S$216.91 final price.
- Added fail-closed verification of Stripe Checkout subtotal, 9% tax, and final
  total against the server quote.
- Preserved the restricted Stripe key's least-privilege permissions by applying
  the configured tax-rate ID directly and relying on fail-closed Checkout total
  verification rather than requiring Tax Rates Read.
- Updated the Essential Health Check scope to the approved inverter-area,
  inverter/DB electrical-check, remote-pre-check, and reporting wording.
- Removed customer-facing first-visit onboarding notices.
- Removed Continuous monitoring from the calculator and quote model; crafted
  checkout requests that try to add it are rejected server-side.
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
