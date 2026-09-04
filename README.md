# Fomo Maintenance

Public site for **Fomo Maintenance**, FOMO Energy’s annual solar operations and maintenance program in Singapore.

This is a FOMO Energy program, not a sister company.

## Hosting

Live site: https://maintenance.fomo.energy

Staging site: https://fomo-maintenance-git-staging-fomo-energy.vercel.app

Source repository: https://github.com/Fomo-Energy/fomo-maintenance

The repository is owned by the `Fomo-Energy` GitHub organisation. Vercel's
`fomo-energy/fomo-maintenance` project tracks its `main` branch.

Production follows `main`, uses live Stripe, and is served on the custom
domain. The `staging` branch uses its stable Vercel branch alias, Stripe
sandbox, Preview Neon/Blob resources, Microsoft Graph email, and branch-scoped
feature flags. That exact branch Preview also displays a fixed red environment
banner and a public-safe operations flow guide; neither renders in Production
or unrelated feature Previews.
The default `fomo-maintenance.vercel.app` address remains an additional
Production alias because both environments share one Vercel project.

The booking APIs need a Node server. The live app should run on **Vercel** (Next.js, not `output: 'export'`).

GitHub Pages cannot run `/api/*`. The GitHub Actions workflow on `main` only verifies pricing and that `next build` succeeds. It does not publish a static `out/` folder.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. `npm start` serves `next start` after `npm run build`.

### Booking portal foundation and fulfilment

The customer Manage Booking portal uses Neon Postgres through Drizzle. Parts 1
through 5 are merged and provide durable paid-booking fulfilment, secure manage
access, private Vercel Blob uploads, authenticated downloads, database-backed
slot holds, and customer date/time changes. The organisation-owned `staging`
branch has an isolated Vercel Preview with a
migrated Neon database and private Blob store; its sandbox payment, signed
webhook, replay, portal, upload/download, and supervised reschedule checks pass.
Portal, uploads, rescheduling, and transactional email are enabled there for a
bounded team stress-test period. Production has a separate Neon database and
enables only the durable booking/slot/lifecycle foundation; customer uploads,
rescheduling, and transactional email remain disabled pending their remaining
security and operations work.
Part 6 transactional email is implemented behind
`TRANSACTIONAL_EMAIL_ENABLED=1`. It records each customer/operations delivery
with a durable idempotency key, sends payment and reschedule confirmations
from `service@fomo.energy` through Microsoft Graph, and extends the private
manage link when a later appointment would exceed its expiry. Controlled
customer and operations inbox delivery must pass on `staging` before the
transport is promoted.

```bash
npm run verify:database
npm run verify:portal
npm run verify:documents
npm run verify:rescheduling
npm run db:generate
npm run db:migrate
```

`verify:database` checks the migration history and applies the complete schema
to an isolated in-memory PostgreSQL-compatible database. `db:migrate` reads
`DATABASE_URL` from `.env.local`; review generated SQL before applying it to a
shared environment. See [`docs/booking-portal-plan.md`](docs/booking-portal-plan.md)
for the phased implementation and pending product/security decisions.

## Pricing checks

The package pricing (SGD) lives in `lib/pricing.ts`. The formulas below are
pre-GST. Maintenance line items are rounded to the nearest whole dollar, then
9% GST is calculated per Stripe line item to the nearest cent:

```bash
npm run verify
```

- Essential Health Check: `max(199, 149 + 5 × kWp)`
- Electrical Assurance upgrade: `150 + 5 × kWp`
- Cleaning: `max(450, 390 + 6 × kWp)`
- Rent-to-own: do not sell; no checkout; no calendar. Point to FOMO Energy support.
- A 3rd-party installer selection has the same online price as a FOMO-installed
  system. First-visit onboarding is not charged automatically because the app
  has no durable customer/site visit history. See the rollback register.

Essential includes checking the inverter area's physical integrity, switching
and safety mechanisms; electrical checks in the inverter and DB areas; a
remote pre-check when available; and report generation. It requires no roof
access, is recommended annually, and excludes panel cleaning, deeper DC
testing, repairs, and parts.

Electrical Assurance is recommended once every two years and includes
Essential plus thorough DC-side safety and performance testing with
professional solar testing equipment. It helps identify deteriorated cabling
and insulation that may lead to DC-related electrical faults and fires. Neither
service level requires roof access. Cleaning is an independent add-on and is
performed only after FOMO confirms safe roof access. If only part of the roof
is safely accessible, only the accessible panels are cleaned. The cleaning fee
does not include third-party access costs such as scaffolding or specialist
access equipment.

The left-side package selector shows pre-GST prices marked `subject to GST`.
The booking summary shows the pre-GST subtotal, 9% GST, and final amount. For
example, a 10 kWp Essential Health Check is S$199.00 before GST, S$17.91 GST,
and S$216.91 in total.

