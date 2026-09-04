# Operations

Status: Current

## Required calendar setup

1. Under the mailbox in `MICROSOFT_CALENDAR_USER`, create a secondary calendar
   named exactly `Fomo Maintenance`.
2. Keep `MICROSOFT_MAINTENANCE_CALENDAR_NAME=Fomo Maintenance`, or set
   `MICROSOFT_MAINTENANCE_CALENDAR_ID` to the calendar's Graph ID.
3. Grant the Azure app registration the Microsoft Graph application permission
   `Calendars.ReadWrite` and obtain administrator consent.
4. If an Exchange application access policy is used, allow the configured
   mailbox.

The ID setting takes precedence over the name. Name lookup is convenient for
initial setup; the ID setting is preferable if operators may rename calendars.

## Verification

```bash
npm ci
npm run verify
npx tsc --noEmit
npm audit --omit=dev
npm run build
```

`npm run verify` includes the portal schema check and an isolated application
of the migration with constraint tests. It also tests signed manage credentials,
duplicate paid-event handling, and transient fulfilment recovery. It does not
connect to any configured Neon database, Stripe account, or Microsoft calendar.

The canonical repository is `Fomo-Energy/fomo-maintenance`. Pull requests and
pushes should run the repository's `CI` workflow and create Vercel deployments
in the `fomo-energy/fomo-maintenance` project. Production follows `main` and is
served at https://maintenance.fomo.energy. The project-default
`fomo-maintenance.vercel.app` address remains an additional Production alias.
The `staging` branch is served from
https://fomo-maintenance-git-staging-fomo-energy.vercel.app.

## Environment promotion model

Do not switch one shared set of credentials between modes. Keep two explicit
deployment profiles in the same Vercel project:

| Profile | Git ref and URL | External resources |
| --- | --- | --- |
| Production | `main`; `maintenance.fomo.energy` | Live Stripe, Production Microsoft configuration, and a separate Production Neon database. The durable booking/reservation/lifecycle foundation is enabled; uploads, rescheduling, and email remain disabled. |
| Staging | `staging`; stable `git-staging` Vercel alias | Stripe sandbox, Preview Neon, private Blob, Microsoft test-calendar and Graph email configurations, and enabled portal features. |

All live Stripe variables are Production-only. Preview database, Blob,
Microsoft calendar/email secrets, sandbox Stripe variables, site URL, and feature flags
are branch-scoped to `staging`; ordinary pull-request Previews inherit none of
those credentials. Promote reviewed code by pull request rather than copying or
retargeting secrets. Provision and migrate separate Production resources before
enabling the portal flags on `main`. Preview and Production use distinct
`MANAGE_LINK_SECRET` and `RATE_LIMIT_HASH_SECRET` values.

### On-page staging operations guide

The homepage renders an operations guide only when both Vercel-provided values
identify the long-lived staging deployment: `VERCEL_ENV=preview` and
`VERCEL_GIT_COMMIT_REF=staging`. Production, local development, and ordinary
pull-request Previews must not display it.

The same predicate controls a fixed red banner at the top of every staging
page. The layout reserves a fixed-height offset and moves the sticky site header
below it so the warning never obscures navigation on desktop or mobile. The
banner's `View test flow` link returns to the homepage guide, and the focused
keyboard skip link also clears the warning.

The guide is deliberately explicit about the mixed staging boundary: Stripe
payments are sandbox objects and move no real money, while a successful webhook
still writes to the configured Microsoft calendar and sends real email. It
shows the booking, confirmation, manage/upload, and reschedule sequence; routes
operations mail to `ops@fomo.energy`; and identifies `service@fomo.energy` as
the sender and reply-to mailbox. It describes the controlled staging customer
inbox without publishing its address and warns that the booking email remains
the Microsoft calendar attendee.

The guide also reflects the database-first Checkout hold, public request
limits, and refund/dispute behavior. It tells operators that full refunds
remove the calendar event and customer access, while partial refunds and
disputes preserve the visit and send an operations alert for manual review.

Treat the guide as operational orientation, not a monitoring dashboard. Initial
booking fulfilment can be retried by Stripe and delivery rows prevent duplicate
email sends. A failed reschedule email remains pending after the calendar change
and requires operational recovery. There is not yet an automatic escalation or
staff-facing recovery control, so testers must review delivery state and Vercel
logs and reconcile synthetic calendar events after each run.

