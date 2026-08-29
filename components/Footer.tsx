import Link from "next/link";
import { FOMO_ENERGY_URL, QUOTE_EMAIL } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-orange-100 bg-peach">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-3">
        <div>
          <p className="text-sm font-extrabold tracking-[0.18em] text-ink">
            FOMO
          </p>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">
            Maintenance
          </p>
          <p className="mt-4 max-w-xs text-sm leading-6 text-slate-600">
            A FOMO Energy program. Annual operations and maintenance for solar
            systems in Singapore.{" "}
            <a
              className="font-semibold text-ink underline decoration-brand/50 underline-offset-4"
              href={FOMO_ENERGY_URL}
            >
              FOMO Energy
            </a>{" "}
            designs and installs. Fomo Maintenance is the aftercare.
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Site
          </p>
          <ul className="mt-3 space-y-2 text-sm font-semibold text-ink">
            <li>
              <Link href="/#pricing">Pricing</Link>
            </li>
            <li>
              <Link href="/journal">Journal</Link>
            </li>
            <li>
              <Link href="/#book">Book now</Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Contact
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Quotes and site checks:{" "}
            <a
              className="font-semibold text-ink"
              href={`mailto:${QUOTE_EMAIL}`}
            >
              {QUOTE_EMAIL}
            </a>
          </p>
          <p className="mt-2 text-sm text-slate-600">Singapore</p>
        </div>
      </div>
      <div className="border-t border-orange-100 px-6 py-4 text-center text-xs text-slate-500">
        Fomo Maintenance is a FOMO Energy program, not an installation quote.
      </div>
    </footer>
  );
}
