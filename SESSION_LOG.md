# Session Log

Status: Current

## Current state

The app is configured in code to resolve the `Fomo Maintenance` secondary
calendar under `jtan@fomo.energy`, check it together with the primary calendar,
and write paid visits only to the secondary calendar. The verification suite
and Next.js production build pass on branch `juliustanch/om-calendar`. Pull
request #4 is open for review.

## Next up

1. Review and merge pull request #4 after CI passes.
2. After deployment, run the calendar and Stripe test-mode smoke tests in
   `docs/operations.md`.
3. Plan a separate Next.js 16 migration to clear the inherited PostCSS audit
   advisories; do not combine that major upgrade with this calendar change.

## Session entries

### 2026-09-01

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
- `npm audit` reports inherited PostCSS advisories whose available remediation
  is a semver-major Next.js upgrade; deferred that migration from this feature.
