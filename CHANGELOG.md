# Changelog

Status: Current

## 2026-09-04

- Added `3rd party` to the installer choices. Selecting it reveals a required,
  locally cached installer-name field in Contact details; the server normalizes
  and validates the name without changing package pricing or adding an
  onboarding fee.
- Added the normalized installer type/name to Stripe metadata, durable booking
  records, Microsoft calendar context, success/manage pages, and customer and
  operations email. Legacy 3rd-party payments without a name remain replayable
  and display an explicit not-recorded label.
- Added migration `0006_smiling_devos.sql` with installer type/name constraints;
  it must be applied separately to staging and Production before their code
  deployments.

- Merged and deployed the audited hardening/polish release to both the stable
  `staging` branch and Production. Applied migration `0005` to both isolated
  Neon databases and configured six-event Stripe webhook endpoints in sandbox
  and live modes.
- Verified the live restricted Stripe key's dispute-read permission, then
  enabled only the Production booking portal, Checkout reservation, public API
  rate-limit, and payment-lifecycle foundations. Customer uploads,
  rescheduling, and transactional email remain disabled in Production; the
  rollout created no live Checkout or payment.

- Polished the calculator and portal without changing their overall flow:
  quote selections and contact details restore from versioned browser storage,
  visit times remain fresh, the Pay action waits for valid contact details and
  a selected slot, validation is field-specific, and the mobile calendar shows
  a usable five-day workweek grid.
- Added database-first Checkout reservations and a stable request UUID shared
  with Stripe idempotency, closing the simultaneous-selection window before a
  Checkout Session is created. Added expiry and asynchronous-payment lifecycle
  handling for reservation release or fulfilment.
- Added server-side public API limits backed by environment-keyed HMAC address
  digests in Postgres: 120 availability requests per minute and 12 Checkout
  attempts per 10 minutes. Raw client IP addresses are not stored.
- Added idempotent full-refund, partial-refund, and dispute handling. Full
  refunds block customer access immediately, then safely remove the Microsoft
  event before revoking the credential record and releasing the slot; partial
  refunds and disputes preserve the appointment and access and notify
  operations when email is enabled. A separate lifecycle flag and booking-state
  guards fail closed and serialize these events against fulfilment and
  rescheduling.
- Added global Content Security Policy, frame denial, MIME-sniffing protection,
  referrer policy, and permissions policy headers. Upload completion now treats
  malformed and unknown callbacks as client errors.
- Expanded GitHub CI to run the complete verification suite, TypeScript,
  production dependency audit, and production build.
- Provisioned a distinct Production Neon database plus independent manage-link
  and rate-limit secrets. Production activates only the durable booking,
  reservation, and payment-lifecycle foundation; uploads, rescheduling, and
  transactional email remain independently disabled.
- Refreshed the staging-only operations guide with the latest slot-hold,
  request-limit, refund/dispute, calendar, and email-routing behavior.

## 2026-09-03

- Removed the public S$0.50 pre-GST Testing product from the calculator and
  server quote model. Any request that still supplies the retired field is
  rejected. Delayed historical paid `TESTING` sessions retain
  success/webhook/email compatibility, but their portal is read-only and every
  notification remains explicitly marked as testing with no service offered.
- Upgraded Next.js from 15.5.24 to 16.3.4, including its patched PostCSS
  dependency and required TypeScript configuration. The production dependency
  audit is now clean.
- Added a fixed red warning banner to the stable `staging` deployment. It uses
  the same server-only exact environment gate as the operations guide and is
  absent from Production, local development, and unrelated Previews. The
  banner links directly to the guide, and the keyboard skip link clears the
  fixed warning.
- Added a responsive operations guide to the stable `staging` homepage. It
  explains which sandbox actions still have real Microsoft calendar and email
  side effects, maps customer/operations/reply email delivery, describes the
  manage/upload/reschedule flow, and records current retry and recovery limits.
  A server-only exact environment check keeps the guide out of Production,
  local development, and unrelated pull-request Previews.
