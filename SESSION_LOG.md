# Session Log

Status: Current

## Current state

Production still runs the original Condition & Standard pricing. Branch
`juliustanch/pricing-packages` now contains the completed Essential Health
Check, Electrical Assurance, independent cleaning, and fixed-price monitoring
migration. Functional QA, desktop/mobile UX review, and feature security review
all pass. The branch is not authorized for deployment and is not yet merged.

## Next up

1. Commit, push, and open a pull request without deploying.
2. Review the preview deployment and run a Stripe test-mode paid booking before
   authorizing any production deployment.
3. Plan a separate Next.js 16 migration to clear the inherited PostCSS audit
   advisories; do not combine that major upgrade with this calendar change.

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
