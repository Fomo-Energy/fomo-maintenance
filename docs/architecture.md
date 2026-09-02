# Architecture

Status: Current

## System map

| Capability | Owner | Notes |
| --- | --- | --- |
| Public UI | Next.js App Router in `app/` and `components/` | Calculator, booking form, journal, success/cancel pages |
| Pricing | `lib/pricing.ts` | Shared by the browser and server-side checkout recomputation |
| Booking slots | `lib/slots.ts` | Asia/Singapore weekday candidates; two four-hour windows per day |
| Payments | Stripe Checkout and `app/api/stripe/webhook/route.ts` | Stripe metadata carries the booking record; signed webhook is the booking trigger |
| Calendar integration | `lib/microsoft.ts` | Microsoft Graph application authentication, conflict checks, and event creation |
| Portal fulfilment | `lib/portal/`, `app/api/stripe/webhook/route.ts`, and Neon/Drizzle | Feature-gated database state machine claims signed Stripe events, persists paid bookings, records step recovery state, and creates/finds the Graph event |
| Customer manage access | `/api/manage/session` and `/manage` | Fragment credential is exchanged for an HttpOnly cookie; the read-only portal returns current booking data only after server-side digest, signature, expiry, and revocation checks |
| Private PV documents | `/api/manage/documents/*`, `lib/portal/documents.ts`, and Vercel Blob | Short-lived direct-upload tokens target private opaque paths; Postgres owns metadata/quota state and authenticated downloads stream through the application |
| Customer rescheduling | `/api/manage/reschedule*`, `lib/portal/rescheduling.ts`, and Microsoft Graph | Authenticated policy checks and database slot holds precede an idempotent Graph event update; Postgres changes the authoritative booking only after Graph verification |

## Pricing and package model

Customers provide kWp, installer, service level, optional cleaning or Testing
selection, contact/site details, and a visit slot. The application
does not ask about PV strings or equipment models.

The two service levels are Essential Health Check and Electrical Assurance.
Cleaning is independent. Four service codes describe the service/cleaning
combination: `ESSENTIAL`, `ELECTRICAL_ASSURANCE`, `ESSENTIAL_CLEAN`, and
`ELECTRICAL_CLEAN`. `TESTING` is a mutually exclusive S$0.50 pre-GST / S$0.55
final live-payment package whose operational scope is explicitly "no service
offered."
Continuous monitoring is not exposed in the quote model and checkout rejects
crafted requests that attempt to enable it.

Maintenance line items are rounded to whole SGD before summation; Testing is the
only S$0.50 pre-GST exception. Nine percent GST is then rounded to cents per
taxable line item. The left-side selector displays the current pre-GST price
with `subject to GST`; the booking summary displays the pre-GST subtotal, GST,
and GST-inclusive total. The browser uses the shared quote function for both,
but `/api/checkout` parses the selection and recomputes every price, tax amount,
service code, scope, and Stripe line item. Browser totals and breakdowns are
not trusted.

Checkout applies one configured manual, exclusive 9% Stripe Tax Rate to every
pre-GST line item. The restricted Stripe key does not require Tax Rates Read:
the configured resource ID is used directly. After creating the Checkout
Session, the server compares Stripe's returned subtotal, tax, and total against
the server quote; a wrong or inactive rate either fails Stripe creation or
produces a mismatch that expires the session and fails checkout closed.

Stripe metadata is versioned (`packages-v3-gst`) and carries bounded package,
pre-GST subtotal, GST, final amount, breakdown, scope, and manual-confirmation
statuses. The webhook accepts both the new metadata and legacy sessions created
before the package migration so an already-paid booking is not stranded.

Calendar creation uses the Stripe Checkout Session ID as the Microsoft Graph
transaction ID and as an extended property. The webhook performs an existing
event lookup before creation and returns a retryable error to Stripe when Graph
fulfillment still fails after the immediate retry.

## Eligibility and state boundary

There is no authoritative property-access, customer, site, or prior-visit
datastore. Cleaning access is therefore an explicit pending operational check,
not an automated eligibility claim. Cleaning is limited to safely accessible
panels, and its online price excludes third-party roof-access costs.
Other-installer first-visit onboarding is not charged because the app cannot
reliably identify a first visit. These temporary boundaries are tracked in
`docs/operations/rollback-register.md`.

## Calendar ownership and data flow

The mailbox is selected by `MICROSOFT_CALENDAR_USER`. The application reads
busy periods from two calendar sources:

1. The mailbox's primary calendar, so ordinary work commitments block booking.
2. The dedicated maintenance calendar, so existing O&M visits block booking.

