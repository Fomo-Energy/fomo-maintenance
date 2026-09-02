# Session Log

Status: Current

## Current state

Production includes the approved Essential Health Check scope wording,
Electrical Assurance, independent cleaning, and the S$0.50 Testing checkout.
Pull request #10 was merged as `9d70665`: customer-facing onboarding notices
and the Continuous monitoring offer are removed, and crafted monitoring
checkout requests are rejected. Main CI, the Vercel production deployment, the
live copy, and API checks passed at that deployment.

Pull request #13 was merged as `64001b8`, and production displays the approved
9% GST-inclusive prices. The live Stripe rate exists and
`STRIPE_GST_TAX_RATE_ID` is configured in all Vercel environments. Pull request
#14 was merged as `acdfb63`, allowing the restricted Stripe key to apply the
configured rate without broader tax-rate read permission. Production Checkout
was verified without payment: a 10 kWp Essential booking shows S$199.00
subtotal, S$17.91 GST, and S$216.91 total.

Pull request #16 was merged as `c427db0`. Production selector cards show pre-GST
prices marked `subject to GST`, while the final booking summary and Stripe
payment remain GST-inclusive and server-authoritative. Name, phone, email, and
site address persist in the same browser until `Clear saved details` is used.
Pull request #18 was merged as `aab5324`. Production now contains the shorter
payment note, consistent shared no-roof-access presentation, service cadence
recommendations, expanded Electrical Assurance safety copy, and simplified
cleaning copy. Main CI and the Vercel production deployment passed, and the live
page was verified without creating a Checkout session, payment, or calendar
event.

The canonical repository is now `Fomo-Energy/fomo-maintenance`. The transfer
preserved repository ID `1350261809`, history, issues, pull requests, and the
active CI workflow. The local `origin` and Vercel project's Git link both point
to the organisation-owned repository; production still follows `main`.
Organisation-owned pull requests now trigger both GitHub CI and Vercel preview
deployments after refreshing the Vercel Git connection.

Branch `juliustanch/booking-portal-foundation` starts the approved phased
customer Manage Booking portal. Part 1 defines and locally verifies the dormant
Neon/Drizzle data model for paid bookings, hashed manage-link credentials,
private-document metadata, reschedules, slot reservations, webhook receipts,
and fulfilment state. No Neon resource has been provisioned, no migration has
been applied remotely, and the current Stripe-to-calendar production flow is
unchanged.

## Next up

1. Review Part 1 and provision a separate Neon Preview database when approved;
   do not connect Production yet.
2. Implement Part 2: idempotent Stripe event persistence and durable
   post-payment fulfilment while preserving the existing calendar behavior.
3. Reduce Microsoft Graph availability queries from 90 days to its 62-day
   free/busy limit, or split the requested period into bounded windows.
4. Decide whether customer receipts remain Stripe receipts or whether the paid
   Checkout webhook should create and email formal invoices through Xero.
5. Before a Xero implementation, confirm the target Xero organisation, GST
   registration details, existing Stripe feed, and durable OAuth token storage.

## Session entries

### 2026-09-02

- Planned the complete customer portal in seven independently reviewable parts:
  data foundation, paid fulfilment, secure portal, private uploads,
  rescheduling, transactional email, and staff/operational hardening.
- Started Part 1 on `juliustanch/booking-portal-foundation` from current `main`;
  the separate roof-safety copy remains in pull request #21.
- Added the dormant booking-portal schema and migration with database-enforced
  Stripe/webhook idempotency, monetary and time invariants, single active
  manage-link state, and active standard-slot exclusion.
- Added a lazy server-only Neon/Drizzle client and repository primitives without
  importing them into Checkout or the webhook, keeping production behavior
  unchanged until Part 2.
- Added isolated PostgreSQL-compatible migration tests; no external database,
  payment, calendar event, email, upload, or deployment was created.
- Production dependency audit remains at the inherited one high and one
  moderate Next.js/PostCSS advisories whose published fix is a major upgrade;
  Drizzle Kit adds development-only moderate esbuild advisories. Both are
  recorded in `SECURITY_TODO.md` rather than force-upgraded in this feature.
