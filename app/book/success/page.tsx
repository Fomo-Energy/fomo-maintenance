import type { ReactNode } from "react";
import Link from "next/link";
import { formatSgd } from "@/lib/pricing";
import { databaseIsConfigured } from "@/lib/database";
import { findBookingByStripeSessionId } from "@/lib/portal/bookings";
import { bookingPortalEnabled } from "@/lib/portal/config";
import { QUOTE_EMAIL } from "@/lib/site";
import { formatSlotRange } from "@/lib/slots";
import { getStripe } from "@/lib/stripe";
import { formatInstaller } from "@/lib/installer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Payment and booking status",
  description: "Payment and scheduling status for a Fomo Maintenance visit.",
};

type SuccessPageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function BookSuccessPage({ searchParams }: SuccessPageProps) {
  const { session_id: sessionId } = await searchParams;

  if (!sessionId) {
    return (
      <ConfirmShell title="Booking details unavailable">
        <p>
          Open this page from the Stripe return link so we can verify payment
          and show the visit details.
        </p>
        <HomeLink />
      </ConfirmShell>
    );
  }

  try {
    const [session, portalBooking] = await Promise.all([
      getStripe().checkout.sessions.retrieve(sessionId),
      bookingPortalEnabled() && databaseIsConfigured()
        ? findBookingByStripeSessionId(sessionId).catch(() => null)
        : Promise.resolve(null),
    ]);
    const paid = session.payment_status === "paid";
    const metadata = session.metadata ?? {};
    const address = metadata.address || "—";
    const packageName = metadata.package;
    const installerLabel = formatInstaller(
      metadata.installer,
      metadata.installerName,
    );
    const calendarStatus =
      portalBooking?.calendarStatus || metadata.calendarStatus || "pending";
    const testing = metadata.testing === "1";
    const slotStart = metadata.slotStart;
    const slotEnd = metadata.slotEnd;
    const amountCents =
      typeof session.amount_total === "number"
        ? session.amount_total
        : Number.parseInt(metadata.amount || "0", 10);
    const amountLabel = Number.isFinite(amountCents)
      ? formatSgd(amountCents / 100)
      : metadata.amountSgd || "—";
    const slotLabel =
      slotStart && slotEnd ? formatSlotRange(slotStart, slotEnd) : "—";

    if (!paid) {
      return (
        <ConfirmShell title="Payment not complete">
          <p>
            Stripe has not marked this checkout as paid. Nothing is on the
            operations calendar yet.
          </p>
          <HomeLink />
        </ConfirmShell>
      );
    }

    return (
      <ConfirmShell
        title={
          calendarStatus === "created" || calendarStatus === "exists"
            ? testing
              ? "Test payment received — calendar event created"
              : "Payment received — visit scheduled"
            : calendarStatus === "failed"
              ? "Payment received — scheduling needs attention"
              : "Payment received — scheduling in progress"
        }
      >
        <CalendarStatusNotice
          calendarStatus={calendarStatus}
          sessionId={sessionId}
          testing={testing}
        />
        {testing ? (
          <p className="mt-4 rounded-xl border border-orange-200 bg-white px-4 py-3 text-left text-sm font-semibold text-ink">
            For testing purposes, no service is offered. Delete the TESTING
            event from the operations calendar after validation.
          </p>
        ) : null}
        <dl className="mt-8 space-y-4 text-left text-sm">
          {packageName ? (
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Package
              </dt>
              <dd className="mt-1 font-semibold text-ink">{packageName}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Installer
            </dt>
            <dd className="mt-1 font-semibold text-ink">{installerLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Visit time
            </dt>
            <dd className="mt-1 font-semibold text-ink">{slotLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Site address
            </dt>
            <dd className="mt-1 font-semibold text-ink whitespace-pre-wrap">
              {address}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Amount paid
            </dt>
            <dd className="mt-1 font-semibold text-ink">{amountLabel}</dd>
          </div>
        </dl>
        {metadata.cleaningAccessStatus === "pending_confirmation" ? (
          <p className="mt-6 rounded-xl bg-white px-4 py-3 text-left text-sm text-slate-600">
            Cleaning is requested. The team will confirm safe roof access
            before any roof work is performed. If access cannot be confirmed,
            the team will contact you to resolve the cleaning charge.
          </p>
        ) : null}
        {metadata.monitoringCompatibilityStatus === "pending_confirmation" ? (
          <p className="mt-3 rounded-xl bg-white px-4 py-3 text-left text-sm text-slate-600">
            Continuous monitoring is requested and remains subject to system
            compatibility confirmation.
          </p>
        ) : null}
        <p className="mt-8 text-sm text-slate-500">
          Questions:{" "}
          <a className="font-semibold text-ink" href={`mailto:${QUOTE_EMAIL}`}>
            {QUOTE_EMAIL}
          </a>
        </p>
        <HomeLink />
      </ConfirmShell>
    );
  } catch {
    return (
      <ConfirmShell title="Booking status unavailable">
        <p>
          Payment may still have gone through. Check your email from Stripe, or
          write to{" "}
          <a className="font-semibold text-ink" href={`mailto:${QUOTE_EMAIL}`}>
            {QUOTE_EMAIL}
          </a>
          .
        </p>
        <HomeLink />
      </ConfirmShell>
    );
  }
}

function ConfirmShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-peach">
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <p className="text-brand-on-light text-sm font-semibold uppercase tracking-[0.2em]">
          Fomo Maintenance
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">{title}</h1>
        <div className="mt-4 text-base leading-7 text-slate-600">{children}</div>
      </div>
    </div>
  );
}

function CalendarStatusNotice({
  calendarStatus,
  sessionId,
  testing,
}: {
  calendarStatus: string;
  sessionId: string;
  testing: boolean;
}) {
  if (calendarStatus === "created" || calendarStatus === "exists") {
    return (
      <p className="rounded-xl bg-white px-4 py-3 text-left" role="status">
        {testing
          ? "Payment is confirmed and the TESTING event is on the operations calendar."
          : "Payment is confirmed and the visit is on the operations calendar. Keep the details below."}
      </p>
    );
  }

  if (calendarStatus === "failed") {
    const subject = encodeURIComponent(
      `Scheduling help for Stripe session ${sessionId}`,
    );
    return (
      <div
        className="rounded-xl border border-red-200 bg-white px-4 py-3 text-left"
        role="alert"
      >
        <p>
          Payment is confirmed, but the calendar event could not be created.
          Your payment and scheduling status are separate.
        </p>
        <p className="mt-2 text-sm">
          Email{" "}
          <a
            className="font-semibold text-ink underline"
            href={`mailto:${QUOTE_EMAIL}?subject=${subject}`}
          >
            {QUOTE_EMAIL}
          </a>{" "}
          with reference <span className="font-semibold">{sessionId}</span> so
          the team can place the visit manually.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white px-4 py-3 text-left" role="status">
      <p>
        Payment is confirmed. {testing ? "The TESTING event" : "Calendar confirmation"}{" "}
        has not been recorded yet; it may still be processing.
      </p>
      <Link
        href={`/book/success?session_id=${encodeURIComponent(sessionId)}`}
        className="mt-2 inline-block text-sm font-semibold text-ink underline"
      >
        Check scheduling status again
      </Link>
    </div>
  );
}

function HomeLink() {
  return (
    <p className="mt-10">
      <Link href="/#book" className="cta-pill px-7 py-3 text-sm">
        Back to Fomo Maintenance
      </Link>
    </p>
  );
}
