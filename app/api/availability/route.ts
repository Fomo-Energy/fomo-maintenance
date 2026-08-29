import { NextResponse } from "next/server";
import { listBusyPeriods } from "@/lib/microsoft";
import {
  filterFreeSlots,
  generateCandidateSlots,
} from "@/lib/slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const candidates = generateCandidateSlots();
    if (candidates.length === 0) {
      return NextResponse.json({ slots: [] });
    }

    const rangeStart = new Date(candidates[0].start);
    const last = candidates[candidates.length - 1];
    const rangeEnd = new Date(last.end);

    const busy = await listBusyPeriods(rangeStart, rangeEnd);
    const slots = filterFreeSlots(candidates, busy);
    return NextResponse.json({ slots });
  } catch (error) {
    console.error("[fomo-maintenance] availability failed", error);
    return NextResponse.json(
      { error: "Visit times could not be loaded. Try again, or email hello@fomomaintenance.com." },
      { status: 503 },
    );
  }
}
