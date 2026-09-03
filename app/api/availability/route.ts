import { NextResponse } from "next/server";
import { databaseIsConfigured } from "@/lib/database";
import { listBusyPeriods } from "@/lib/microsoft";
import { checkoutReservationsEnabled } from "@/lib/portal/config";
import { listActiveReservedPeriods } from "@/lib/portal/rescheduling";
import { checkApiRateLimit } from "@/lib/rate-limit";
import {
  filterFreeSlots,
  generateCandidateSlots,
} from "@/lib/slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const rateLimit = await checkApiRateLimit(request, {
      action: "availability",
      limit: 120,
      windowSeconds: 60,
    });
    if (rateLimit && !rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many availability requests. Try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    const candidates = generateCandidateSlots();
    if (candidates.length === 0) {
      return NextResponse.json({ slots: [] });
    }

    const rangeStart = new Date(candidates[0].start);
    const last = candidates[candidates.length - 1];
    const rangeEnd = new Date(last.end);

    if (checkoutReservationsEnabled() && !databaseIsConfigured()) {
      throw new Error("Checkout reservations database is not configured.");
    }
    const [calendarBusy, reservationBusy] = await Promise.all([
      listBusyPeriods(rangeStart, rangeEnd),
      checkoutReservationsEnabled()
        ? listActiveReservedPeriods(rangeStart, rangeEnd)
        : Promise.resolve([]),
    ]);
    const busy = [...calendarBusy, ...reservationBusy];
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
