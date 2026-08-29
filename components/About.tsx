import { FOMO_ENERGY_URL } from "@/lib/site";

export function About() {
  return (
    <section id="about" className="scroll-mt-28 bg-white">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-2 md:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
            About
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink md:text-4xl">
            Independent O&amp;M. Sister brand to FOMO Energy.
          </h2>
        </div>
        <div className="space-y-5 text-base leading-7 text-slate-600">
          <p>
            Fomo Maintenance looks after solar systems in Singapore after they
            are installed. We are not an installer. FOMO Energy designs and
            hangs the array; we are the separate operations and maintenance
            company for owners who want Condition &amp; Standard cover, and
            optional advanced electrical tests, on an annual SGD tariff.
          </p>
          <p>
            Fomo-installed outright systems can include remote checks in the
            base figure. Arrays from other contractors are welcome — the quote
            is indicative until a site check. FOMO rent-to-own is already
            maintained under that agreement, so we do not sell a second
            contract over it.
          </p>
          <p>
            New hardware still sits with the installer. If you need panels or
            an inverter replaced, talk to{" "}
            <a
              className="font-semibold text-ink underline decoration-brand/50 underline-offset-4"
              href={FOMO_ENERGY_URL}
            >
              FOMO Energy
            </a>
            . If you need the plant read, tested, and reported, that is us.
          </p>
        </div>
      </div>
    </section>
  );
}
