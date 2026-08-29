import type { ReactNode } from "react";
import Link from "next/link";
import { formatSgd } from "@/lib/pricing";
import { QUOTE_EMAIL } from "@/lib/site";
import { formatSlotRange } from "@/lib/slots";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Booking confirmed",
  description: "Payment received for a Fomo Maintenance visit.",
};

type SuccessPageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function BookSuccessPage({ searchParams }: SuccessPageProps) {
  const { session_id: sessionId } = await searchParams;

  if (!sessionId) {
    return (
      <ConfirmShell title="Payment received">
        <p>Open this page from the Stripe return link so we can show the visit details.</p>
        <HomeLink />
      </ConfirmShell>
    );
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === "paid";
    const metadata = session.metadata ?? {};
    const address = metadata.address || "—";
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
      <ConfirmShell title="Payment received">
        <p>
          The visit is added to the operations calendar after Stripe confirms
          payment, not from this browser. Keep these details.
        </p>
        <dl className="mt-8 space-y-4 text-left text-sm">
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
      <ConfirmShell title="Could not load this booking">
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
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
          Fomo Maintenance
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">{title}</h1>
        <div className="mt-4 text-base leading-7 text-slate-600">{children}</div>
      </div>
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