## Booking and payment

Payment success is the only moment a Microsoft calendar event is created. The browser never writes the calendar.

1. Calculator: system kWp, installer (`FOMO-installed`, `3rd party`, or `FOMO
   rent-to-own`), service level, and optional cleaning
2. Name, phone, email, site address, and—only for `3rd party`—the required
   installer name
3. Slot picker: month calendar, next three months of weekdays, 09:00–17:00 Asia/Singapore, four-hour visits (09:00–13:00 and 13:00–17:00), skipping busy times on both the mailbox's primary calendar and the dedicated maintenance calendar
4. Pay → Stripe Checkout (hosted, pre-GST SGD line items plus 9% GST)
5. Return URLs on this site: `/book/success?session_id=…` and `/book/cancel`

Contact and site details, including a 3rd-party installer name when entered,
are saved in versioned browser-local storage and restored on the next visit in
the same browser. The form provides a `Clear saved details` control. These
saved details are not sent to the server until the customer starts Checkout.
The saved installer name is not authoritative when another installer option is
selected.

The most recent system size, installer, service level, and cleaning selection
are also restored from versioned browser-local storage. Visit times are never
cached, because availability must be freshly retrieved and selected.

### Private PV documents

When both portal and upload flags are enabled, a customer with a valid manage
session can upload PDF, PNG, or JPEG documents directly to a private Vercel Blob
store. Each file is limited to 20 MB and each booking has ten database-enforced
active document slots. Storage pathnames contain only generated UUIDs; the
original filename remains in Postgres. A Blob completion callback verifies the
active booking credential, object size/type, and basic file signature before
the document is listed. Downloads are streamed through an ownership-checked,
no-store route and never reveal the private Blob URL.

The signature check is only a format guard. Keep uploads disabled in Production
until malware scanning, retention, deletion, data-residency, and rate-limit
requirements are approved and implemented.

### Customer date/time changes

When the portal and rescheduling flags are enabled, a paid booking with a
confirmed Microsoft event can be moved to another standard weekday slot until
48 hours before its current visit. Customers can make at most two online
changes. Service, cleaning, address, and payment details cannot be edited.

The server reserves the replacement slot in Postgres, rechecks Microsoft
availability, updates and rereads the existing event, then atomically records
the new booking time and releases the previous reservation. A retry uses the
same request key and first detects whether Graph already moved the event. New
Stripe Checkouts use the same reservation table: a 31-minute Checkout gets a
short grace-period hold, which is confirmed only after the paid webhook.

Microsoft `getSchedule` requests are split into 60-day windows so the public
three-month calendar stays below Graph's 62-day request limit.

### Transactional email

When the portal and transactional-email flags are enabled, successful paid
fulfilment sends the customer a confirmation with the booking reference,
service, installer, Singapore appointment time, address, pre-GST subtotal, 9%
GST, total paid, and private manage/upload link. Operations receives the
booking, installer, and customer contact details without the bearer-style
manage credential.

Completed customer reschedules send old/new appointment times to both parties.
The database claim is the authoritative duplicate-send guard. Each accepted
Graph request also carries deterministic client-request and `x-fomo-*` headers
for reconciliation. A Preview-only recipient override can route all customer
messages to a controlled inbox; the application rejects that override in
Production. These confirmations are not IRAS tax invoices.

### API routes

| Method | Route | Role |
| --- | --- | --- |
| `POST` | `/api/availability` | Rate-limits by a keyed digest of the client address, then asks Microsoft Graph for conflicts across the primary and maintenance calendars. Returns free slots. |
| `POST` | `/api/checkout` | Rate-limits, validates the installer selection and conditional installer name, recomputes the quote/GST, and atomically reserves the chosen slot before Stripe creation. A stable browser request key becomes the database and Stripe idempotency key. The server applies GST and verifies Stripe's returned subtotal, tax, and total. |
| `POST` | `/api/stripe/webhook` | Verifies `Stripe-Signature`, advances Checkout reservation/payment events, and fulfils paid bookings durably when the portal foundation is enabled. Full refunds cancel the Graph event, revoke access, and release the slot; partial refunds and disputes retain the visit and create an operations alert when email is enabled. |
| `POST` | `/api/manage/session` | Same-origin exchange of the manage-link fragment credential for a secure HttpOnly cookie. |
| `GET` | `/manage` | Private, non-indexed read-only view of the current paid booking. Requires the valid manage cookie. |
| `POST` | `/api/manage/documents/upload` | Authenticates the manage session, reserves one of ten database quota slots, issues a short-lived private Blob client-upload token, and validates the completion callback. |
| `GET` | `/api/manage/documents/[documentId]/download` | Authenticates booking ownership and streams the private Blob without exposing its storage URL. |
| `GET` | `/api/manage/reschedule/availability` | Returns authenticated replacement slots after combining bounded Microsoft availability with active database reservations. |
| `POST` | `/api/manage/reschedule` | Enforces the cutoff/count policy, holds the new slot, idempotently updates the existing Graph event, and commits the booking change. |

