import React from "react";

export function StagingEnvironmentBanner() {
  return (
    <div
      role="status"
      data-staging-environment-banner
      className="fixed inset-x-0 top-0 z-[100] flex h-14 items-center justify-center gap-3 bg-red-700 px-3 text-center text-xs font-bold text-white shadow-lg sm:px-4 sm:text-sm"
    >
      <span className="sm:hidden">
        STAGING — Sandbox only; calendar and emails are real.
      </span>
      <span className="hidden sm:inline">
        STAGING ENVIRONMENT — Use sandbox payments and approved test details
        only. Calendar events and emails are real.
      </span>
      <a
        href="/#staging-operations"
        className="shrink-0 rounded border border-white/70 px-2 py-1 text-[10px] uppercase tracking-wide underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-white sm:text-xs"
      >
        <span className="sm:hidden">Test flow ↓</span>
        <span className="hidden sm:inline">View test flow ↓</span>
      </a>
    </div>
  );
}
