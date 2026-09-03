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
`STRIPE_GST_TAX_RATE_ID` is configured separately for Production and the
`staging` Stripe sandbox. Pull request
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
Pull request #21 was merged as `9e17e1b`; `main` now removes the redundant
public `Other installer` choice and clarifies partial roof access and excluded
third-party access costs.

Pull requests #22 through #25 are merged as `9120067`, `6419bc3`, `3802119`,
and `1ffb4a8`, completing Parts 1–5 of the phased customer Manage Booking
portal. The organisation-owned `staging` branch uses a Stripe sandbox,
migrated Preview Neon database, and private Singapore-region Blob store. Its
S$0.55 paid sandbox checkout, signed webhook and replay, durable fulfilment,
portal, authenticated upload/download, and one supervised reschedule passed.
Portal, uploads, rescheduling, and transactional email are enabled there for a
bounded team stress test. Production resources, credentials, and feature flags
remain unchanged.

Preview testing exposed a cookie-delivery defect: two same-name path-scoped
cookies collapsed to the API-scoped cookie, so `/manage` could not authenticate.
Pull request #27 is merged as `949a0a0`; it replaces them with one secure
HttpOnly cookie at `Path=/`. Main CI, Production deployment, and the real
Preview browser flow pass while all Production portal flags remain disabled.

Part 6 is implemented behind `TRANSACTIONAL_EMAIL_ENABLED=1`. Durable
customer/operations booking and reschedule messages, provider/database
idempotency, Preview recipient override, and later-appointment manage-link
renewal pass the full local verification and build. A free Preview-only Resend
resource exists in Tokyo. Migration `0003` is applied to Preview Neon and the
email variables are scoped to `staging`. Cloudflare sender DNS is verified;
customer delivery to the approved Gmail inbox and operations delivery to
`ops@fomo.energy` passed. Staging now sends from and replies to the existing
shared `service@fomo.energy` mailbox, while operations delivery remains
`ops@fomo.energy`.
Production has no Resend resource or email flag.

Transactional email is being migrated from Resend to a dedicated Microsoft
Graph `Mail.Send` transport on branch `juliustanch/graph-transactional-email`.
The code, provider-preserving database migration, full verification suite,
production build, and current documentation pass locally; staging has not been
switched.
The mail-only Entra registration has the required role, but both candidate
client-secret values must be rotated because a failed local redaction exposed
them in task output. Keep staging transactional email disabled until a fresh
secret and the `service@fomo.energy` mailbox restriction are configured and
tested.

Production is now served at `https://maintenance.fomo.energy`, with a DNS-only
Cloudflare CNAME to Vercel and `NEXT_PUBLIC_SITE_URL` set to the custom origin.
The default Vercel project URL remains an additional Production alias; the
stable `git-staging` Preview alias is the development/test URL. An independent
audit verified the runtime portal boundary and led to tighter environment
scoping: live Stripe is Production-only, while Preview state, email, Microsoft
secret, sandbox Stripe, and feature settings are confined to `staging`.

## Next up

1. Rotate both exposed Entra client secrets without interrupting the existing
   calendar or monitoring consumers; configure a fresh mail-only secret and
   restrict its app to `service@fomo.energy`.
2. Apply migration `0004_complete_kree.sql` to Preview Neon, switch the
   branch-scoped Vercel email variables to `EMAIL_GRAPH_*`, deploy, and repeat
   the controlled customer/operations delivery and replay tests.
3. Remove the unused Preview Resend integration/resource and DNS only after
   retained records are reconciled and Graph passes.
4. Complete the bounded one-week team stress test on `staging`, including
   booking, upload/download, rescheduling, and email observations.
5. Verify reschedule-message delivery, Stripe replay idempotency, and
   failed-email recovery in the isolated Preview stack.

## Session entries

### 2026-09-03

- Began replacing Resend with Microsoft Graph `sendMail` from the existing
  `service@fomo.energy` shared mailbox. The dedicated email configuration is
  separate from the calendar app, and new delivery rows use
  `microsoft_graph` while retaining historical `resend` rows.
- Verified safely from token claims that the mail candidate has only
  `Mail.Send`; the calendar candidate does not have that role. No token,
  identifier, or secret is recorded in this repository.
