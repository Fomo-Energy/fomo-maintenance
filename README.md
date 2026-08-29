# Fomo Maintenance

Public site for **Fomo Maintenance**, FOMO Energy’s annual solar operations and maintenance program in Singapore.

This is a FOMO Energy program, not a sister company.

## Hosting

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

The stepped annual tariff (SGD) lives in `lib/pricing.ts`. Required examples:

```bash
npm run verify:pricing
npm run verify:slots
```

- First 10 kWp: S$40 / kWp
- Next 30 kWp (10–40): S$20 / kWp
- Above 40 kWp: S$5 / kWp
- Advanced preventive: +25% of Condition & Standard
- Monitoring: +12.5% of Condition & Standard, Fomo-installed only
- Rent-to-own: do not sell; no checkout; no calendar. Point to FOMO Energy support.
- Other-installer: indicative until a site check; they can pay to book a site-check visit.

## Booking and payment

Payment success is the only moment a Microsoft calendar event is created. The browser never writes the calendar.

1. Calculator on the homepage
2. Name, phone, email, site address
3. Slot picker: next 14 weekdays, 09:00–17:00 Asia/Singapore, two-hour visits, skipping busy times on the ops mailbox
4. Pay → Stripe Checkout (hosted, SGD cents)
5. Return URLs on this site: `/book/success?session_id=…` and `/book/cancel`

### API routes

| Method | Route | Role |
| --- | --- | --- |
| `POST` | `/api/availability` | Microsoft Graph `getSchedule` and `calendarView` for `MICROSOFT_CALENDAR_USER`. Returns free slots. |
| `POST` | `/api/checkout` | Recomputes the quote, checks the slot is still free, creates a Stripe Checkout Session in SGD. |
| `POST` | `/api/stripe/webhook` | Verifies `Stripe-Signature`. On `checkout.session.completed`, creates the Graph event. Idempotent on the Stripe session id. |

Helpers: `lib/stripe.ts`, `lib/microsoft.ts` (client-credentials token + `@microsoft/microsoft-graph-client`).

Checkout metadata: `kwp`, `installer`, `extras`, `name`, `phone`, `email`, `address`, `slotStart`, `slotEnd`, `amount` (SGD cents).

Calendar event (webhook only):

- Subject: `Fomo Maintenance visit — {address}`
- Location: site address
- Attendees: customer email
- Body: kWp, scope, amount paid, Stripe session id

If Graph fails, the webhook retries once, logs the booking, sets Stripe session metadata `calendarStatus=failed` for ops, and still returns **200** so Stripe does not retry-storm.

### Environment variables

Set these in Vercel (Production + Preview) and in `.env.local`. Do not commit secrets.

| Variable | Used for |
| --- | --- |
| `STRIPE_SECRET_KEY` | Creating Checkout Sessions and retrieving them on `/book/success` |
| `STRIPE_WEBHOOK_SECRET` | Verifying `POST /api/stripe/webhook` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard publishable key (hosted Checkout uses the session URL; keep this in sync with the secret key) |
| `NEXT_PUBLIC_SITE_URL` | Origin for `success_url` / `cancel_url` (no trailing slash). Falls back to `https://$VERCEL_URL` |
| `MICROSOFT_TENANT_ID` | Azure AD tenant for client-credentials |
| `MICROSOFT_CLIENT_ID` | App registration id |
| `MICROSOFT_CLIENT_SECRET` | App registration secret |
| `MICROSOFT_CALENDAR_USER` | Mailbox UPN/email whose calendar is read/written |

Microsoft Graph app registration:

1. Application permission `Calendars.ReadWrite`
2. Admin consent
3. Optionally restrict the app to `MICROSOFT_CALENDAR_USER` with an Exchange application access policy

Stripe:

1. Checkout in SGD
2. Webhook endpoint `https://<your-domain>/api/stripe/webhook`
3. Event: `checkout.session.completed`

Local webhook forwarding:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use the `whsec_…` signing secret from that command as `STRIPE_WEBHOOK_SECRET` while developing.

## Journal

Articles live in `lib/journal.ts`. Append to that array to publish another piece; the journal page and the homepage teaser both read from it.
