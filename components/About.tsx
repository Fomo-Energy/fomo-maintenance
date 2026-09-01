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
            Aftercare from the same team that installs.
          </h2>
        </div>
        <div className="text-base leading-7 text-slate-600">
          <p>
            FOMO Energy designs and installs solar in Singapore. Fomo
            Maintenance gives owners a choice between an Essential Health
            Check and deeper Electrical Assurance testing. Full panel cleaning
            is a separate service performed only where safe roof access is
            confirmed. Compatible FOMO-installed systems can also add
            continuous monitoring. Rent-to-own already includes maintenance,
            while repairs and replacement parts remain separate. Hardware
            questions stay with{" "}
            <a
              className="font-semibold text-ink underline decoration-brand/50 underline-offset-4"
              href={FOMO_ENERGY_URL}
            >
              FOMO Energy
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
