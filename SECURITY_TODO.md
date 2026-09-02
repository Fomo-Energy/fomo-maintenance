# Security TODO

Status: Current

## Critical / High Priority

### Protect customer manage links as credentials

**Status:** In progress; the route and read-only view are implemented behind a
disabled server feature flag and have not been provisioned remotely.

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

**Status:** Planned; no upload capability or Blob store exists yet.

**Why it matters:** SLDs and PV documents may contain addresses, equipment
details, personal data, and security-sensitive electrical information.

**Required end state:**

1. Use a private store and opaque storage pathnames without customer PII.
2. Restrict content types, sizes, counts, and direct-upload authorization.
3. Require authorization for every download; never expose a permanent public
   Blob URL.
4. Establish malware-scanning, retention, deletion, and data-residency rules.
5. Protect staff access with Microsoft Entra ID and keep an access audit trail.

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
