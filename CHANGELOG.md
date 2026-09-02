# Changelog

Status: Current

## 2026-09-02

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
