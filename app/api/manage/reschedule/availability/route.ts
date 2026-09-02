import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { databaseIsConfigured } from "@/lib/database";
import { listBusyPeriods } from "@/lib/microsoft";
import { findManageAccess } from "@/lib/portal/bookings";
import {
  bookingPortalEnabled,
  MANAGE_COOKIE_NAME,
  reschedulingEnabled,
} from "@/lib/portal/config";
import { rescheduleEligibility } from "@/lib/portal/reschedule-policy";
import {
  findActiveCustomerReschedule,
  listActiveReservedPeriods,
} from "@/lib/portal/rescheduling";
import {
  filterFreeSlots,
  findCandidateSlot,
  generateCandidateSlots,
} from "@/lib/slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (
    !bookingPortalEnabled() ||
    !reschedulingEnabled() ||
    !databaseIsConfigured()
  ) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const token = (await cookies()).get(MANAGE_COOKIE_NAME)?.value;
  const access = token ? await findManageAccess(token).catch(() => null) : null;
  if (!access) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const activeRequest = await findActiveCustomerReschedule(access.booking.id);
  const eligibility = rescheduleEligibility(access.booking);
  if (!eligibility.allowed && !activeRequest) {
    return NextResponse.json(
      {
        error: eligibility.reason,
        changesRemaining: eligibility.changesRemaining,
      },
      { status: 403 },
    );
  }

  const candidates = generateCandidateSlots().filter(
    (slot) =>
      new Date(slot.start).getTime() !== access.booking.slotStart.getTime() ||
      new Date(slot.end).getTime() !== access.booking.slotEnd.getTime(),
  );
  const pendingSlot = activeRequest
    ? findCandidateSlot(
        activeRequest.requestedSlotStart.toISOString(),
        activeRequest.requestedSlotEnd.toISOString(),
      )
    : undefined;
  const pendingReschedule =
    activeRequest && pendingSlot
      ? { requestKey: activeRequest.requestKey, slot: pendingSlot }
      : undefined;
  if (candidates.length === 0) {
    return NextResponse.json({ slots: [], pendingReschedule, ...eligibility });
  }
  const rangeStart = new Date(candidates[0].start);
  const rangeEnd = new Date(candidates[candidates.length - 1].end);
  try {
    const [calendarBusy, reservationBusy] = await Promise.all([
      listBusyPeriods(rangeStart, rangeEnd, {
        excludeMaintenanceEventId: access.booking.graphEventId || undefined,
      }),
      listActiveReservedPeriods(rangeStart, rangeEnd, {
        excludeBookingId: access.booking.id,
      }),
    ]);
    return NextResponse.json({
      slots: filterFreeSlots(candidates, [
        ...calendarBusy,
        ...reservationBusy,
      ]),
      changesRemaining: eligibility.changesRemaining,
      pendingReschedule,
    });
  } catch (error) {
    console.error("[fomo-maintenance] reschedule availability failed", {
      bookingId: access.booking.id,
      code: error instanceof Error ? error.name : "unknown_error",
    });
    return NextResponse.json(
      { error: "Available visit times could not be loaded. Try again shortly." },
      { status: 503 },
    );
  }
}
