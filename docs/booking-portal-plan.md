# Customer Booking Portal Delivery Plan

Status: Current

## Outcome

After a successful Stripe payment, each customer receives a secure, unique link
to a Manage Booking portal. The portal displays the confirmed appointment,
accepts private PV documents, and permits policy-compliant date/time changes.
Operations receives the corresponding booking and change notifications.

The portal extends the existing server-authoritative flow. Stripe remains the
payment source of truth, Microsoft Calendar remains the operating schedule, and
Postgres becomes the durable application record. Browser-submitted prices or
payment states are never trusted.

## Delivery parts

### Part 1 — Durable data foundation

Status: Complete and merged in pull request #22; not provisioned remotely.

Add Neon Postgres and Drizzle without connecting it to the live checkout yet.
Define bookings, hashed access tokens, document metadata, reschedule history,
slot reservations, webhook receipts, and fulfilment-step state. Add reviewed
migrations, environment documentation, and schema verification.

Exit criteria:

- A build succeeds without `DATABASE_URL`, so previews cannot fail before the
  Marketplace resource is attached.
- The migration is additive and can be reviewed before it is applied.
- Unique Stripe event/session constraints and monetary/slot invariants are
  enforced in Postgres.
- Production behavior is unchanged.

### Part 2 — Post-payment fulfilment state machine

Status: Implemented and locally verified behind a server-side feature flag;
not merged, provisioned, or enabled.

Refactor the signed Stripe webhook so it verifies the raw event, records the
event idempotently, and advances a durable database-backed state machine.
Stripe's retryable webhook delivery is the retry driver. The handler retrieves
the Checkout Session from Stripe, confirms payment, upserts the booking,
creates or finds the Microsoft event, and prepares the manage link. This avoids
a separate workflow runtime and its current vulnerable dependency chain.

Exit criteria:

- Replaying the same Stripe event creates one booking and one calendar event.
- A temporary Graph or database failure is retryable without duplicating
  completed work. Independent email recovery is added in Part 6.
- Stripe metadata remains readable for legacy paid sessions during migration.

### Part 3 — Secure Manage Booking portal

Status: Read-only portal and credential exchange implemented and locally
verified behind the same feature flag; not merged, provisioned, or enabled.

Add `/manage#access=…` as the customer entrypoint. The URL fragment is not sent
in HTTP request paths; the page exchanges it for a same-origin HttpOnly cookie
and removes it from the address bar. Credentials are HMAC-authenticated, only
their SHA-256 digest is stored, and expired or revoked credentials are rejected.
The portal shows current booking information but does not expose Stripe
identifiers or private storage URLs.

Recommended initial policy:

- The link expires 30 days after the current visit date.
- Reissuing a link revokes its predecessor.
- Sensitive mutations require CSRF-resistant, same-origin server actions or
  route handlers and fresh token validation.
- Raw tokens are excluded from application logs and analytics.

### Part 4 — Private document upload

Authorize direct uploads to a private Vercel Blob store after validating the
manage token. Store only opaque Blob pathnames plus reviewed metadata in
Postgres. Files are never public and are downloaded through an authenticated
server path.

Before implementation, operations must confirm accepted file types, maximum
size/count, retention, deletion, malware-scanning, and data-residency policy.
Suggested starting types are PDF, PNG, and JPEG; do not enable arbitrary Office
documents or archives by default.

### Part 5 — Customer rescheduling

Show the current visit and available replacements in the portal. On submission,
the server revalidates the token and policy, locks the booking record, reserves
the new slot, rechecks both Microsoft calendars, and updates the existing Graph
event. The old appointment remains authoritative until Graph confirms the
change.

Recommended initial policy:

- Allow date/time changes until 48 hours before the visit.
- Allow at most two self-service reschedules.
- Service, cleaning, address, and payment changes require operations support.
- Record the old and new slot, request time, completion state, and failure code.

Both new Checkout bookings and reschedules must use the same slot-reservation
service. Postgres protects standard four-hour slots from simultaneous customer
requests; Microsoft Graph is rechecked for ordinary mailbox conflicts.

### Part 6 — Transactional email

Use Resend and verified FOMO DNS records. Send the customer a payment/booking
confirmation containing the service, Singapore appointment time, subtotal,
GST, total paid, address, booking reference, and manage link. Send operations a
separate message. After a reschedule, notify the customer and operations with
both the previous and new time. Deterministic idempotency keys prevent duplicate
messages during retries.

This confirmation is not, by itself, an IRAS tax invoice. Xero receipt/tax
invoice generation remains a separate integration decision.

### Part 7 — Staff access, hardening, and rollout

Protect staff booking/document access with Microsoft Entra ID. Add rate limits,
audit visibility, upload scanning, retention jobs, delivery monitoring, and
operational reconciliation. Use distinct Preview and Production databases,
Blob stores, webhook secrets, and email settings.

Roll out in this order:

1. Apply the migration to Preview.
2. Exercise Stripe test-mode webhook replay and failure recovery.
3. Verify private upload and download boundaries.
4. Verify simultaneous booking/reschedule contention.
5. Verify customer and operations email delivery.
6. Apply the reviewed migration to Production.
7. Deploy behind a server-side feature flag and complete one controlled live
   Testing checkout before enabling links for service bookings.

## Runtime topology

Next.js pages, API routes, token checks, upload authorization, Stripe webhook
handling, Graph calls, and workflow steps run in Vercel's Node.js runtime.
Durable state never lives in a function instance: Neon stores relational state,
Vercel Blob stores private files, Stripe stores payment records, Microsoft
stores calendar events, and Resend performs mail delivery.

## Decisions required before later parts

1. Customer-link lifetime and reschedule cutoff/count.
2. Accepted file types, per-file size, file count, and retention period.
3. Whether uploaded files require Singapore-only data residency.
4. Operations and finance notification recipients.
5. FOMO sending domain and reply-to address.
6. Microsoft Entra group allowed into the staff portal.