## Required Stripe GST setup

Create the tax rate in every Stripe mode used by a deployment:

1. In Stripe Dashboard, create a manual tax rate with display name `GST`,
   percentage `9`, jurisdiction/country Singapore, and tax behavior
   **exclusive**.
2. Confirm the tax rate is active.
3. Set its `txr_...` ID as `STRIPE_GST_TAX_RATE_ID` in the corresponding Vercel
   environment. The tax-rate mode must match the Stripe secret key's mode.
4. Redeploy only after the environment variable is present.

Production uses Stripe live mode. Preview must use a Stripe sandbox and its own
test-mode tax rate before portal end-to-end testing begins. Never mix a sandbox
key with a live tax-rate ID or webhook secret; Stripe objects and signing
secrets are environment-specific.

Checkout deliberately fails closed if the setting is absent, Stripe rejects the
configured rate, or Stripe's returned subtotal, tax, and total do not match the
server quote. The application uses the tax-rate ID directly so the restricted
Stripe key does not need `tax_rate_read`; preserve that least-privilege setup.
Do not deploy a pricing change before the matching tax-rate ID is configured.

Each environment's webhook endpoint must subscribe to all six application
events:

- `checkout.session.completed`
- `checkout.session.expired`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `charge.refunded`
- `charge.dispute.created`

Do not subscribe the last two events until `BOOKING_PORTAL_ENABLED=1` and
`PAYMENT_LIFECYCLE_ENABLED=1`: their safe calendar/access behavior requires the
persisted booking row and an explicit fail-closed activation. The Stripe
restricted key needs read access to Charges, Disputes, PaymentIntents, and
Checkout Sessions in addition to its existing Checkout creation/update access.
Keep sandbox and live endpoint signing secrets distinct.

When inspecting Vercel Secret-backed Stripe variables locally, do not assume
`vercel env run` replaced a same-named value from `.env.local`; unavailable
Vercel Secret values can leave the local value in place. Use the signed-in
Stripe Dashboard or the deployed environment for mode-sensitive inspection,
and never print a secret to prove which mode is active.

## Public API rate limits and slot holds

Apply migration `0005_heavy_warhawk.sql`, configure an environment-specific
`RATE_LIMIT_HASH_SECRET` of at least 32 bytes, and only then set
`API_RATE_LIMITING_ENABLED=1`. The limits are 120 availability requests per
minute and 12 Checkout attempts per 10 minutes for each keyed client-address
digest. A limit response is HTTP 429 with `Retry-After`; a database or secret
failure is HTTP 503 so the API never silently runs unprotected. Raw client IP
addresses are not stored.

Set `CHECKOUT_RESERVATIONS_ENABLED=1` only after the same migration is present.
The portal flag implies this setting. A new Checkout first reserves the slot in
Postgres under a stable request UUID, then creates Stripe Checkout using the
same UUID as its idempotency key. Expired or failed sessions release the hold;
paid sessions confirm it. If a rollout problem occurs, disable the new-Checkout
flag and rate-limit flag and redeploy, but preserve the database and all
existing paid/reserved rows for reconciliation.

Stripe requires a Checkout Session to remain open for at least 30 minutes. A
customer who returns through Cancel can still pay from another open Checkout
tab, so the application does not trust the cancel page to release the slot.
The abandoned hold therefore expires after Stripe's minimum window plus a
five-minute webhook grace period (roughly 36 minutes from creation). Immediate
safe release would require a signed cancellation credential and server-side
Stripe Session expiration before the database hold is released.

Set `PAYMENT_LIFECYCLE_ENABLED=1` only together with
`BOOKING_PORTAL_ENABLED=1`, after the expanded webhook subscription and Stripe
read permissions have been verified. If either flag is absent, refund/dispute
events return a retryable 503 rather than silently skipping calendar and access
cleanup.

## Third-party installer rollout

Migration `0006_smiling_devos.sql` adds `installer_type` and `installer_name`
to durable bookings. Apply it to each environment before deploying code that
writes or reads those fields. Verify `NEON_PROJECT_ID` before migration: migrate
the isolated staging database before the `staging` deployment, and the isolated
Production database before the `main` deployment. Do not point both environments
at one database.

