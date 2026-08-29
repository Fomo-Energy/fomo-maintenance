import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Payment cancelled",
  description: "Stripe Checkout was cancelled. No visit was booked.",
};

export default function BookCancelPage() {
  return (
    <div className="bg-peach">
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
          Fomo Maintenance
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">
          Payment cancelled
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Nothing was charged. No visit was placed on the operations calendar.
        </p>
        <p className="mt-10">
          <Link href="/#book" className="cta-pill px-7 py-3 text-sm">
            Choose a visit time
          </Link>
        </p>
      </div>
    </div>
  );
}
