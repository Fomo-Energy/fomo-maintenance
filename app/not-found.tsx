import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <h1 className="text-3xl font-bold text-ink">Page not found</h1>
      <p className="mt-3 text-slate-600">
        This page is not on the Fomo Maintenance site. Go home for pricing, or
        open the journal.
      </p>
      <div className="mt-8 flex justify-center gap-4">
        <Link href="/" className="cta-pill px-6 py-3 text-sm">
          Home
        </Link>
        <Link
          href="/journal"
          className="rounded-full border border-orange-200 px-6 py-3 text-sm font-bold uppercase tracking-wide text-ink"
        >
          Journal
        </Link>
      </div>
    </div>
  );
}