The public value `3rd party` is represented internally as `other`. Its installer
name is required, normalized, and limited to 120 characters before Checkout.
The name has no price or onboarding effect. Stripe stores it in Checkout Session
metadata, then fulfilment persists it and includes it in calendar, portal, and
email context. Names submitted with `fomo` or `rto` are discarded server-side.
Legacy `other` payments can lack a name and should display `3rd party (name not
recorded)`; do not edit or infer one during replay.

After each deploy, smoke-test without payment first:

1. Confirm the installer order is FOMO-installed, 3rd party, FOMO rent-to-own.
2. Confirm `Installer name` appears only for 3rd party and blocks Checkout when
   empty, whitespace-only, or punctuation-only. Confirm the field limits input
   to 120 characters; use the automated/API check for a crafted longer value.
3. Enter a valid installer name, reload, and confirm the existing browser cache
   restores it; then use `Clear saved details` and confirm it stays empty.
4. Switch to FOMO-installed and confirm the hidden cached name is not sent or
   shown as booking context.
5. In staging, complete one supervised sandbox booking and confirm the same
   normalized installer appears in Stripe metadata, the durable booking,
   Microsoft event body, customer/operations email, success page, and manage
   page. Reconcile the synthetic event and records afterward.

## Refund and dispute operations

Refunds must be initiated and reviewed in Stripe. The signed webhook applies
the operational consequences:

- A full refund immediately marks the booking refunded, which denies all
  customer manage access. It then deletes the Microsoft event. Only after
  deletion is confirmed does it revoke the stored credential, release the
  slot, cancel active reschedules, and mark the calendar cancelled. A Graph
  uncertainty returns a retryable error and deliberately preserves the slot
  and credential row for recovery, but the refunded booking cannot use it.
- A partial refund marks the booking for attention but keeps the appointment,
  slot, and manage access. If transactional email is enabled, operations gets
  an internal alert at the configured operations recipient.
- A dispute uses the same retain-and-alert policy while operations reviews it
  in Stripe. The application does not decide whether to cancel a disputed
  service automatically.

These events are idempotent. Account-wide Stripe events not owned by this app
are acknowledged and ignored; an app-owned event arriving before its booking
row remains retryable. There is not yet an automatic customer email for a full
or partial refund, so operations must follow the approved customer-communication
and tax-document process outside this application.

## Required Microsoft Graph email setup

1. Create or select a dedicated Entra app registration and grant only Microsoft
   Graph `Mail.Send` application permission. Obtain administrator consent.
2. Restrict the app to `service@fomo.energy` using Exchange Online Application
   RBAC or an application access policy. Verify that sending as an unrelated
   mailbox is denied before enabling the app.
3. Create a fresh secret for the intended deployment profile. Configure
   `EMAIL_GRAPH_TENANT_ID`, `EMAIL_GRAPH_CLIENT_ID`,
   `EMAIL_GRAPH_CLIENT_SECRET`, and
   `EMAIL_GRAPH_SENDER_USER=service@fomo.energy` as server-only Vercel values.
   Never reuse an exposed or expired value.
4. On `staging`, set
   `EMAIL_OPERATIONS_TO=ops@fomo.energy`, set the controlled customer inbox
   through `EMAIL_CUSTOMER_OVERRIDE_TO`, and only then set
   `TRANSACTIONAL_EMAIL_ENABLED=1`.
5. Never set `EMAIL_CUSTOMER_OVERRIDE_TO` in Production. The application rejects
   it there, but the environment must still be clean before rollout.

Apply migration `0004_complete_kree.sql` before enabling the flag. Verify one paid
sandbox booking produces exactly one `booking_customer` and one
`booking_operations` delivery, with provider `microsoft_graph`, opaque client
references, and `sent` status. Replay the
Stripe event and confirm neither message is duplicated. Complete one supervised
reschedule and verify exactly one customer and one operations change message.
The customer email must contain the working private manage/upload link; the
operations email must not contain it.

