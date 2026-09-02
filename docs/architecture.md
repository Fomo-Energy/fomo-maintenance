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

## Pricing and package model

Customers provide kWp, installer, service level, optional cleaning or Testing
selection, contact/site details, and a visit slot. The application
does not ask about PV strings or equipment models.

The two service levels are Essential Health Check and Electrical Assurance.
Cleaning is independent. Four service codes describe the service/cleaning
combination: `ESSENTIAL`, `ELECTRICAL_ASSURANCE`, `ESSENTIAL_CLEAN`, and
`ELECTRICAL_CLEAN`. `TESTING` is a mutually exclusive S$0.50 live-payment
package whose operational scope is explicitly "no service offered."
Continuous monitoring is not exposed in the quote model and checkout rejects
crafted requests that attempt to enable it.

Maintenance line items are rounded to whole SGD before summation; Testing is the
only S$0.50 exception. The browser uses the shared quote function for display,
but `/api/checkout` parses the selection and recomputes every price, service
code, scope, and Stripe line item. Browser totals and breakdowns are not trusted.

Stripe metadata is versioned and carries bounded package, breakdown, scope, and
manual-confirmation statuses. The webhook accepts both the new metadata and
legacy sessions created before the package migration so an already-paid booking
is not stranded.

Calendar creation uses the Stripe Checkout Session ID as the Microsoft Graph
transaction ID and as an extended property. The webhook performs an existing
event lookup before creation and returns a retryable error to Stripe when Graph
fulfillment still fails after the immediate retry.

## Eligibility and state boundary

There is no authoritative property-access, customer, site, or prior-visit
datastore. Cleaning access is therefore an explicit pending operational check,
not an automated eligibility claim. Other-installer first-visit onboarding is
not charged because the app cannot reliably identify a first visit. These
temporary boundaries are tracked in `docs/operations/rollback-register.md`.

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

## Authentication and storage

Microsoft Graph uses OAuth client credentials and the application permission
`Calendars.ReadWrite`. Stripe uses a secret API key and a webhook signing
secret. No application database exists: Stripe is the payment/booking record,
and Microsoft Calendar is the visit schedule. This is not sufficient for
durable customer/site eligibility state. Secrets belong only in Vercel or
`.env.local` and must not be committed.

## Deployment

The booking APIs require the Node.js runtime and are deployed on Vercel. The
GitHub Actions workflow verifies the pricing and slot rules and runs a Next.js
production build; GitHub Pages deployment is disabled.
