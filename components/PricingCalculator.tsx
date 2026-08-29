"use client";

import { useMemo, useState } from "react";
import { VisitBooking } from "@/components/CalendlyEmbed";
import { FOMO_ENERGY_CONTACT, QUOTE_EMAIL } from "@/lib/site";
import {
  INSTALLERS,
  formatSgd,
  quote,
  type InstallerId,
} from "@/lib/pricing";

const DEFAULT_KWP = 10;

export function PricingCalculator() {
  const [kwpInput, setKwpInput] = useState(String(DEFAULT_KWP));
  const [installer, setInstaller] = useState<InstallerId>("fomo");
  const [roofAccess, setRoofAccess] = useState(true);
  const [advancedPreventive, setAdvancedPreventive] = useState(false);
  const [monitoring, setMonitoring] = useState(false);

  const kwp = Number.parseFloat(kwpInput);
  const result = useMemo(
    () =>
      quote({
        kwp: Number.isFinite(kwp) ? kwp : 0,
        installer,
        roofAccess,
        advancedPreventive,
        monitoring: installer === "fomo" ? monitoring : false,
      }),
    [advancedPreventive, installer, kwp, monitoring, roofAccess],
  );

  return (
    <section id="pricing" className="scroll-mt-24 bg-ink text-white">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand">
          Singapore · annual · SGD
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
          FOMO Energy looks after the system after it is installed.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
          Fomo Maintenance is the annual O&amp;M program, priced on system
          size. The figure below is Condition &amp; Standard. Add advanced
          electrical tests or, on FOMO-installed outright systems, monitoring
          and reporting.
        </p>

        <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-3xl bg-white p-6 text-ink shadow-xl md:p-8">
            <h2 className="text-xl font-bold">Quote calculator</h2>
            <p className="mt-1 text-sm text-slate-500">
              Annual Condition &amp; Standard tariff, then optional add-ons.
            </p>

            <label className="mt-8 block text-sm font-semibold">
              System size (kWp)
              <input
                type="number"
                min={0}
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
                        if (option.id !== "fomo") {
                          setMonitoring(false);
                        }
                      }}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-6">
              <legend className="text-sm font-semibold">Roof access</legend>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  { value: true, label: "Yes" },
                  { value: false, label: "No" },
                ].map((option) => (
                  <label
                    key={String(option.value)}
                    className={`flex cursor-pointer items-center justify-center rounded-xl border px-4 py-3 text-sm font-semibold ${
                      roofAccess === option.value
                        ? "border-brand bg-peach"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="roofAccess"
                      className="sr-only"
                      checked={roofAccess === option.value}
                      onChange={() => setRoofAccess(option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                No roof access skips module checks and localised cleaning in
                the scope. The tariff does not change.
              </p>
            </fieldset>

            <fieldset className="mt-6">
              <legend className="text-sm font-semibold">Extras</legend>
              <label className="mt-3 flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={advancedPreventive}
                  disabled={!result.sellable}
                  onChange={(event) =>
                    setAdvancedPreventive(event.target.checked)
                  }
                />
                <span>
                  <span className="font-semibold">Advanced preventive</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    +25% of Condition &amp; Standard. IR hotspot, DC/AC
                    insulation, cable thermal.
                  </span>
                </span>
              </label>
              {result.monitoringEligible ? (
                <label className="mt-2 flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={monitoring}
                    onChange={(event) => setMonitoring(event.target.checked)}
                  />
                  <span>
                    <span className="font-semibold">
                      Monitoring and reporting
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      +12.5% of Condition &amp; Standard. Fomo-installed
                      outright only.
                    </span>
                  </span>
                </label>
              ) : null}
            </fieldset>

            <div className="mt-8 rounded-2xl bg-peach p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Condition &amp; Standard bands
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex justify-between gap-4">
                  <span>First 10 kWp</span>
                  <span className="font-semibold">S$40 / kWp</span>
                </li>
                <li className="flex justify-between gap-4">
                  <span>Next 30 kWp (10–40)</span>
                  <span className="font-semibold">S$20 / kWp</span>
                </li>
                <li className="flex justify-between gap-4">
                  <span>Above 40 kWp</span>
                  <span className="font-semibold">S$5 / kWp</span>
                </li>
              </ul>
            </div>
          </div>

          <div
            id="book"
            className="scroll-mt-28 min-w-0 overflow-x-hidden rounded-3xl bg-white p-6 text-ink shadow-xl md:p-8"
          >
            {result.sellable ? (
              <>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">
                  {result.indicative ? "Indicative annual figure" : "Annual figure"}
                </p>
                <p className="mt-2 text-5xl font-bold tracking-tight">
                  {formatSgd(result.totalSgd)}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  per year, SGD, for {Number.isFinite(kwp) ? kwp : 0} kWp
                </p>
                {result.indicative ? (
                  <p className="mt-4 rounded-xl bg-peach px-4 py-3 text-sm leading-6 text-slate-700">
                    Quotes for systems FOMO Energy did not install are
                    indicative. A site check confirms scope before we proceed.
                  </p>
                ) : null}

                <dl className="mt-6 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt>Condition &amp; Standard</dt>
                    <dd className="font-semibold">
                      {formatSgd(result.baseSgd)}
                    </dd>
                  </div>
                  {result.advancedApplied ? (
                    <div className="flex justify-between gap-4">
                      <dt>Advanced preventive</dt>
                      <dd className="font-semibold">
                        {formatSgd(result.advancedSgd)}
                      </dd>
                    </div>
                  ) : null}
                  {result.monitoringApplied ? (
                    <div className="flex justify-between gap-4">
                      <dt>Monitoring and reporting</dt>
                      <dd className="font-semibold">
                        {formatSgd(result.monitoringSgd)}
                      </dd>
                    </div>
                  ) : null}
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
                  {result.installer === "fomo" ? (
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      Fomo-installed outright systems include remote checks in
                      Condition &amp; Standard.
                    </p>
                  ) : null}
                </div>

                <VisitBooking />
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
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">
                  Rent-to-own
                </p>
                <h2 className="mt-3 text-2xl font-bold tracking-tight">
                  Maintenance is already in your rent-to-own plan.
                </h2>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  FOMO Energy rent-to-own already includes maintenance. There
                  is no extra Fomo Maintenance contract to buy. If the system
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