- Recorded a security incident after a local output-redaction command exposed
  both candidate client-secret values in task output. Treat both as exposed,
  rotate all consumers, and do not deploy either value to staging.
- Added deterministic Graph request references and reconciliation headers,
  status-only provider failures, and local payload/database/idempotency tests.
- Renamed the long-lived test branch from `juliustanch/e2e` to the
  organisation-owned `staging` branch. Migrated all 14 encrypted Vercel
  branch-scoped overrides in place without reading or rotating their values,
  including the sandbox Stripe, Preview feature, and email configuration.
  `main` and Production remained unchanged. The old remote branch was removed
  after the replacement `staging` Preview passed deployment checks.
- Confirmed Cloudflare is authoritative for `fomo.energy` and verified the
  exact Resend sender records without altering inbound-mail MX records.
- Accepted the owner-completed Resend Marketplace terms and provisioned the
  free `fomo-maintenance-preview-email` resource for Vercel Preview only in
  Tokyo. Production received no resource or email key.
- Implemented customer and operations booking confirmations plus reschedule
  messages with Singapore times, payment breakdown, reference, address, and a
  customer-only private manage/upload link.
- Added durable per-message audit/idempotency state and a Preview-only customer
  recipient override that fails closed in Production. Rendered bodies and raw
  manage credentials are not stored.
- Added later-appointment manage-link renewal and replacement of the requesting
  browser's secure cookie before reschedule notification.
- Verified controlled customer confirmation delivery to `fomoenergysg@gmail.com`
  and operations delivery to `ops@fomo.energy`. The later mailbox decision sets
  both `EMAIL_FROM` and `EMAIL_REPLY_TO` to the existing shared
  `service@fomo.energy` address.
- Completed an independent environment audit. Removed generic Preview and
  Development live Stripe secrets, restricted the live publishable key and GST
  rate to Production, and branch-scoped Preview Neon, Blob, Resend, Microsoft
  client secret, sandbox Stripe, and portal flags to `staging`.
- Added and verified `maintenance.fomo.energy` in Vercel, created its DNS-only
  Cloudflare CNAME, set the Production canonical site URL, and redeployed
  `main`. HTTPS, page metadata, and the Production-disabled/staging-enabled
  portal API boundary passed.
- Transactional email, schema, portal, pricing, slots, calendar, documents,
  rescheduling, TypeScript, and production-build checks pass locally. Preview
  migration, deployment, customer/operations delivery, and paid booking have
  passed; reschedule-email replay and recovery checks remain.

### 2026-09-02

- Provisioned a free isolated Neon Preview database and private Singapore-region
  Vercel Blob store for the branch now named `staging`; applied the reviewed Drizzle
  migrations without changing Production resources or secrets.
- Configured a Stripe sandbox restricted key, exclusive 9% GST rate, and signed
  webhook only for the stable Preview alias now attached to `staging`.
- Completed one S$0.55 paid sandbox Testing checkout. Stripe reported paid, the
  signed webhook returned 200, and replay retained exactly one booking and one
  Microsoft event.
- Exchanged the manage credential, verified private booking data, uploaded a
  benign JPEG, rejected unauthenticated download, and retrieved identical bytes
  through the authenticated application route.
- Found and corrected the collapsed same-name cookie issue by issuing one
  secure HttpOnly root-path cookie; the complete test/build suite and live
  Preview browser flow pass.
- With explicit owner confirmation, moved the synthetic visit from 14 September
  2026 13:00–17:00 SGT to 15 September 2026 09:00–13:00 SGT. Graph and Postgres
  agreed, one online change was recorded, and rescheduling was disabled again.
- Deleted the exact synthetic Microsoft calendar event after verification. The
  Preview booking history and benign Blob fixture remain as an intentional
  audit record; a distinct calendar is still required for Production.

- Merged pull requests #24 and #25 as `3802119` and `1ffb4a8`. The feature
  flags remain off, no remote portal migration or storage provisioning occurred,
  and the legacy Production payment-to-calendar path remains authoritative.
- Replaced the former all-live-environments assumption with an isolated Stripe
  sandbox plan for the long-lived `staging` Vercel Preview. The runbook keeps sandbox
  keys, tax rate, webhook, database, Blob store, and test calendar separate
  from Production.
