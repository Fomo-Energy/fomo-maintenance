# Session Log

Status: Current

## Current state

Production now runs the Essential Health Check, Electrical Assurance,
independent cleaning, and fixed-price monitoring packages from pull request #6.
The merge commit is `fa037f4`; main-branch CI and the Vercel production
deployment passed. The live homepage serves the new package copy and the live
availability API returns Microsoft Graph-backed slots.

## Next up

1. Run a controlled Stripe test-mode paid booking and confirm the package
   breakdown, webhook retry/idempotency, and maintenance-calendar event.
2. Plan a separate Next.js 16 migration to clear the inherited PostCSS audit
   advisories; do not combine that major upgrade with this package change.

## Session entries

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
