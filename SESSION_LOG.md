# Session Log

Status: Current

## Current state

Production includes the approved Essential Health Check scope wording,
Electrical Assurance, independent cleaning, and the S$0.50 Testing checkout.
Pull request #10 was merged as `9d70665`: customer-facing onboarding notices
and the Continuous monitoring offer are removed, and crafted monitoring
checkout requests are rejected. Main CI, the Vercel production deployment, the
live copy/API checks, and Microsoft Graph-backed availability all pass.

## Next up

1. Make one S$0.50 Testing payment, validate the TESTING calendar event and
   webhook metadata, then delete the event.
2. Remove the public Testing option after live validation is complete, or
   replace it with authenticated operational tooling.
3. Plan a separate Next.js 16 migration to clear the inherited PostCSS audit
   advisories; do not combine that major upgrade with this package change.

## Session entries

### 2026-09-02

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
