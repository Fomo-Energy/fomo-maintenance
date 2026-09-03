import { findCandidateSlot, type VisitSlot } from "@/lib/slots";

export const RESCHEDULE_CUTOFF_MS = 48 * 60 * 60 * 1_000;
export const RESCHEDULE_HOLD_MS = 15 * 60 * 1_000;
export const MAX_CUSTOMER_RESCHEDULES = 2;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RescheduleEligibilityInput = {
  paymentStatus: string;
  calendarStatus: string;
  graphEventId: string | null;
  slotStart: Date;
  rescheduleCount: number;
};

export type RescheduleEligibility =
  | { allowed: true; changesRemaining: number }
  | { allowed: false; reason: string; changesRemaining: number };

export class ReschedulePolicyError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ReschedulePolicyError";
  }
}

export function rescheduleEligibility(
  booking: RescheduleEligibilityInput,
  now = new Date(),
): RescheduleEligibility {
  const changesRemaining = Math.max(
    0,
    MAX_CUSTOMER_RESCHEDULES - booking.rescheduleCount,
  );
  if (
    !["paid", "partially_refunded", "disputed"].includes(
      booking.paymentStatus,
    ) ||
    booking.calendarStatus !== "created" ||
    !booking.graphEventId
  ) {
    return {
      allowed: false,
      reason: "This booking is not ready for an online date/time change.",
      changesRemaining,
    };
  }
  if (changesRemaining === 0) {
    return {
      allowed: false,
      reason: "This booking has reached the two-change limit.",
      changesRemaining,
    };
  }
  if (booking.slotStart.getTime() - now.getTime() < RESCHEDULE_CUTOFF_MS) {
    return {
      allowed: false,
      reason: "Online changes close 48 hours before the visit.",
      changesRemaining,
    };
  }
  return { allowed: true, changesRemaining };
}

export function validateRescheduleRequest(input: {
  requestKey: unknown;
  slotStart: unknown;
  slotEnd: unknown;
  currentSlotStart: Date;
  currentSlotEnd: Date;
  now?: Date;
}): { requestKey: string; slot: VisitSlot } {
  const requestKey = typeof input.requestKey === "string" ? input.requestKey : "";
  const slotStart = typeof input.slotStart === "string" ? input.slotStart : "";
  const slotEnd = typeof input.slotEnd === "string" ? input.slotEnd : "";
  if (!UUID_PATTERN.test(requestKey)) {
    throw new ReschedulePolicyError(
      "invalid_request_key",
      "The date/time change request is invalid.",
    );
  }
  const slot = findCandidateSlot(slotStart, slotEnd, input.now ?? new Date());
  if (!slot) {
    throw new ReschedulePolicyError(
      "invalid_slot",
      "That visit time is no longer available.",
    );
  }
  if (
    new Date(slot.start).getTime() === input.currentSlotStart.getTime() &&
    new Date(slot.end).getTime() === input.currentSlotEnd.getTime()
  ) {
    throw new ReschedulePolicyError(
      "same_slot",
      "Choose a different visit time.",
    );
  }
  return { requestKey, slot };
}
