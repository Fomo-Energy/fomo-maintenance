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

Before production use, perform a paid Stripe test-mode booking and confirm:

1. A primary-calendar conflict is unavailable on the booking page.
2. A `Fomo Maintenance` calendar conflict is also unavailable.
3. A paid visit appears only in `Fomo Maintenance`.
4. The Stripe Checkout Session metadata has `calendarStatus=created`.
5. Replaying the webhook does not create a duplicate event.
6. Stripe line items add up to the server-computed total and metadata carries
   the expected service code, breakdown, and scope.

## Live Testing checkout

The public Testing option makes a real S$0.50 live-mode Stripe charge and then
runs the normal signed-webhook and Microsoft Graph flow. It is mutually
exclusive with cleaning and monitoring and carries service code `TESTING`, a
single `Testing — no service offered` Stripe line item, and
`fulfillmentStatus=no_service_offered` metadata.

Use unmistakably synthetic contact/site details. After payment, confirm the
success page reports the TESTING calendar event, verify
`calendarStatus=created` in Stripe, and delete the event so it does not block a
real appointment slot. The payment creates no service entitlement.

## Manual package checks

For bookings that request cleaning, confirm safe roof access before any roof
work. The booking and calendar event mark this as pending; the application does
not determine access eligibility. If access cannot be confirmed after payment,
contact the customer and resolve the cleaning line item manually under the
current operations policy.

For monitoring selections, confirm equipment compatibility before activation.
The UI restricts monitoring to FOMO-installed systems, but the application does
not have an equipment registry. Resolve an incompatible paid selection manually
under the current operations policy.

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
- Package metadata says a cleaning or monitoring status is pending: this is the
  expected manual verification state, not a Graph or Stripe error.
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