- Started `juliustanch/booking-confirmation-copy` to replace the long payment
  note with the requested concise GST and post-payment confirmation message;
  corrected the supplied `You booking` typo to `Your booking`.
- Consolidated no-roof-access guidance above both service cards, recommends
  Essential annually and Electrical Assurance every two years, and explains
  the deeper service's role in identifying cabling and insulation deterioration
  that can lead to DC faults and fires.
- Pricing, slot, calendar, production-build, rendered-copy, and visual layout
  checks pass for the expanded pull request; no framework error overlay was
  present.
- Simplified the cleaning-card description without changing its calculated
  price, checkout behavior, or safe-access requirement.
- Merged pull request #18 as `aab5324`; main CI and the 35-second Vercel
  production deployment passed. Live verification confirmed the shorter
  booking note, shared no-roof-access guidance, service cadence, expanded
  Electrical Assurance description, and simplified cleaning description. No
  Checkout session, payment, or calendar event was created.
- The post-deploy error scan found that Microsoft Graph now rejects the app's
  90-day free/busy request because its limit is 62 days. The page still renders
  via its availability fallback; a bounded-query fix remains next work.
- Transferred the GitHub repository from `juliustanch/fomo-maintenance` to
  `Fomo-Energy/fomo-maintenance`, preserving its repository ID and updating the
  local remote. Confirmed administrator access, active Actions workflow, and an
  automatically updated Vercel Git connection to the organisation repository.
- Refreshed the Vercel Git connection after the transferred repository's first
  pull-request events did not create preview deployments; the Vercel GitHub App
  already had all-repository access in the organisation.
- Verified the refreshed integration with pull request #20: GitHub CI and the
  Vercel preview deployment both passed from the organisation repository.
- Started `juliustanch/pre-gst-left-and-saved-details` after confirming the
  controlled form always initialized empty and relied only on browser
  autocomplete; no application-level cache previously existed.
- Added a versioned, bounded browser-local record for name, phone, email, and
  site address, with graceful storage failure handling and a clear control.
- Changed only the selector presentation to pre-GST prices marked `subject to
  GST`; the right summary, server recomputation, and Stripe totals remain
  GST-inclusive.
- Pricing, slot, calendar, production-build, and browser checks pass. Browser
  verification confirmed saved details survive reload, the clear action
  persists, and the page has no framework error overlay.
- Merged pull request #16 as `c427db0`; main CI and Vercel production passed.
  Live browser verification confirmed the pre-GST selector copy, S$216.91 final
  Essential total, contact/site restoration after reload, and persistent clear
  behavior. No Checkout session, payment, or calendar event was created.
- Started branch `juliustanch/gst-pricing` to add 9% GST without changing the
  approved pre-GST package formulas. The reference Essential quote is S$199.00
  subtotal, S$17.91 GST, and S$216.91 total.
- Added server-side tax-rate validation and Checkout subtotal/tax/total checks;
  the change will not be merged or deployed before the Stripe test/live tax-rate
  IDs are configured and the flow is verified.
- Committed the GST change as `bb007ca` and opened pull request #13. Local
  verification/build, GitHub CI, and the Vercel preview pass; the preview shows
  the expected S$199.00 subtotal, S$17.91 GST, and S$216.91 final Essential
  price. Production remains unchanged.
- Created an active, exclusive 9% Singapore GST tax rate in the live Stripe
  account and configured its ID as `STRIPE_GST_TAX_RATE_ID` for all Vercel
  environments. Confirmed all hosted environments currently use Stripe live
  mode; the runbook now records that every hosted test payment is real.
- Merged pull request #13 as `64001b8`; main CI and Vercel production deployment
  passed, and the live page renders the expected GST-inclusive pricing.
- The first non-payment Checkout smoke test failed closed because the restricted
  Stripe key lacks `tax_rate_read`. Started
  `juliustanch/gst-restricted-key-fix` to use the configured rate ID directly
  and preserve least-privilege permissions while retaining returned-total
  validation.
- Merged the least-privilege hotfix in pull request #14 as `acdfb63`; main CI
  and the Vercel production deployment passed without expanding the restricted
  Stripe key's permissions.
- Completed a production Checkout smoke test with synthetic customer details
  and no payment. Stripe displayed S$199.00 subtotal, S$17.91 GST, and S$216.91
  total exactly; no payment or calendar event was created.
