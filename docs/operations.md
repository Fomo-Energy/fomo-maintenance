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
npm run build
```

The canonical repository is `Fomo-Energy/fomo-maintenance`. Pull requests and
pushes should run the repository's `CI` workflow and create Vercel deployments
in the `fomo-energy/fomo-maintenance` project. Production follows `main` and is
served at https://fomo-maintenance.vercel.app.

## Required Stripe GST setup

Create the tax rate in every Stripe mode used by a deployment:

1. In Stripe Dashboard, create a manual tax rate with display name `GST`,
   percentage `9`, jurisdiction/country Singapore, and tax behavior
   **exclusive**.
2. Confirm the tax rate is active.
3. Set its `txr_...` ID as `STRIPE_GST_TAX_RATE_ID` in the corresponding Vercel
   environment. The tax-rate mode must match the Stripe secret key's mode.
4. Redeploy only after the environment variable is present.

The current Vercel Development, Preview, and Production environments all use
Stripe live mode by product decision, so they share the same live tax-rate ID
and every payment is real. If Preview or Development later switches to Stripe
test keys, create a separate test-mode tax rate and replace the ID in that
environment before deploying.

Checkout deliberately fails closed if the setting is absent, Stripe rejects the
configured rate, or Stripe's returned subtotal, tax, and total do not match the
server quote. The application uses the tax-rate ID directly so the restricted
Stripe key does not need `tax_rate_read`; preserve that least-privilege setup.
Do not deploy a pricing change before the matching tax-rate ID is configured.

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

## Live Testing checkout

The public Testing option has a S$0.50 pre-GST price and makes a real S$0.55
GST-inclusive live-mode Stripe charge, then runs the normal signed-webhook and
Microsoft Graph flow. It is mutually exclusive with cleaning and carries
service code `TESTING`, a single `Testing — no service offered` Stripe line
item, and `fulfillmentStatus=no_service_offered` metadata.

Use unmistakably synthetic contact/site details. After payment, confirm the
success page reports the TESTING calendar event, verify
`calendarStatus=created` in Stripe, and delete the event so it does not block a
real appointment slot. The payment creates no service entitlement.

## Manual package checks

For bookings that request cleaning, confirm safe roof access before any roof
work. The booking and calendar event mark this as pending; the application does
not determine access eligibility. Clean only panels that can be accessed safely;
the online cleaning fee excludes third-party access costs such as scaffolding
or specialist access equipment. If access cannot be confirmed after payment,
contact the customer and resolve the cleaning line item manually under the
current operations policy.

Other-installer first-visit onboarding is not part of online checkout. Do not
add it manually unless operations can establish that it is applicable and has a
separate approved collection process.

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
