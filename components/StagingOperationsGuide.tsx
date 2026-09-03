import React from "react";

const flowSteps = [
  {
    title: "Customer completes sandbox Checkout",
    detail:
      "Stripe validates a sandbox card and records a test payment. No card is charged and no live Stripe funds move.",
  },
  {
    title: "The signed webhook fulfils the booking",
    detail:
      "After Stripe reports a paid session, the app saves the booking in the staging database, confirms the slot, creates the manage link, and writes a real event to the currently configured Microsoft maintenance calendar.",
  },
  {
    title: "Microsoft Graph sends both confirmations",
    detail:
      "The customer confirmation contains the service, date and time, payment breakdown, booking reference, and private Manage Booking link. The operations copy contains the booking and contact details but never the private link.",
  },
  {
    title: "The customer can manage the visit",
    detail:
      "The private link lets the customer upload PV documents and request an available replacement date and time. A confirmed change updates the real Microsoft calendar event and triggers customer and operations reschedule messages.",
  },
] as const;

const emailRoutes = [
  {
    audience: "Customer booking and reschedule emails",
    destination:
      "Redirected to the controlled staging customer inbox, not the email entered in the form.",
    contents: "Includes the private Manage Booking and upload link.",
  },
  {
    audience: "Operations booking and reschedule emails",
    destination: "Sent to ops@fomo.energy.",
    contents: "Includes booking and contact details, without the private link.",
  },
  {
    audience: "Replies",
    destination: "Sent to service@fomo.energy.",
    contents:
      "Both confirmation types are sent from service@fomo.energy and direct replies there.",
  },
  {
    audience: "Microsoft calendar invitation or update",
    destination: "Sent to the email entered in the booking form.",
    contents:
      "The staging transactional-email override does not change the calendar attendee.",
  },
  {
    audience: "Document upload",
    destination: "No email is sent currently.",
    contents:
      "Operations must inspect the booking record or private document store during testing.",
  },
] as const;

export function StagingOperationsGuide() {
  return (
    <section
      id="staging-operations"
      aria-labelledby="staging-operations-title"
      data-staging-operations-guide
      className="scroll-mt-32 border-y-4 border-red-700 bg-red-50 text-ink"
    >
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-800">
          Staging operations guide
        </p>
        <h2
          id="staging-operations-title"
          className="mt-3 max-w-4xl text-3xl font-bold tracking-tight md:text-4xl"
        >
          What happens after a test payment
        </h2>
        <div
          role="note"
          aria-label="Important staging side effects"
          className="mt-6 max-w-4xl rounded-2xl border-2 border-red-700 bg-white p-5 text-sm leading-6 text-slate-700 md:text-base md:leading-7"
        >
          <p className="font-bold text-red-800">
            Stripe is sandboxed, but Microsoft calendar and email actions are
            real.
          </p>
          <p className="mt-2">
            Use a sandbox card and unmistakably synthetic booking details. A
            successful test creates a real event in the currently configured
            maintenance calendar and sends real email. The booking email is
            also added as the calendar attendee, so Microsoft may send that
            address an invitation or update even though the transactional
            customer email is redirected.
          </p>
        </div>

        <ol className="mt-10 grid gap-4 md:grid-cols-2" aria-label="Booking flow">
          {flowSteps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-700 text-sm font-bold text-white"
                >
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-bold text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {step.detail}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
          <div>
            <h3 className="text-xl font-bold">Where each email goes</h3>
            <div className="mt-4 overflow-hidden rounded-2xl border border-red-200 bg-white">
              <dl className="divide-y divide-red-100">
                {emailRoutes.map((route) => (
                  <div
                    key={route.audience}
                    className="grid gap-2 p-5 sm:grid-cols-[11rem_minmax(0,1fr)]"
                  >
                    <dt className="font-bold text-ink">{route.audience}</dt>
                    <dd className="text-sm leading-6 text-slate-600">
                      <p>{route.destination}</p>
                      <p className="mt-1">{route.contents}</p>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <aside aria-labelledby="staging-limitations-title">
            <h3 id="staging-limitations-title" className="text-xl font-bold">
              Current operating limits
            </h3>
            <ul className="mt-4 list-disc space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-6 pl-10 text-sm leading-6 text-slate-700">
              <li>
                A failed initial booking email remains retryable through the
                signed Stripe webhook; duplicate sends are guarded by the
                staging database.
              </li>
              <li>
                A confirmed reschedule is not rolled back if its email fails.
                The notification remains pending for operations to recover.
              </li>
              <li>
                There is no staff dashboard or automatic escalation for a
                stuck notification yet. Check delivery records and Vercel logs
                during testing.
              </li>
              <li>
                Reconcile test bookings and remove synthetic calendar events
                after each end-to-end run.
              </li>
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
}