- Started and verified branch `juliustanch/essential-scope-copy` for three
  requested calculator changes: approved Essential scope wording, removal of
  customer-facing onboarding notices, and removal of Continuous monitoring.
- Removed monitoring from the quote model and added a server-side rejection for
  crafted checkout requests so hiding the checkbox cannot leave a purchasable
  path. Legacy webhook fields remain readable for already-paid sessions.
- Pricing, slot, calendar, production-build, rendered-copy, and diff checks pass
  locally.
- Merged pull request #10 as `9d70665`; main CI and Vercel production deployment
  passed. Live checks confirmed the requested copy, removal of both UI notices,
  server-side monitoring rejection, and working Graph-backed availability.
- Started branch `juliustanch/testing-service` for a distinct S$0.50 live
  Testing checkout with the exact public description
  `for testing purposes, no service offered`.
- Kept Testing out of the kWp formula, made it mutually exclusive with service
  add-ons, and marked Stripe/calendar records as `TESTING` with no fulfillment
  entitlement.
- Pricing, slot, calendar, production-build, rendered-copy, and diff checks pass
  for the Testing checkout branch.
- Committed the Testing checkout and opened pull request #8. GitHub verification
  and the Vercel preview pass, and the preview renders `Testing · S$0.50` with
  the requested no-service description.
- On explicit authorization, merged pull request #8 as `8186447`. Main-branch
  CI and the Vercel production deployment passed.
- Confirmed production renders `Testing · S$0.50` and
  `for testing purposes, no service offered`. The availability API still
  returned 118 Graph-backed slots with no error; no payment was submitted.

### 2026-09-01

- Started branch `juliustanch/pricing-packages` for the approved package and
  pricing migration; production remains unchanged.
- Omitted automatic S$120 other-installer onboarding because the app has no
  durable site/visit history and the agreed customer form cannot establish it.
- Kept cleaning and monitoring selectable with explicit pending operational
  confirmation; no automated property or compatibility lookup was invented.
- Added server-authoritative package pricing, transparent Stripe line items,
  service codes, bounded operational metadata, and legacy paid-session support.
- Hardened checkout and fulfillment with strict input parsing, single-line
  calendar-bound customer data, Graph transaction IDs, redacted failure logs,
  and retryable webhook failures.
- Added explicit payment-versus-calendar confirmation states and remediated the
  accessibility review findings for forms, contrast, calendar controls, status
  announcements, and RTO behavior.
- Final `npm run verify`, `npm run build`, and `git diff --check` pass. QA, UX,
  and feature security reviewers approved the completed migration.
- Committed and pushed the migration, opened pull request #6, and confirmed the
  GitHub verification and non-production Vercel preview checks pass. No
  production deployment was performed.
- On explicit authorization, merged pull request #6 as `fa037f4` and completed
  the Vercel production deployment. Main-branch CI passed.
- Confirmed the live homepage serves the Essential and Electrical Assurance
  package copy. The production availability API returned 118 Graph-backed slots
  with no error; no payment or calendar event was created during smoke testing.
- Confirmed the user created `Fomo Maintenance` as a secondary calendar under
  `jtan@fomo.energy`.
- Browser-based Graph ID retrieval was unavailable because Computer Use timed
  out; chose runtime Graph lookup by exact calendar name instead.
- The existing Azure CLI session is signed in as `jtan@fomo.energy`, but its
  Microsoft Graph token lacks calendar-read permission, so it could not provide
  the ID directly without changing account consent.
- Added a stable optional ID override so production can avoid name lookup if
  desired.
- Pricing, slot, and calendar verification scripts pass; the Next.js production
  build also passes.
- The Vercel preview's `/api/availability` returned HTTP 200 with live slots,
  proving that the runtime Graph lookup resolved the secondary calendar.
- `npm audit` reports inherited PostCSS advisories whose available remediation
  is a semver-major Next.js upgrade; deferred that migration from this feature.
- Merged pull request #4 as commit `8b270d2` and completed the production Vercel
  deployment.
- Confirmed the live homepage and availability API both return HTTP 200; no
  production payment was created during smoke testing.
