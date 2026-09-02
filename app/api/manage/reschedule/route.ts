import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { databaseIsConfigured } from "@/lib/database";
import {
  listBusyPeriods,
  maintenanceVisitTimeMatches,
  updateMaintenanceVisitTimeWithRetry,
} from "@/lib/microsoft";
import { findManageAccess } from "@/lib/portal/bookings";
import {
  bookingPortalEnabled,
  MANAGE_COOKIE_NAME,
  reschedulingEnabled,
} from "@/lib/portal/config";
import {
  ReschedulePolicyError,
  validateRescheduleRequest,
} from "@/lib/portal/reschedule-policy";
import { executeCustomerReschedule } from "@/lib/portal/reschedule-flow";
import {
  completeCustomerReschedule,
  failCustomerReschedule,
  prepareCustomerReschedule,
  SlotConflictError,
} from "@/lib/portal/rescheduling";
import { slotIsFree } from "@/lib/slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestIsSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

export async function POST(request: Request) {
  if (
    !bookingPortalEnabled() ||
    !reschedulingEnabled() ||
    !databaseIsConfigured() ||
    !requestIsSameOrigin(request)
  ) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const token = (await cookies()).get(MANAGE_COOKIE_NAME)?.value;
  const access = token ? await findManageAccess(token).catch(() => null) : null;
  if (!access) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid_body");
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const validated = validateRescheduleRequest({
      requestKey: body.requestKey,
      slotStart: body.slotStart,
      slotEnd: body.slotEnd,
      currentSlotStart: access.booking.slotStart,
      currentSlotEnd: access.booking.slotEnd,
    });
    const prepared = await prepareCustomerReschedule({
      bookingId: access.booking.id,
      requestKey: validated.requestKey,
      slot: validated.slot,
    });
    const result = await executeCustomerReschedule(prepared, {
      eventTimeMatches: maintenanceVisitTimeMatches,
      async slotIsAvailable(current) {
        const busy = await listBusyPeriods(
          current.request.requestedSlotStart,
          current.request.requestedSlotEnd,
          {
            excludeMaintenanceEventId:
              current.booking.graphEventId || undefined,
          },
        );
        return slotIsFree(validated.slot, busy);
      },
      updateEvent: updateMaintenanceVisitTimeWithRetry,
      complete: (current) =>
        completeCustomerReschedule({
          bookingId: current.booking.id,
          requestId: current.request.id,
          expectedRecordVersion: current.booking.recordVersion,
          previousSlotStart: current.request.previousSlotStart,
          previousSlotEnd: current.request.previousSlotEnd,
          requestedSlotStart: current.request.requestedSlotStart,
          requestedSlotEnd: current.request.requestedSlotEnd,
        }),
      fail: failCustomerReschedule,
    });
    if (result.status === "conflict") {
      return NextResponse.json(
        { error: "That visit time was just taken. Choose another slot." },
        { status: 409 },
      );
    }
    return NextResponse.json({
      changed: true,
      slotStart: prepared.request.requestedSlotStart.toISOString(),
      slotEnd: prepared.request.requestedSlotEnd.toISOString(),
      rescheduleCount: result.rescheduleCount,
    });
  } catch (error) {
    if (error instanceof ReschedulePolicyError) {
      const conflictCodes = new Set([
        "invalid_slot",
        "same_slot",
        "reschedule_in_progress",
      ]);
      const invalidCodes = new Set(["invalid_request_key", "request_key_reused"]);
      const status = conflictCodes.has(error.code)
        ? 409
        : invalidCodes.has(error.code)
          ? 400
          : 403;
      return NextResponse.json({ error: error.message }, { status });
    }
    if (error instanceof SlotConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[fomo-maintenance] reschedule failed", {
      bookingId: access.booking.id,
      code: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(
      {
        error:
          "The date/time change could not be confirmed. Your previous appointment remains in place unless the manage page shows the new time. Try again shortly or contact the FOMO team.",
      },
      { status: 503 },
    );
  }
}