- Merged pull request #23 as `6419bc3`, completing the dormant Parts 2–3 code;
  its GitHub checks and Vercel deployment passed.
- Started `juliustanch/booking-portal-uploads` for Part 4 and adopted private
  Vercel Blob direct uploads so large documents bypass Function body limits.
- Added PDF/PNG/JPEG and 20 MB policy checks, basic magic-byte validation,
  opaque UUID storage paths, ten-minute upload tokens, and ten database-enforced
  quota slots per booking. Abandoned pending intents release after one hour.
- Added ownership-checked, no-store downloads that stream private Blob content
  without returning storage URLs. No Blob or Neon resource was created and the
  new upload flag defaults off.
- Re-ran the complete pricing, slot, calendar, database, portal, and document
  policy suites plus the production build. Browser smoke checks found meaningful
  content and no framework error overlay on `/` or `/manage`; with all portal
  resources unset, both document endpoints returned generic no-store 404s.
- Confirmed the merge deployment for pull request #23 is Ready and owns the
  production aliases. Main CI passed at merge commit `6419bc3`.
- Opened pull request #24 at `383b1ae`; GitHub CI and the automatic Vercel
  Preview deployment passed. The feature remains disabled and unmerged.
- Started stacked branch `juliustanch/booking-portal-rescheduling` for Part 5.
  Added 31-minute Checkout holds with webhook grace, shared unique slot
  reservations, one active customer change per booking, a 48-hour cutoff, and
  a maximum of two online changes.
- Added authenticated replacement availability and a retry-safe Graph-first
  update flow. Microsoft events are reread before Postgres atomically records
  the new time and releases the previous slot. An uncertain result keeps the
  same request available for authenticated retry rather than guessing.
- Split `getSchedule` calls into 60-day windows so the three-month availability
  horizon stays within Microsoft's 62-day limit.
- The complete pricing, slot, calendar, database, portal, document, and
  rescheduling suites plus `next build` pass. Browser checks found content and
  no framework overlay on `/` or `/manage`; with all portal flags/resources
  unset, both rescheduling routes returned generic private no-store 404s.
- Opened stacked pull request #25 at `1f7091a`; GitHub CI and the automatic
  Vercel Preview deployment passed. Rescheduling remains disabled and unmerged.

- Merged Part 1 in pull request #22 as `9120067`; main CI passed and Vercel
  created the corresponding production deployment without changing live behavior.
- Started `juliustanch/booking-portal-fulfillment` for Parts 2–3. The Vercel
  Workflow SDK prototype was removed after its production tree added 15 high
  audit findings; a database-backed state machine now uses Stripe webhook
  retries with claim timeout and step-level idempotency.
- Added authoritative Stripe Session reload, paid booking upsert, Graph event ID
  persistence, retry-safe calendar/manage-link steps, and permanent/transient
  failure separation behind `BOOKING_PORTAL_ENABLED=1`.
- Added HMAC-authenticated, digest-only manage credentials and a fragment-based
  exchange for an HttpOnly cookie, plus a private read-only booking page.
- Pricing, slot, calendar, database, portal retry/token tests and `next build`
  pass. Browser verification found content, no framework overlay, and the
  expected disabled-portal message. Nothing was merged to or activated in
  Production, paid, emailed, uploaded, or written to an external database or
  calendar in Parts 2–3 testing.
- Opened pull request #23 at commit `528ea3b`; GitHub CI and the automatic
  Vercel Preview deployment passed. It was subsequently merged as `6419bc3`.

- Planned the complete customer portal in seven independently reviewable parts:
  data foundation, paid fulfilment, secure portal, private uploads,
  rescheduling, transactional email, and staff/operational hardening.
- Started Part 1 on `juliustanch/booking-portal-foundation` and incorporated the
  newly merged roof-safety work from pull request #21 before final verification.
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
- Started `juliustanch/roof-safety-copy` to remove the redundant public
  `Other installer` option and replace the roof notice with clearer safety,
  partial-access, and third-party access-cost guidance.
- Pricing, slot, calendar, production-build, rendered-copy, and visual checks
  pass. The page has no framework overlay or browser console errors, and the
  public installer controls contain only FOMO-installed and rent-to-own.
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
