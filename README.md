# Fomo Maintenance

Public site for **Fomo Maintenance**, FOMO Energy’s annual solar operations and maintenance program in Singapore.

This is a FOMO Energy program, not a sister company.

## Hosting

Live site: https://fomo-maintenance.vercel.app

The booking APIs need a Node server. The live app should run on **Vercel** (Next.js, not `output: 'export'`).

GitHub Pages cannot run `/api/*`. The GitHub Actions workflow on `main` only verifies pricing and that `next build` succeeds. It does not publish a static `out/` folder.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. `npm start` serves `next start` after `npm run build`.

## Pricing checks

The package pricing (SGD) lives in `lib/pricing.ts`. The formulas below are
pre-GST. Maintenance line items are rounded to the nearest whole dollar, then
9% GST is calculated per Stripe line item to the nearest cent. The explicit
Testing checkout is the only S$0.50 pre-GST exception:

```bash
npm run verify
```

- Essential Health Check: `max(199, 149 + 5 × kWp)`
- Electrical Assurance upgrade: `150 + 5 × kWp`
- Cleaning: `max(450, 390 + 6 × kWp)`
- Testing: S$0.50 before GST / S$0.55 final live payment and integration check;
  no service offered
- Rent-to-own: do not sell; no checkout; no calendar. Point to FOMO Energy support.
- Other-installer first-visit onboarding is not charged automatically because
  the app has no durable customer/site visit history. See the rollback register.

Essential includes checking the inverter area's physical integrity, switching
and safety mechanisms; electrical checks in the inverter and DB areas; a
remote pre-check when available; and report generation. It requires no roof
access and excludes panel cleaning, deeper DC testing, repairs, and parts.

Electrical Assurance includes Essential plus deeper DC-side safety and
performance testing with professional solar testing equipment. Cleaning is an
independent add-on and is performed only after FOMO confirms safe roof access.

The left-side package selector shows pre-GST prices marked `subject to GST`.
The booking summary shows the pre-GST subtotal, 9% GST, and final amount. For
example, a 10 kWp Essential Health Check is S$199.00 before GST, S$17.91 GST,
and S$216.91 in total.

## Booking and payment

Payment success is the only moment a Microsoft calendar event is created. The browser never writes the calendar.

1. Calculator: system kWp, installer, service level, optional cleaning, or a
   mutually exclusive Testing checkout
2. Name, phone, email, site address
3. Slot picker: month calendar, next three months of weekdays, 09:00–17:00 Asia/Singapore, four-hour visits (09:00–13:00 and 13:00–17:00), skipping busy times on both the mailbox's primary calendar and the dedicated maintenance calendar
4. Pay → Stripe Checkout (hosted, pre-GST SGD line items plus 9% GST)
5. Return URLs on this site: `/book/success?session_id=…` and `/book/cancel`

Contact and site details are saved in versioned browser-local storage as they
are entered and restored on the next visit in the same browser. The form
provides a `Clear saved details` control. These saved details are not sent to
the server until the customer starts Checkout.

### API routes

| Method | Route | Role |
| --- | --- | --- |
| `POST` | `/api/availability` | Microsoft Graph checks the primary calendar for `MICROSOFT_CALENDAR_USER` and the dedicated maintenance calendar. Returns free slots. |
| `POST` | `/api/checkout` | Recomputes the pre-GST quote and GST, checks the slot is still free, applies the configured Stripe tax rate, creates a Stripe Checkout Session in SGD, and verifies Stripe's returned subtotal, tax, and total. |
| `POST` | `/api/stripe/webhook` | Verifies `Stripe-Signature`. On `checkout.session.completed`, creates the Graph event. Idempotent on the Stripe session id. |

Helpers: `lib/stripe.ts`, `lib/microsoft.ts` (client-credentials token + `@microsoft/microsoft-graph-client`).

Checkout metadata includes pricing version, service code, service level, kWp,
installer, cleaning and Testing statuses, bounded pricing/GST breakdown and
scope, customer/site details, slot, and final GST-inclusive amount in SGD cents.
Legacy monitoring fields remain fixed to not requested so older webhook records
stay compatible.

Testing is a distinct `TESTING` package, not a kWp pricing override. It creates
a real S$0.55 GST-inclusive live-mode Stripe charge and a clearly marked
calendar event so the payment-to-calendar integration can be validated. It
grants no inspection, maintenance, cleaning, monitoring, repair, or other
service entitlement.

Calendar event (webhook only, written to the dedicated maintenance calendar):

- Subject: `{serviceCode} — {address}` for package bookings; legacy paid
  sessions retain the previous Fomo Maintenance visit label
- Location: site address
- Attendees: customer email
- Body: service package, kWp, pricing breakdown, operational scope and
  exclusions, cleaning/monitoring confirmation statuses, customer/site details,
  amount paid, and Stripe session id

If Graph fails, the webhook retries once, records
`calendarStatus=failed`, and returns a retryable error to Stripe. The Graph event
uses the Checkout Session ID as its stable transaction ID, and the existing
event lookup remains a second idempotency check against duplicate retries.

### Eligibility limitations

The app has no property eligibility, customer, or site history datastore. It
therefore does not pretend to automate those decisions:

- A cleaning selection is recorded as pending safe-access confirmation. No roof
  work should proceed until operations confirms access.
- The S$120 other-installer first-visit onboarding charge is omitted until the
  app can reliably distinguish first and repeat visits.

Continuous monitoring is not offered by the calculator or checkout API.

### Environment variables

Set these in Vercel (Production + Preview) and in `.env.local`. Do not commit secrets.

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

Microsoft Graph app registration:

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
4. Event: `checkout.session.completed`

Local webhook forwarding:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use the `whsec_…` signing secret from that command as `STRIPE_WEBHOOK_SECRET` while developing.

## Journal

Articles live in `lib/journal.ts`. Append to that array to publish another piece; the journal page and the homepage teaser both read from it.