The maintenance calendar is selected by
`MICROSOFT_MAINTENANCE_CALENDAR_ID` when provided. Otherwise, Graph lists the
mailbox calendars and resolves the exact
`MICROSOFT_MAINTENANCE_CALENDAR_NAME`, which defaults to `Fomo Maintenance`.
The resolved ID is cached in each running server instance.

Only the dedicated maintenance calendar receives paid booking events. The
Stripe Checkout session ID is stored as an Outlook extended property and used
as the idempotency key when webhook delivery is repeated.

Availability fails closed when the application cannot read the maintenance
calendar or cannot read the primary mailbox through either of its Graph lookup
methods.

## Customer booking portal delivery boundary

The portal is being delivered in the reviewed parts described in
`docs/booking-portal-plan.md`. Parts 1–3 now provide a dormant, feature-gated
relational and read-only portal foundation:

- `bookings` stores the paid service, customer/site details, money in integer
  cents, current slot, and external identifiers.
- `booking_access_tokens` stores only fixed-length token digests plus expiry and
  revocation state.
- `documents` stores private object metadata, never file content or a public
  download URL.
- `reschedule_requests` preserves old/new times and completion status.
- `slot_reservations` prevents two active claims on the same standard slot.
- `webhook_events` and `fulfillment_steps` provide idempotency and recovery
  state without storing raw webhook payloads.

The database client is initialized lazily so builds remain safe before
`DATABASE_URL` is provisioned. With `BOOKING_PORTAL_ENABLED` absent, the webhook
uses the established Stripe-to-Graph implementation and `/manage` does not read
the database. With the flag set to `1`, the webhook records a recoverable event
claim, re-reads the authoritative Checkout Session from Stripe, persists the
paid booking and fulfilment steps, creates or finds the Graph event, and issues
one active manage credential. Failed steps are safe for Stripe to retry; stale
processing claims can be reclaimed after five minutes.

Manage credentials use a random record UUID and an HMAC-SHA-256 signature with
an expiry 30 days after the visit. Postgres stores only the full credential's
SHA-256 digest. The emailed URL will carry the credential in a fragment, which
does not reach Vercel request logs; `/api/manage/session` exchanges it for a
same-origin HttpOnly cookie and `/manage` removes the fragment before reload.
The exchange sets one root-path HttpOnly cookie so both `/manage` and
`/api/manage` receive the same credential. A single cookie is required because
multiple `Set-Cookie` values with the same name were collapsed by the deployed
response path during Preview E2E testing. The application does not serve
unrelated authenticated features from this origin.

Part 4 keeps file bytes out of Vercel Function request bodies. The browser
uploads directly to a private Blob store using a ten-minute, pathname-bound
token issued only after the manage cookie and booking are revalidated. The
completion callback verifies the active access record, actual private object,
content type, size, and PDF/PNG/JPEG signature before marking metadata
available. Each booking has ten database-enforced active quota slots. Downloads
revalidate booking ownership and stream bytes from private storage; the Blob URL
is never returned to the customer.

Part 5 places both pre-payment Checkout holds and customer reschedule holds in
`slot_reservations`. Active windows have a partial unique database index, while
each booking can have only one active reschedule request. The reschedule flow
holds the target, rechecks both Microsoft calendars, PATCHes and rereads the
existing event, then records the new slot and releases the old reservation in
one PostgreSQL statement. If the Graph outcome is uncertain, the request stays
active and the same authenticated request key resumes it; the database never
claims a new slot merely because Graph returned an error.

## Authentication and storage

Microsoft Graph uses OAuth client credentials and the application permission
`Calendars.ReadWrite`. Stripe uses a secret API key, webhook signing secret, and
the ID of a manually configured exclusive 9% GST tax rate. The active
production flow still treats Stripe as the payment/booking record and Microsoft
Calendar as the visit schedule. Neon remains dormant until its migration,
secret, and server feature flag are deliberately applied. Name, phone, email,
and site
address are cached in versioned `localStorage` in the customer's browser, with
a form control to clear them; that cache is not an authoritative customer
record. Database credentials, secrets, token material, and environment-specific
resource IDs belong only in Vercel or `.env.local` and must not be committed.

## Deployment

The booking APIs require the Node.js runtime and are deployed on Vercel. The
GitHub Actions workflow verifies the pricing and slot rules and runs a Next.js
production build; GitHub Pages deployment is disabled. The canonical source is
the `Fomo-Energy/fomo-maintenance` GitHub repository, linked by repository ID to
the `fomo-energy/fomo-maintenance` Vercel project with `main` as its production
branch.
