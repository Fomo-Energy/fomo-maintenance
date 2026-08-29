"use client";

import { FormEvent, useState } from "react";
import { INSTALLERS, formatSgd, type QuoteResult } from "@/lib/pricing";
import { QUOTE_EMAIL } from "@/lib/site";

type QuoteFormProps = {
  result: QuoteResult;
};

export function QuoteForm({ result }: QuoteFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const installerLabel =
      INSTALLERS.find((item) => item.id === result.installer)?.label ??
      result.installer;
    const extras = [
      result.advancedApplied ? "Advanced preventive" : null,
      result.monitoringApplied ? "Monitoring and reporting" : null,
    ].filter(Boolean);
    const body = [
      `Name: ${name}`,
      `Phone: ${phone}`,
      `Email: ${email}`,
      `Site address: ${address}`,
      "",
      `System size: ${result.kwp} kWp`,
      `Installer: ${installerLabel}`,
      `Roof access: ${result.roofAccess ? "Yes" : "No"}`,
      `Extras: ${extras.length ? extras.join(", ") : "None"}`,
      `Condition & Standard: ${formatSgd(result.baseSgd)} / year`,
      `Quoted total: ${formatSgd(result.totalSgd)} / year`,
      result.indicative
        ? "Note: quote is indicative for a system FOMO Energy did not install. A site check is required."
        : "",
      "",
      `Scope: ${result.scope.join("; ")}`,
    ]
      .filter((line) => line !== "")
      .join("\n");

    const href = `mailto:${QUOTE_EMAIL}?subject=${encodeURIComponent(
      `Fomo Maintenance quote request · ${result.kwp} kWp`,
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  }

  return (
    <form className="mt-8 border-t border-orange-100 pt-8" onSubmit={onSubmit}>
      <h3 className="text-lg font-bold">Request this quote</h3>
      <p className="mt-1 text-sm text-slate-500">
        This emails FOMO Energy at {QUOTE_EMAIL}. It is not a checkout.
      </p>
      <div className="mt-5 grid gap-3">
        <label className="text-sm font-semibold">
          Name
          <input
            required
            name="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none ring-brand focus:ring-2"
          />
        </label>
        <label className="text-sm font-semibold">
          Phone
          <input
            required
            name="phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none ring-brand focus:ring-2"
          />
        </label>
        <label className="text-sm font-semibold">
          Email
          <input
            required
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none ring-brand focus:ring-2"
          />
        </label>
        <label className="text-sm font-semibold">
          Address
          <textarea
            required
            name="address"
            autoComplete="street-address"
            rows={3}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none ring-brand focus:ring-2"
          />
        </label>
      </div>
      <button type="submit" className="cta-pill mt-6 w-full px-6 py-3 text-sm">
        Email this quote
      </button>
    </form>
  );
}
