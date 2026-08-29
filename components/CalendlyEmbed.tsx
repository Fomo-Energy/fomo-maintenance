"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { calendlyEmbedUrl } from "@/lib/site";

const CALENDLY_SCRIPT = "https://assets.calendly.com/assets/external/widget.js";

type CalendlyApi = {
  initInlineWidget: (options: { url: string; parentElement: HTMLElement }) => void;
};

declare global {
  interface Window {
    Calendly?: CalendlyApi;
  }
}

type CalendlyEmbedProps = {
  url: string;
};

export function CalendlyEmbed({ url }: CalendlyEmbedProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.Calendly?.initInlineWidget) {
      setScriptReady(true);
    }
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !scriptReady || !window.Calendly?.initInlineWidget) {
      return;
    }
    host.replaceChildren();
    window.Calendly.initInlineWidget({
      url,
      parentElement: host,
    });
  }, [url, scriptReady]);

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
      <div
        ref={hostRef}
        className="calendly-inline-widget w-full max-w-full"
        data-url={url}
        style={{ minWidth: "min(320px, 100%)", height: 700 }}
      />
      <Script
        src={CALENDLY_SCRIPT}
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
    </div>
  );
}

type FieldState = {
  name: string;
  phone: string;
  email: string;
  address: string;
};

const EMPTY_FIELDS: FieldState = {
  name: "",
  phone: "",
  email: "",
  address: "",
};

export function VisitBooking() {
  const [fields, setFields] = useState<FieldState>(EMPTY_FIELDS);
  const [embedUrl, setEmbedUrl] = useState(() => calendlyEmbedUrl());

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setEmbedUrl(
        calendlyEmbedUrl({
          name: fields.name,
          email: fields.email,
          location: fields.address,
          phone: fields.phone,
        }),
      );
    }, 400);
    return () => window.clearTimeout(handle);
  }, [fields]);

  function update<K extends keyof FieldState>(key: K, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="mt-8 border-t border-orange-100 pt-8">
      <h3 className="text-lg font-bold">Pick a visit time</h3>
      <p className="mt-1 text-sm text-slate-500">
        Tell us where the visit happens — the maintenance site, not a FOMO
        office — then choose a slot.
      </p>
      <div className="mt-5 grid gap-3">
        <label className="text-sm font-semibold">
          Name
          <input
            required
            name="name"
            autoComplete="name"
            value={fields.name}
            onChange={(event) => update("name", event.target.value)}
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
            value={fields.phone}
            onChange={(event) => update("phone", event.target.value)}
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
            value={fields.email}
            onChange={(event) => update("email", event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none ring-brand focus:ring-2"
          />
        </label>
        <label className="text-sm font-semibold">
          Site address
          <textarea
            required
            name="address"
            autoComplete="street-address"
            rows={3}
            value={fields.address}
            onChange={(event) => update("address", event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none ring-brand focus:ring-2"
          />
          <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
            This is where the visit happens.
          </span>
        </label>
      </div>
      <div className="mt-5">
        <CalendlyEmbed url={embedUrl} />
      </div>
    </div>
  );
}
