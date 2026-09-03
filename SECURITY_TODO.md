# Security TODO

Status: Current

## Dependency audit

The deployed dependency tree is clean after upgrading to Next.js 16.3.4 and
its patched PostCSS dependency. `npm audit --omit=dev` is a required release
check. The full development-tree audit still reports moderate findings through
`drizzle-kit` and its older build-tool dependency; these do not ship in the
Vercel runtime and remain tracked for a future Drizzle upgrade.

## Critical / High Priority

### Protect transactional booking email and manage credentials

**Status:** In progress; database idempotency, Preview recipient override, HTML
escaping, and customer-only manage-link delivery are implemented. Staging uses
a fresh dedicated Microsoft Graph credential and a verified mailbox-restricting
Exchange Application Access Policy; Production is disabled.

**Why it matters:** Confirmation messages contain customer contact, address,
appointment and payment-summary data. The customer message also carries a
bearer-style manage credential that grants private booking and document access.

**Required end state:**

1. Completed for Preview: use a dedicated Entra app with only `Mail.Send` and
   restrict it to `service@fomo.energy`. Provision a separate rotated Production
   secret before rollout.
2. Keep the customer credential out of operations email, database email rows,
   Graph message headers, application logs, and error messages.
3. Confirm the Preview-only customer-recipient override cannot operate in
   Production and remove it from Production configuration.
4. Add Exchange/Graph delivery reconciliation for accepted, delivered,
   rejected, and uncertain messages plus staff recovery. Graph `sendMail`
   returns HTTP 202 without a server message ID.
5. Confirm Microsoft 365 message retention and audit policy before Production.
6. Add rate limits and staff-only credential revocation/reissue before broad
   portal activation.
7. Replace the legacy Exchange Application Access Policy with Exchange App RBAC
   after Microsoft's tenant upgrade permits organisation customization. Re-test
   allowed and denied mailboxes before retiring the fallback policy.

### Rotate exposed Entra client secrets

**Status:** Open as of 2026-09-03.

**Why it matters:** A local redaction command displayed the values from both
candidate Entra credential records in task output. They must be treated as
exposed even though neither value is committed to this repository.

**Required end state:**

1. Create replacement secrets for both affected app registrations.
2. Update every known Vercel and monitoring consumer before revoking the old
   values; do not interrupt the calendar or dark-site alert flows.
3. Revoke both exposed values, test each consumer, and update this register
   without recording any secret material.

### Protect customer manage links as credentials

**Status:** In progress; Preview credential exchange and the read-only view are
validated, including a single root-path HttpOnly cookie. Production remains
disabled.

**Why it matters:** Anyone possessing a bearer-style manage URL could otherwise
view booking details, upload files, or request an appointment change.

**Required end state:**

1. Completed in code: issue credentials only in paid webhook fulfilment; sign
   them with HMAC-SHA-256 and persist only SHA-256 digest/state.
2. Completed in code: carry the credential in a URL fragment, exchange it for
   an HttpOnly same-site cookie, strip the fragment, and revalidate signature,
   digest, expiry, and revocation on every read.
3. Before activation: verify no third-party analytics captures fragments or
   manage-page content and confirm Vercel runtime logs contain no credential.
4. Add rate limits plus explicit staff revocation/reissue controls before
   document upload or rescheduling is enabled.
5. Rotate `MANAGE_LINK_SECRET` through Vercel secret management and document
   the resulting invalidation of outstanding credentials.

### Keep uploaded PV documents private

**Status:** In progress; a private Preview Blob store passed authenticated
upload/download and unauthenticated-access checks. Production remains disabled,
and scanning/retention policy is not complete.

**Why it matters:** SLDs and PV documents may contain addresses, equipment
details, personal data, and security-sensitive electrical information.

**Required end state:**

1. Completed in code: private Blob access, opaque UUID pathnames, short-lived
   pathname-bound direct-upload tokens, and no Blob URL in customer output.
2. Completed in code: PDF/PNG/JPEG allow-list, 20 MB maximum, file-signature
   validation, and ten database-enforced active quota slots per booking.
3. Completed in code: every download revalidates the manage credential and
   booking ownership, then streams through a no-store application response.
4. Before activation: add rate limiting and verify callback authenticity,
   private access, signature rejection, concurrent quota, and log redaction in
   a Preview Blob store.
5. Establish malware scanning, retention, customer deletion, and data-residency
   policy before Production; basic signature checks do not detect malware.
6. Protect future staff access with Microsoft Entra ID and retain an access
   audit trail.

### Harden customer rescheduling before activation

**Status:** In progress; one supervised Preview reschedule passed across Graph
and Postgres, and rescheduling is temporarily enabled on `staging` for team
stress testing. Notifications are implemented and delivered in controlled
tests; rate limiting, concurrency/failure-recovery exercises, and recovery
operations remain open.

**Why it matters:** A stolen manage credential or concurrent request could move
an appointment, consume scarce visit capacity, or leave Graph and Postgres out
of sync.

**Required end state:**

1. Completed in code: server-side 48-hour cutoff, two-change limit, strict
   standard-slot validation, same-origin mutation, one active request per
   booking, and database-unique active slot holds.
2. Completed in code: Graph is rechecked, the existing event is PATCHed and
   reread, and Postgres changes only after Graph confirms; retry keys recover an
   interrupted response without applying a second change.
3. Before activation: add per-booking/IP rate limits and exercise concurrent
   Checkout/reschedule attempts against Preview Neon and Graph.
4. Implemented in code: customer/operations notifications and manage-link
   renewal when a later visit would outlive its current expiry. Controlled
   Preview delivery is verified; complete replay and failed-delivery recovery
   checks before Production activation.
5. Document and test staff reconciliation for an active request whose Graph
   outcome remains uncertain. Retain old/new times and failure state for audit.

## Medium Priority

### Upgrade vulnerable framework and migration-tool dependencies

**Status:** Open; production audit reports one high and one moderate advisory,
and the migration CLI adds development-only moderate advisories.

**Why it matters:** The available production remediation requires a semver-major
Next.js upgrade, while Drizzle Kit currently carries older development-only
esbuild tooling. Forcing either automated remediation into the portal foundation
would combine unrelated major-version risk with this feature.

**Required end state:**

1. Upgrade Next.js and its bundled PostCSS through a separately tested major
   framework migration.
2. Recheck Drizzle Kit releases and remove its development-only advisory chain
   when an upstream-safe version is available.
3. Keep migration tooling out of the production dependency set and never expose
   its local development server to untrusted networks.

### Minimize durable customer data

**Status:** In progress in the schema foundation.

**Why it matters:** The new database will become the authoritative copy of
customer contact, address, payment-summary, and appointment data.

**Required end state:**

1. Keep database access server-only and grant least-privilege credentials.
2. Do not store raw Stripe webhook payloads or payment instrument data.
3. Redact PII and external error bodies from logs and failure fields.
4. Document and automate the approved customer/document retention schedule.
