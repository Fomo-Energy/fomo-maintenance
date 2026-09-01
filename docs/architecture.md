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
and Microsoft Calendar is the visit schedule. Secrets belong only in Vercel or
`.env.local` and must not be committed.

## Deployment

The booking APIs require the Node.js runtime and are deployed on Vercel. The
GitHub Actions workflow verifies the pricing and slot rules and runs a Next.js
production build; GitHub Pages deployment is disabled.