Installer fields in the `POST /api/checkout` JSON body are:

```json
{
  "installer": "other",
  "installerName": "Example Solar Pte Ltd"
}
```

`installer` is `fomo`, `other`, or `rto`. `installerName` is required only when
`installer` is `other`; after normalization it must be 1–120 characters and
contain a letter or number. It is discarded for the other selections. A
successful request returns
`{ "url": string | null, "id": string }`; validation errors return
`{ "error": string }` with HTTP 400, while slot contention returns HTTP 409.

Helpers: `lib/stripe.ts`, `lib/microsoft.ts` (client-credentials token + `@microsoft/microsoft-graph-client`).

Checkout metadata includes pricing version, service code, service level, kWp,
installer, a conditional `installerName`, cleaning status, bounded pricing/GST
breakdown and scope, customer/site details, slot, and final GST-inclusive amount
in SGD cents. The server normalizes and validates a 3rd-party name to 1–120
characters containing a letter or number; it discards the name for every other
installer selection. A legacy paid session can identify an `other` installer
without a recorded name and is displayed as such rather than guessed.
Legacy monitoring and Testing compatibility fields remain fixed to not
requested so older webhook records stay compatible. New requests that attempt
to select the retired Testing checkout are rejected server-side.

Calendar event (webhook only, written to the dedicated maintenance calendar):

- Subject: `{serviceCode} — {address}` for package bookings; legacy paid
  sessions retain the previous Fomo Maintenance visit label
- Location: site address
- Attendees: customer email
- Body: service package, installer and any recorded 3rd-party installer name,
  kWp, pricing breakdown, operational scope and exclusions,
  cleaning/monitoring confirmation statuses, customer/site details, amount
  paid, and Stripe session id

If Graph fails, the webhook retries once, records
`calendarStatus=failed`, and returns a retryable error to Stripe. The Graph event
uses the Checkout Session ID as its stable transaction ID, and the existing
event lookup remains a second idempotency check against duplicate retries.
Checkout expiry and failed asynchronous payment events release their database
holds; asynchronous payment completion runs the same durable fulfilment path.

### Eligibility limitations

The app has no property eligibility, customer, or site history datastore. It
therefore does not pretend to automate those decisions:

- A cleaning selection is recorded as pending safe-access confirmation. No roof
  work should proceed until operations confirms access.
- The S$120 other-installer first-visit onboarding charge is omitted until the
  app can reliably distinguish first and repeat visits.

Continuous monitoring is not offered by the calculator or checkout API.

### Environment variables

Set these in the specific Vercel environment and branch that owns the matching
external resources, and in `.env.local` only when local work needs them. Do not
commit secrets. Live Stripe variables are Production-only; sandbox and Preview
state credentials are scoped to the `staging` branch.

