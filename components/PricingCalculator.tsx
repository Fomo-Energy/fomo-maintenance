"use client";

import { useMemo, useState } from "react";
import { VisitBooking } from "@/components/VisitBooking";
import { FOMO_ENERGY_CONTACT, QUOTE_EMAIL } from "@/lib/site";
import {
  INSTALLERS,
  cleaningPriceSgd,
  electricalUpgradePriceSgd,
  essentialPriceSgd,
  formatSgd,
  quote,
  type InstallerId,
  type ServiceLevel,
} from "@/lib/pricing";

const DEFAULT_KWP = 10;

export function PricingCalculator() {
  const [kwpInput, setKwpInput] = useState(String(DEFAULT_KWP));
  const [installer, setInstaller] = useState<InstallerId>("fomo");
  const [serviceLevel, setServiceLevel] =
    useState<ServiceLevel>("essential");
  const [cleaning, setCleaning] = useState(false);

  const parsedKwp = Number.parseFloat(kwpInput);
  const kwp = Number.isFinite(parsedKwp) ? parsedKwp : 0;
  const essentialPrice = essentialPriceSgd(kwp);
  const electricalUpgradePrice = electricalUpgradePriceSgd(kwp);
  const cleaningPrice = cleaningPriceSgd(kwp);
  const electricalPackagePrice = essentialPrice + electricalUpgradePrice;
  const result = useMemo(
    () =>
      quote({
        kwp,
        installer,
        serviceLevel,
        cleaning,
      }),
    [cleaning, installer, kwp, serviceLevel],
  );

  return (
    <section id="pricing" className="scroll-mt-24 bg-ink text-white">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand">
          Singapore · solar O&amp;M · SGD · prices subject to 9% GST
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight md:text-5xl">
          Solar maintenance priced around what you actually need.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
          Enter your system size, choose a service level, optionally add
          cleaning, see the final price, then choose an appointment and pay
          online.
        </p>

        <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-3xl bg-white p-6 text-ink shadow-xl md:p-8">
            <h2 className="text-xl font-bold">Build your maintenance package</h2>

            <label className="mt-8 block text-sm font-semibold">
              System size (kWp)
              <input
                type="number"
                min={0.1}
                max={10000}
                step="0.1"
                inputMode="decimal"
                value={kwpInput}
                onChange={(event) => setKwpInput(event.target.value)}
                className="mt-2 w-full rounded-xl border border-orange-100 bg-peach px-4 py-3 text-base font-semibold outline-none ring-brand focus:ring-2"
              />
            </label>

            <fieldset className="mt-6">
              <legend className="text-sm font-semibold">Installer</legend>
              <div className="mt-3 grid gap-2">
                {INSTALLERS.map((option) => (
                  <label
                    key={option.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${
                      installer === option.id
                        ? "border-brand bg-peach"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="installer"
                      value={option.id}
                      checked={installer === option.id}
                      onChange={() => {
                        setInstaller(option.id);
                        if (option.id === "rto") {
                          setCleaning(false);
                        }
                      }}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {installer === "rto" ? (
              <div className="mt-8 rounded-2xl bg-peach p-5 text-sm leading-6 text-slate-700">
                <p className="font-semibold text-ink">
                  Maintenance is included in your rent-to-own plan.
                </p>
                <p className="mt-1">
                  There is no package or add-on to select here. Contact FOMO
                  Energy support whenever the system needs attention.
                </p>
                <a
                  href={FOMO_ENERGY_CONTACT}
                  className="cta-pill mt-5 inline-flex min-h-11 px-6 py-3 text-sm"
                >
                  Contact FOMO Energy
                </a>
              </div>
            ) : (
              <>
            <fieldset className="mt-6">
              <legend className="text-sm font-semibold">Service level</legend>
              <p className="text-brand-on-light mt-2 text-xs font-semibold">
                No roof access required for either service level.
              </p>
              <div className="mt-3 grid gap-3">
                <label
                  className={`cursor-pointer rounded-2xl border p-4 ${
                    serviceLevel === "essential"
                      ? "border-brand bg-peach"
                      : "border-slate-200"
                  }`}
                >
                  <span className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="serviceLevel"
                      value="essential"
                      checked={serviceLevel === "essential"}
                      onChange={() => setServiceLevel("essential")}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-bold">
                        Essential Health Check · {formatSgd(essentialPrice)}{" "}
                        (subject to GST)
                      </span>
                      <span className="text-brand-on-light mt-1 block text-xs font-semibold">
                        Recommended annually.
                      </span>
                      <span className="mt-2 block text-xs leading-5 text-slate-600">
                        Inverter area condition — physical integrity, switching
                        and safety mechanisms; inverter and DB area electrical
                        checks; remote pre-check when available; and report
                        generation.
                      </span>
                    </span>
                  </span>
                </label>

                <label
                  className={`cursor-pointer rounded-2xl border p-4 ${
                    serviceLevel === "electrical_assurance"
                      ? "border-brand bg-peach"
                      : "border-slate-200"
                  }`}
                >
                  <span className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="serviceLevel"
                      value="electrical_assurance"
                      checked={serviceLevel === "electrical_assurance"}
                      onChange={() =>
                        setServiceLevel("electrical_assurance")
                      }
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-bold">
                        Electrical Assurance ·{" "}
                        {formatSgd(electricalPackagePrice)} (subject to GST)
                      </span>
                      <span className="text-brand-on-light mt-1 block text-xs font-semibold">
                        Recommended once every 2 years.
                      </span>
                      <span className="mt-2 block text-xs leading-5 text-slate-600">
                        Everything in Essential, plus a thorough DC-side safety
                        and performance testing using professional solar testing
                        equipment. This helps to identify deteriorated cabling
                        and insulation which may lead to DC related electrical
                        faults and fires.
                      </span>
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>

            <fieldset className="mt-6">
              <legend className="text-sm font-semibold">Optional services</legend>
              <label className="mt-3 flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={cleaning}
                  disabled={!result.sellable}
                  onChange={(event) => setCleaning(event.target.checked)}
                />
                <span>
                  <span className="font-semibold">
                    Full panel cleaning · {formatSgd(cleaningPrice)} (subject
                    to GST)
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    Cleaning is performed only after safe roof access has been
                    confirmed. If access cannot be confirmed, the team will
                    contact you to resolve that charge.
                  </span>
                </span>
              </label>
            </fieldset>

            <div className="mt-8 rounded-2xl bg-peach p-5 text-sm leading-6 text-slate-700">
              <p className="font-semibold text-ink">Roof access and safety</p>
              <p className="mt-1">
                This online tool does not determine roof eligibility. If you
                select cleaning, our team will confirm safe access before work
                begins. If only part of the roof is safely accessible, we will
                clean only the accessible panels. The cleaning fee does not
                include third-party access costs, such as scaffolding or
                specialist access equipment.
              </p>
            </div>
              </>
            )}
          </div>

          <div
            id="book"
            className="scroll-mt-28 min-w-0 overflow-x-hidden rounded-3xl bg-white p-6 text-ink shadow-xl md:p-8"
          >
            {result.sellable ? (
              <>
                <p className="text-brand-on-light text-xs font-bold uppercase tracking-[0.16em]">
                  {result.packageName}
                </p>
                <p className="mt-2 text-5xl font-bold tracking-tight">
                  {formatSgd(result.totalSgd)}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  final visit price including 9% GST, SGD, for {kwp} kWp
                </p>

                <dl className="mt-6 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt>{result.packageName} (pre-GST)</dt>
                    <dd className="font-semibold">
                      {formatSgd(result.servicePackageSgd)}
                    </dd>
                  </div>
                  {result.cleaningSgd ? (
                    <div className="flex justify-between gap-4">
                      <dt>Full panel cleaning (pre-GST)</dt>
                      <dd className="font-semibold">
                        {formatSgd(result.cleaningSgd)}
                      </dd>
                    </div>
                  ) : null}
                  <div className="mt-3 flex justify-between gap-4 border-t border-orange-100 pt-3">
                    <dt>Subtotal before GST</dt>
                    <dd className="font-semibold">
                      {formatSgd(result.subtotalSgd)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>GST (9%)</dt>
                    <dd className="font-semibold">{formatSgd(result.gstSgd)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 font-bold">
                    <dt>Total incl. GST</dt>
                    <dd>{formatSgd(result.totalSgd)}</dd>
                  </div>
                </dl>

                <div className="mt-6">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    In this scope
                  </p>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {result.scope.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    Not included
                  </p>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                    {result.exclusions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <VisitBooking
                  key={installer}
                  kwp={kwp}
                  installer={installer}
                  serviceLevel={result.serviceLevel}
                  cleaning={result.cleaningApplied}
                  totalSgd={result.totalSgd}
                />
                <p className="mt-4 text-sm text-slate-500">
                  Prefer email? Write to{" "}
                  <a
                    className="font-semibold text-ink"
                    href={`mailto:${QUOTE_EMAIL}`}
                  >
                    {QUOTE_EMAIL}
                  </a>
                  .
                </p>
              </>
            ) : (
              <div>
                <p className="text-brand-on-light text-xs font-bold uppercase tracking-[0.16em]">
                  Rent-to-own
                </p>
                <h2 className="mt-3 text-2xl font-bold tracking-tight">
                  Maintenance is already in your rent-to-own plan.
                </h2>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  There is no extra maintenance package to buy. If the system
                  needs attention, contact FOMO Energy support.
                </p>
                <a
                  href={FOMO_ENERGY_CONTACT}
                  className="cta-pill mt-8 inline-flex px-7 py-3 text-sm"
                >
                  Contact FOMO Energy
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
