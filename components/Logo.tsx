import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3 text-ink">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 items-center justify-center bg-brand text-lg font-bold text-white"
      >
        F
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-extrabold tracking-[0.18em]">
          FOMO
        </span>
        <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-brand">
          Maintenance
        </span>
      </span>
    </Link>
  );
}
