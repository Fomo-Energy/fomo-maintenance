"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { withBasePath } from "@/lib/site";

export function RedirectHome() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  const home = withBasePath("/");

  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center text-slate-600">
      <p>Taking you to the homepage.</p>
      <p className="mt-3">
        <a className="font-semibold text-brand" href={home}>
          Continue to Fomo Maintenance
        </a>
      </p>
    </div>
  );
}