Email rollback is to remove `TRANSACTIONAL_EMAIL_ENABLED` and redeploy. This
stops new mail but preserves payment, calendar, portal, and existing delivery
audit state. Revoke the Graph app secret or mailbox assignment only after
retained delivery records and other known consumers have been reconciled. A
booking email failure remains retryable through the signed Stripe webhook; a
failed reschedule notification is recorded for operational recovery and must
not reverse the confirmed calendar change.

Before production use, perform a paid Stripe test-mode booking and confirm:

1. A primary-calendar conflict is unavailable on the booking page.
2. A `Fomo Maintenance` calendar conflict is also unavailable.
3. A paid visit appears only in `Fomo Maintenance`.
4. The Stripe Checkout Session metadata has `calendarStatus=created`.
5. Replaying the webhook does not create a duplicate event.
6. At 10 kWp, Essential shows and charges S$199.00 before GST, S$17.91 GST, and
   S$216.91 total.
7. Stripe line items add up to the server-computed pre-GST subtotal; Stripe's
   tax and final total match the server quote; metadata carries the expected
   service code, GST breakdown, and scope.
8. The left selector labels S$199 as subject to GST while the right summary
   displays S$199.00 subtotal, S$17.91 GST, and S$216.91 total.
9. Enter sample contact/site details, reload the page, and confirm the same
   browser restores them. Use `Clear saved details`, reload again, and confirm
   the fields remain empty.

## Retired live Testing checkout

The former public S$0.50 pre-GST Testing option is removed from both staging and
Production. The checkout parser rejects attempts to restore it through a
crafted request. Use the Stripe sandbox on the stable `staging` deployment for
payment-flow testing; do not make low-value live charges for routine tests.

Historical paid `TESTING` sessions remain supported by the success page,
webhook, calendar, and email compatibility paths so a delayed replay is not
stranded. Their manage page is explicitly warned and read-only; upload-token
issuance, upload completion, and rescheduling are denied server-side. Remove
those compatibility branches only after all such sessions are outside the
agreed fulfilment and replay window.

## Stripe sandbox end-to-end environment

Use the existing Vercel project with the organisation-owned long-lived
`staging` branch and its stable
Preview alias. This is not a second Vercel app: it is an isolated Preview
environment for the same codebase. Do not replace Production Stripe variables
or point a sandbox webhook at the Production domain.

Prepare the environment in this order:

1. Create or select a Stripe sandbox for Fomo Maintenance. In that sandbox,
   create a restricted API key with only the permissions required by Checkout
   Session creation/retrieval/expiry and webhook fulfilment. Use the sandbox
   secret key only if a required permission cannot be represented by a
   restricted key.
2. In the sandbox, create an active, exclusive Singapore `GST` tax rate at 9%.
   Record its sandbox-only `txr_...` ID.
3. Add a sandbox webhook endpoint at the stable `staging` Preview alias plus
   `/api/stripe/webhook`, subscribe to the six events in the required Stripe
   setup section above, and record that endpoint's sandbox-only `whsec_...`
   signing secret.
