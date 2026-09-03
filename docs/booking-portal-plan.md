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

Status: Complete and merged in pull request #22. Migrated in the isolated
`staging` Preview; Production is not provisioned.

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

Status: Complete and merged in pull request #23 behind a server-side feature
flag. Enabled and payment/replay tested in `staging`; Production remains disabled.

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

Status: Complete and merged in pull request #23 behind the same feature flag.
The `staging` portal passed credential exchange and booking-isolation checks;
Production remains disabled.

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

Status: Complete and merged in pull request #24 behind
`DOCUMENT_UPLOADS_ENABLED=1`. A private Singapore-region Preview Blob store
passed authenticated upload/download and unauthenticated rejection checks;
Production remains disabled.

Authorize direct uploads to a private Vercel Blob store after validating the
manage token. Store only opaque Blob pathnames plus reviewed metadata in
Postgres. Files are never public and are downloaded through an authenticated
server path.

The safe interim limits are PDF, PNG, and JPEG; 20 MB per file; and 10 active
documents per booking. Blob pathnames are opaque, content type and file
signature are checked after upload, and the database enforces the concurrent
ten-file limit. Abandoned upload intents release their quota slot after one
hour. Downloads stream through an ownership-checked route and never expose the
private Blob URL.

Before production activation, operations must still confirm retention,
customer deletion, malware-scanning, and data-residency policy. Do not enable
arbitrary Office documents or archives. Basic file-signature validation is not
a substitute for malware scanning.

### Part 5 — Customer rescheduling

Status: Complete and merged in pull request #25 behind
`RESCHEDULING_ENABLED=1`. One supervised `staging` change passed across Postgres and
Microsoft Graph; the flag is temporarily enabled on `staging` for the bounded
team stress test, and Production has never enabled it.

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

The implementation uses a 31-minute Stripe Checkout expiry plus a 15-minute
webhook grace period. An active reschedule has one database hold and one active
request per booking. Graph is updated and reread before Postgres changes the
authoritative booking time; an uncertain response is resumed with the same
request key. Operations must reconcile an abandoned active request before
Production activation. Reschedule confirmation emails and manage-link renewal
are implemented in Part 6; the flag is enabled only on `staging` for the
bounded team stress test and must stay off in Production until rollout approval.

### Part 6 — Transactional email

Status: Microsoft Graph transport implemented behind
`TRANSACTIONAL_EMAIL_ENABLED=1`; the new migration and rotated mailbox-scoped
credential must be applied to `staging` before controlled delivery is repeated.

Use Microsoft Graph and a dedicated `Mail.Send` application restricted to the
`service@fomo.energy` mailbox. Send the customer a payment/booking confirmation
containing the service, Singapore appointment time, subtotal, GST, total paid,
address, booking reference, and manage link. Send operations a separate
message. After a reschedule, notify the customer and operations with both the
previous and new time. Deterministic database claims prevent duplicate messages
during retries.

The implementation stores delivery state and an opaque Graph client-request
reference without storing rendered bodies or raw manage tokens. Graph returns
HTTP 202 without a server message ID, so the database—not the provider—is the
idempotency boundary. The customer receives the private link; operations does
not. Preview can force customer messages into one controlled test inbox, while
Production rejects that override. A later appointment renews the manage
credential before notification when required.

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
7. Deploy behind server-side feature flags and complete a controlled sandbox
   service booking on `staging` before enabling links in Production.

## Runtime topology

Next.js pages, API routes, token checks, upload authorization, Stripe webhook
handling, Graph calls, and workflow steps run in Vercel's Node.js runtime.
Durable state never lives in a function instance: Neon stores relational state,
Vercel Blob stores private files, Stripe stores payment records, Microsoft
stores calendar events, and Microsoft Graph sends mail from the dedicated
Microsoft 365 mailbox.

## Decisions required before later parts

1. Customer-link lifetime and reschedule cutoff/count.
2. Accepted file types, per-file size, file count, and retention period.
3. Whether uploaded files require Singapore-only data residency.
4. Operations and finance notification recipients.
5. Production transactional-email app, mailbox restriction, and reply-to address.
6. Microsoft Entra group allowed into the staff portal.
