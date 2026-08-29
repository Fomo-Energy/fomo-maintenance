"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/Logo";

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-orange-100 bg-peach">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm font-semibold text-ink md:flex">
          <Link href="/#pricing" className="hover:text-brand">
            Pricing
          </Link>
          <Link href="/journal" className="hover:text-brand">
            Journal
          </Link>
          <Link href="/#book" className="btn-square px-5 py-2.5 text-xs">
            Book now
          </Link>
        </nav>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center text-ink md:hidden"
          aria-expanded={open}
          aria-label="Open menu"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sr-only">Menu</span>
          <svg
            width="22"
            height="16"
            viewBox="0 0 22 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1 1h20M1 8h20M1 15h20"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </button>
      </div>
      {open ? (
        <nav className="flex flex-col gap-3 border-t border-orange-100 px-6 py-4 md:hidden">
          <Link
            href="/#pricing"
            className="font-semibold text-ink"
            onClick={() => setOpen(false)}
          >
            Pricing
          </Link>
          <Link
            href="/journal"
            className="font-semibold text-ink"
            onClick={() => setOpen(false)}
          >
            Journal
          </Link>
          <Link
            href="/#book"
            className="btn-square w-fit px-5 py-2.5 text-xs"
            onClick={() => setOpen(false)}
          >
            Book now
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
