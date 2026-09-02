# Session Log

Status: Current

## Current state

Production includes the approved Essential Health Check scope wording,
Electrical Assurance, independent cleaning, and the S$0.50 Testing checkout.
Pull request #10 was merged as `9d70665`: customer-facing onboarding notices
and the Continuous monitoring offer are removed, and crafted monitoring
checkout requests are rejected. Main CI, the Vercel production deployment, the
live copy/API checks, and Microsoft Graph-backed availability all pass.

Pull request #13 was merged as `64001b8`, and production displays the approved
9% GST-inclusive prices. The live Stripe rate exists and
`STRIPE_GST_TAX_RATE_ID` is configured in all Vercel environments. A production
smoke test found that the restricted Stripe key cannot retrieve tax rates;
branch `juliustanch/gst-restricted-key-fix` is removing that unnecessary read
without expanding key permissions. Until that hotfix deploys, checkout returns
a controlled error before payment.

## Next up

1. Complete, merge, and deploy the restricted-key checkout hotfix.
2. Verify Stripe Checkout shows S$199.00 subtotal, S$17.91 GST, and S$216.91
   total at 10 kWp without submitting a payment.
3. When desired, make one S$0.55 Testing payment, validate the TESTING
   calendar event and webhook metadata, then delete the event.
4. Design receipt/invoice delivery separately; do not couple it to this GST
   pricing change.

## Session entries

### 2026-09-02

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
