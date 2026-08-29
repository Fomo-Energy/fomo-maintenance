"use client";

import Script from "next/script";
import { CALENDLY_EMBED_URL } from "@/lib/site";

const CALENDLY_SCRIPT = "https://assets.calendly.com/assets/external/widget.js";

export function CalendlyEmbed() {
  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
      <div
        className="calendly-inline-widget w-full max-w-full"
        data-url={CALENDLY_EMBED_URL}
        style={{ minWidth: "min(320px, 100%)", height: 700 }}
      />
      <Script src={CALENDLY_SCRIPT} strategy="afterInteractive" />
    </div>
  );
}