| Variable | Used for |
| --- | --- |
| `STRIPE_SECRET_KEY` | Creating Checkout Sessions and retrieving them on `/book/success` |
| `STRIPE_WEBHOOK_SECRET` | Verifying `POST /api/stripe/webhook` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard publishable key (hosted Checkout uses the session URL; keep this in sync with the secret key) |
| `STRIPE_GST_TAX_RATE_ID` | Active, exclusive 9% Singapore GST manual tax rate applied to every Checkout line item. Its Stripe mode must match `STRIPE_SECRET_KEY`; test and live rates have different IDs. |
| `NEXT_PUBLIC_SITE_URL` | Origin for `success_url` / `cancel_url` (no trailing slash). Falls back to `https://$VERCEL_URL` |
| `MICROSOFT_TENANT_ID` | Azure AD tenant for client-credentials |
| `MICROSOFT_CLIENT_ID` | App registration id |
| `MICROSOFT_CLIENT_SECRET` | App registration secret |
| `MICROSOFT_CALENDAR_USER` | Mailbox UPN/email whose primary calendar is checked for conflicts |
| `MICROSOFT_MAINTENANCE_CALENDAR_NAME` | Exact secondary-calendar name. Defaults to `Fomo Maintenance`; Graph resolves and caches its ID. |
| `MICROSOFT_MAINTENANCE_CALENDAR_ID` | Optional Graph calendar ID. When set, skips name lookup and remains stable if the calendar is renamed. |
| `DATABASE_URL` | Neon Postgres connection string for booking, event, reservation, lifecycle, and rate-limit state. Required when the portal, Checkout reservation, or API rate-limit flag is enabled. |
| `MANAGE_LINK_SECRET` | At least 32 bytes of random server-only secret material used to authenticate manage credentials. Required only when the portal flag is enabled. |
| `BOOKING_PORTAL_ENABLED` | Exact value `1` enables the database-backed webhook and `/manage` access. Omit or use another value to retain the existing Stripe-to-calendar flow. |
| `CHECKOUT_RESERVATIONS_ENABLED` | Exact value `1` enables database-first Checkout slot holds. The portal flag implies this setting. Deployments subscribed to refund/dispute events must also enable the portal so a durable booking exists. |
| `API_RATE_LIMITING_ENABLED` | Exact value `1` enables database-backed public availability and checkout limits. Requires the current database migration and hash secret. |
| `RATE_LIMIT_HASH_SECRET` | At least 32 bytes of random server-only material used to HMAC client addresses; raw addresses are not stored. Use distinct Preview and Production values. |
| `PAYMENT_LIFECYCLE_ENABLED` | Exact value `1` enables refund/dispute processing. Requires `BOOKING_PORTAL_ENABLED=1`, the migrated database, the six Stripe webhook events, and the required Stripe read permissions. |
| `BLOB_READ_WRITE_TOKEN` | Private Vercel Blob store credential. Connect the store through Vercel so this is injected; never expose it to browser code. |
| `DOCUMENT_UPLOADS_ENABLED` | Exact value `1` permits new customer upload tokens. Keep `0` until private storage and callback verification pass. |
| `RESCHEDULING_ENABLED` | Exact value `1` enables customer date/time changes. Keep `0` until Preview contention, Graph-update recovery, notifications, and operational reconciliation pass. |
| `EMAIL_GRAPH_TENANT_ID` | Entra tenant for the dedicated transactional-email app. |
| `EMAIL_GRAPH_CLIENT_ID` | Dedicated transactional-email app registration ID. Do not reuse the calendar client setting implicitly. |
| `EMAIL_GRAPH_CLIENT_SECRET` | Server-only secret for the transactional-email app. Use distinct rotated values per deployment profile. |
| `EMAIL_GRAPH_SENDER_USER` | Dedicated Microsoft 365 sender mailbox; staging uses `service@fomo.energy`. |
| `TRANSACTIONAL_EMAIL_ENABLED` | Exact value `1` enables paid-booking and reschedule messages. Keep disabled until the matching database migration, app access restriction, and recipients are verified. |
| `EMAIL_REPLY_TO` | Monitored reply-to mailbox; staging uses `service@fomo.energy`. |
| `EMAIL_OPERATIONS_TO` | Comma-separated operations/finance recipients; staging sends to `ops@fomo.energy`. |
| `EMAIL_CUSTOMER_OVERRIDE_TO` | Optional controlled Preview recipient. Forbidden when `VERCEL_ENV=production`. |

Microsoft Graph calendar app registration:

1. Application permission `Calendars.ReadWrite`
2. Admin consent
3. Create the `Fomo Maintenance` secondary calendar under `MICROSOFT_CALENDAR_USER`
4. Optionally restrict the app to `MICROSOFT_CALENDAR_USER` with an Exchange application access policy

The application checks primary-calendar conflicts and O&M-calendar conflicts,
but creates paid visits only in the O&M calendar. If the named calendar cannot
be resolved, availability and checkout fail closed instead of offering an
unchecked slot.

Stripe:

1. Checkout in SGD
2. Create a manual 9% exclusive Singapore GST tax rate in every Stripe mode the
   deployment uses, and set the matching ID as `STRIPE_GST_TAX_RATE_ID`
3. Webhook endpoint `https://<your-domain>/api/stripe/webhook`
4. Events: `checkout.session.completed`, `checkout.session.expired`,
   `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `charge.refunded`, and
   `charge.dispute.created`

Microsoft Graph transactional-email app registration:

1. Grant only the Microsoft Graph application permission `Mail.Send` and obtain
   administrator consent.
2. Restrict the app to the `service@fomo.energy` mailbox using Exchange Online
   Application RBAC or an application access policy, then test that another
   mailbox is denied.
3. Configure the four `EMAIL_GRAPH_*` variables only in the intended Vercel
   environment/branch and keep `TRANSACTIONAL_EMAIL_ENABLED=0` until migration
   and inbox tests pass.
4. Use `EMAIL_CUSTOMER_OVERRIDE_TO` for the controlled Preview inbox; remove it
   before Production and use a separately approved app secret.

Local webhook forwarding:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use the `whsec_…` signing secret from that command as `STRIPE_WEBHOOK_SECRET` while developing.

## Journal

Articles live in `lib/journal.ts`. Append to that array to publish another piece; the journal page and the homepage teaser both read from it.