4. Configure branch-scoped Preview variables for `staging`: sandbox
   `STRIPE_SECRET_KEY`, matching `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, sandbox
   `STRIPE_WEBHOOK_SECRET`, sandbox `STRIPE_GST_TAX_RATE_ID`, and the stable
   Preview origin as `NEXT_PUBLIC_SITE_URL`. Mark every server secret as
   sensitive. Production values must remain unchanged.
5. Use a separate Preview `DATABASE_URL`, `MANAGE_LINK_SECRET`,
   `RATE_LIMIT_HASH_SECRET`, private
   `BLOB_READ_WRITE_TOKEN`, and a dedicated Microsoft test-calendar ID. Apply
   all reviewed migrations only to the Preview database.
6. Enable `BOOKING_PORTAL_ENABLED=1` on `staging`. Enable
   `DOCUMENT_UPLOADS_ENABLED=1` only after the private Blob store is connected.
   Keep `RESCHEDULING_ENABLED=0` until Part 6 email/manage-link renewal exists,
   except during supervised rescheduling tests.
7. Redeploy the `staging` branch and book a normal Essential Health Check with
   unmistakably synthetic contact/site details. `4242 4242 4242 4242`, any
   future expiry, and any CVC succeeds only in the Stripe sandbox; it is never
   valid for Production testing.

Execution record (2026-09-02): by explicit owner instruction, the first
controlled run used the current maintenance calendar instead of a separate test
calendar. The exact synthetic event was verified, rescheduled, and then deleted;
the booking/database audit fixture remains. A distinct dedicated calendar is
still required before Production portal activation.

Verify the complete chain, not only Stripe's success page:

1. For a 10 kWp Essential booking, Checkout shows S$199.00 before GST, S$17.91
   GST, and S$216.91 total.
2. Stripe records a paid sandbox Session and sends a signed webhook that gets a
   2xx response.
3. One webhook record, one booking, one confirmed slot reservation, one manage
   credential, and one Microsoft test-calendar event exist; webhook replay
   creates no duplicates.
4. A temporary Graph failure remains retryable and recovers without creating a
   second booking or event.
5. Once Part 6 provides the manage link, its fragment exchange creates scoped
   HttpOnly cookies and reveals only that booking. Then verify private
   upload/download and supervised rescheduling against the Preview resources.
6. Remove the synthetic calendar event and reconcile any test objects after
   the run. Sandbox payments never move real money and do not affect live tax
   reporting.

## Booking portal rollout

The Drizzle schema is additive. Production uses a distinct Neon database and
enables `BOOKING_PORTAL_ENABLED=1` for durable payment, calendar, refund, and
slot state. Customer-facing capabilities remain separately controlled:
`DOCUMENT_UPLOADS_ENABLED`, `RESCHEDULING_ENABLED`, and
`TRANSACTIONAL_EMAIL_ENABLED` stay disabled until their own production
resources and controls are approved.

The isolated `staging` Preview has completed the basic provisioning, payment,
credential, private-JPEG, and supervised-reschedule path. The full boundary,
content-type, concurrency, failure-recovery, notification, and Production
checklist still applies:

Execution record (2026-09-04): migration `0005` is applied to both isolated
Neon projects. The sandbox and live Stripe webhook endpoints subscribe to the
required six events, and the live restricted key's dispute-read permission was
confirmed by an authenticated nonexistent-object request returning HTTP 404.
Production enables `BOOKING_PORTAL_ENABLED`,
`CHECKOUT_RESERVATIONS_ENABLED`, `API_RATE_LIMITING_ENABLED`, and
`PAYMENT_LIFECYCLE_ENABLED`. Production continues to omit
`DOCUMENT_UPLOADS_ENABLED`, `RESCHEDULING_ENABLED`, and
`TRANSACTIONAL_EMAIL_ENABLED`. No live Checkout or payment was created during
the rollout.

1. Provision separate Neon Preview and Production databases through the Vercel Marketplace.
2. Pull its environment variables into `.env.local` without committing them.
3. Review every file in `db/migrations/`, including the Part 4 document-quota
   migration and Part 5 Checkout/reschedule reservation migration.
4. Run `npm run verify:database` locally.
5. Generate a random `MANAGE_LINK_SECRET` of at least 32 bytes and configure it
   only in Preview.
6. Run `npm run db:migrate` separately with each intended environment's
   `DATABASE_URL`; verify `NEON_PROJECT_ID` before every migration.
7. Verify all current tables, including `api_rate_limits`, and the
   `__drizzle_migrations` journal exist.
8. Set `BOOKING_PORTAL_ENABLED=1` only after that environment is migrated, then
   redeploy. Configure the production portal secret before enabling it.
9. Exercise signed Stripe webhook replay, one simulated recovery, the Graph
   event, credential exchange, cookie flags, and `/manage` booking values.
10. Connect a private Vercel Blob store to Preview. Confirm
    `BLOB_READ_WRITE_TOKEN` is server-only, then set
    `DOCUMENT_UPLOADS_ENABLED=1` and redeploy.
11. Verify an authenticated PDF, PNG, and JPEG upload; a rejected wrong file
    signature; a 20 MB boundary; the concurrent 10-document database limit;
    private Blob URLs; and ownership-checked application downloads.
12. Keep `RESCHEDULING_ENABLED=0` while exercising two simultaneous Checkout
    attempts, two simultaneous customer changes, the 48-hour cutoff, two-change
    limit, an interrupted Graph response, idempotent retry, and Graph/booking
    reconciliation. Confirm a Checkout hold expires and a paid hold confirms.
13. Verify customer and operations reschedule notifications and manage-link
    renewal before enabling rescheduling outside Preview.
14. Disable upload, rescheduling, and email flags before rolling back their
    dependent services. Do not drop or detach a populated database as an
    application rollback; disable the portal only after reconciling paid
    bookings, calendar events, reservations, and lifecycle events.

The manage link uses `/manage#access=…`, not a path or query credential. Do not
paste a real link into logs, tickets, analytics, screenshots, or staff email.
The fragment is exchanged for an HttpOnly, same-site cookie and removed from
the address bar. The cookie uses `Path=/` so the booking page and every
`/api/manage` route receive one consistent credential; confirm the exchange
response emits exactly one `Set-Cookie` header during smoke testing. Reissuing
a credential must revoke the prior row.