- Replaced the ambiguous `final annual price` summary with `final visit price`
  so the Essential annual and Electrical Assurance two-year recommendations
  do not imply the same billing cadence.
- Replaced the Resend application dependency with Microsoft Graph `sendMail`
  from `service@fomo.energy`. New delivery rows identify
  `microsoft_graph`; historical Resend rows remain valid, and the database
  remains the authoritative duplicate-send guard because Graph returns HTTP
  202 without a provider message ID.
- Added dedicated `EMAIL_GRAPH_*` configuration, deterministic client request
  references and `x-fomo-*` reconciliation headers, safe status-only provider
  errors, payload tests, and migration `0004_complete_kree.sql`.
- Deployed the Graph email transport to `staging` with a dedicated `Mail.Send`
  app and a mailbox-restricting Exchange Application Access Policy for
  `service@fomo.energy`. App RBAC migration remains pending while Microsoft
  completes the tenant upgrade.
- Attached `maintenance.fomo.energy` to the existing `main` Production
  deployment through a DNS-only Cloudflare CNAME, set the Production canonical
  site URL, redeployed, and verified Vercel domain ownership, HTTPS, metadata,
  and the disabled Production portal boundary.
- Tightened environment isolation after an independent audit: live Stripe
  variables are Production-only, and Preview Neon, Blob, Resend, Microsoft
  client secret, sandbox Stripe, and feature settings are scoped to `staging`.
  Generic Preview and Development live Stripe secrets were removed.
- Changed the staging transactional sender and reply-to mailbox from the
  provisional maintenance address to the existing shared
  `service@fomo.energy` mailbox. Operations delivery remains
  `ops@fomo.energy`.
- Renamed the long-lived test branch to the organisation-owned `staging`
  branch and migrated all encrypted Vercel branch overrides in place. The
  sandbox Stripe, Preview Neon, private Blob, Resend, and Microsoft test-calendar
  configuration is preserved; `main` and Production are unchanged.
- Implemented Part 6 transactional booking and reschedule confirmations behind
  a disabled server flag. Customer messages contain the Singapore appointment,
  subtotal, GST, total, booking reference, address, and private manage/upload
  link; operations messages omit the bearer credential.
- Added durable per-message delivery records and deterministic database/Resend
  idempotency keys so webhook and customer retries do not duplicate mail.
- Added manage-link renewal for appointments moved beyond the current link
  expiry, including replacement of the authenticated browser cookie.
- Provisioned a free Resend resource only for Vercel Preview in Tokyo. Sender
  DNS is verified, and controlled customer delivery to Gmail plus operations
  delivery at `ops@fomo.energy` passed on `staging`. Production email is
  disabled and has no Resend resource.
- Added transactional email rendering/idempotency and schema-constraint checks;
  the full verification suite and production build pass locally.

## 2026-09-02

- Corrected the manage-link exchange to issue one root-path HttpOnly cookie.
  Preview E2E testing showed that two same-name path-scoped cookies collapsed
  to the API cookie, preventing `/manage` from seeing the authenticated session.
- Provisioned an isolated Stripe sandbox, Preview-only Neon database, and
  private Singapore-region Blob store for the long-lived `staging` branch. A paid
  S$0.55 sandbox checkout passed signed webhook handling and replay, durable
  booking fulfilment, the customer portal, private upload/download, and one
  supervised Graph/Postgres reschedule. Rescheduling was disabled afterward;
  Production resources, credentials, and feature flags remain unchanged.
- Merged Parts 4 and 5 in pull requests #24 and #25. Their private-upload and
  customer-rescheduling flags were disabled at merge; subsequent provisioning
  and activation is confined to the isolated `staging` Preview described above.
- Added the isolated Stripe sandbox/Vercel Preview runbook for controlled
  payment-to-webhook-to-database-to-calendar testing without changing live
  Stripe credentials or Production behavior.
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