Portal rollback is to remove `BOOKING_PORTAL_ENABLED` and redeploy. Do not drop
populated portal tables as an application rollback; preserve paid-booking and
document audit data, then reconcile any event left in `processing` or `failed`.
Upload-only rollback is to remove `DOCUMENT_UPLOADS_ENABLED`; this stops new
token issuance while preserving authenticated access to already accepted files.
Do not delete the Blob store until every retained document is reconciled with
its Postgres record and the approved retention policy.
Rescheduling rollback is to remove `RESCHEDULING_ENABLED`; do not try to reverse
already confirmed customer changes automatically. Reconcile any
`reschedule_requests` row left in `processing` against the Graph event before
releasing its held slot or changing the booking record.

## Manual package checks

For bookings that request cleaning, confirm safe roof access before any roof
work. The booking and calendar event mark this as pending; the application does
not determine access eligibility. Clean only panels that can be accessed safely;
the online cleaning fee excludes third-party access costs such as scaffolding
or specialist access equipment. If access cannot be confirmed after payment,
contact the customer and resolve the cleaning line item manually under the
current operations policy.

Third-party-installer first-visit onboarding is not part of online checkout and
the installer selection does not change package pricing. Do not add an
onboarding charge manually unless operations can establish that it is
applicable and has a separate approved collection process.

## Troubleshooting

- `Microsoft calendar "Fomo Maintenance" was not found`: confirm the calendar
  belongs to the configured mailbox and that the name matches exactly, or set
  `MICROSOFT_MAINTENANCE_CALENDAR_ID`.
- `More than one Microsoft calendar is named ...`: set the calendar ID to make
  the target unambiguous.
- Availability returns HTTP 503: inspect server logs for primary or maintenance
  `calendarView` failures and verify the Azure app permission and access policy.
- Stripe metadata says `calendarStatus=failed`: payment succeeded but the
  Outlook event was not created; Stripe will retry the signed webhook. Monitor
  for recovery, then reconcile manually and investigate Graph if it remains
  failed.
- Package metadata says a cleaning status is pending: this is the expected
  manual verification state, not a Graph or Stripe error.
- A new checkout request contains `monitoring=true`: the API rejects it because
  continuous monitoring is no longer offered. Legacy paid-session metadata
  remains supported by the webhook.
- Checkout reports that the payment total could not be verified: confirm
  `STRIPE_GST_TAX_RATE_ID` points to an active, exclusive 9% rate in the same
  Stripe mode as `STRIPE_SECRET_KEY`, then inspect the logged expected and
  actual totals.
- Checkout reports a Stripe permission error for Tax Rates Read: do not expand
  the restricted key. Confirm production contains the direct-tax-rate-ID fix
  and redeploy it.
- A `TESTING` event is present: validate its Stripe session and webhook result,
  then delete the calendar event. No customer service should be dispatched.

## Rollback

To roll back this package migration, revert the pricing-package commit and
redeploy the previously known-good release. Stripe sessions created before the
rollback remain valid: the webhook keeps the legacy metadata fallback so paid
bookings are not stranded. Do not partially revert only the calculator or only
the checkout route, because browser selection, server pricing, Stripe metadata,
and calendar rendering form one versioned flow.

For a separate secondary-calendar rollback, restore the previous
default-calendar Graph paths and redeploy. Existing events remain in whichever
calendar they were created and are not moved automatically.
