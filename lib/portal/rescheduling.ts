import "server-only";

import { randomUUID } from "node:crypto";
import {
  and,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import {
  bookings,
  rescheduleRequests,
  slotReservations,
  type Booking,
  type RescheduleRequest,
} from "@/db/schema";
import { getDatabase } from "@/lib/database";
import type { BusyPeriod, VisitSlot } from "@/lib/slots";
import {
  RESCHEDULE_HOLD_MS,
  ReschedulePolicyError,
  rescheduleEligibility,
} from "@/lib/portal/reschedule-policy";

const RESOURCE_KEY = "fomo-maintenance";

export class SlotConflictError extends Error {
  constructor(message = "That visit time was just taken. Choose another slot.") {
    super(message);
    this.name = "SlotConflictError";
  }
}

export type PreparedReschedule = {
  request: RescheduleRequest;
  booking: Booking;
  resumed: boolean;
};

export async function findActiveCustomerReschedule(
  bookingId: string,
): Promise<RescheduleRequest | null> {
  const [request] = await getDatabase()
    .select()
    .from(rescheduleRequests)
    .where(
      and(
        eq(rescheduleRequests.bookingId, bookingId),
        inArray(rescheduleRequests.status, ["requested", "processing"]),
      ),
    )
    .limit(1);
  return request ?? null;
}

export async function releaseExpiredSlotReservations(
  now = new Date(),
): Promise<void> {
  await getDatabase()
    .update(slotReservations)
    .set({ status: "expired", releasedAt: now, updatedAt: now })
    .where(
      and(
        eq(slotReservations.status, "held"),
        isNull(slotReservations.rescheduleRequestId),
        lt(slotReservations.holdExpiresAt, now),
      ),
    );
}

export async function listActiveReservedPeriods(
  rangeStart: Date,
  rangeEnd: Date,
  options: { excludeBookingId?: string } = {},
): Promise<BusyPeriod[]> {
  const now = new Date();
  const records = await getDatabase()
    .select({ start: slotReservations.slotStart, end: slotReservations.slotEnd })
    .from(slotReservations)
    .where(
      and(
        eq(slotReservations.resourceKey, RESOURCE_KEY),
        lt(slotReservations.slotStart, rangeEnd),
        gt(slotReservations.slotEnd, rangeStart),
        or(
          eq(slotReservations.status, "confirmed"),
          and(
            eq(slotReservations.status, "held"),
            or(
              gt(slotReservations.holdExpiresAt, now),
              sql`${slotReservations.rescheduleRequestId} is not null`,
            ),
          ),
        ),
        options.excludeBookingId
          ? or(
              isNull(slotReservations.bookingId),
              ne(slotReservations.bookingId, options.excludeBookingId),
            )
          : undefined,
      ),
    );
  return records;
}

export async function reserveCheckoutSlot(input: {
  stripeCheckoutSessionId: string;
  slot: VisitSlot;
  expiresAt: Date;
}): Promise<void> {
  await releaseExpiredSlotReservations();
  const database = getDatabase();
  const [existing] = await database
    .select()
    .from(slotReservations)
    .where(
      eq(
        slotReservations.stripeCheckoutSessionId,
        input.stripeCheckoutSessionId,
      ),
    )
    .limit(1);
  if (existing) {
    if (
      existing.slotStart.getTime() === new Date(input.slot.start).getTime() &&
      existing.slotEnd.getTime() === new Date(input.slot.end).getTime() &&
      ["held", "confirmed"].includes(existing.status)
    ) {
      return;
    }
    throw new SlotConflictError("This Checkout Session has a different slot hold.");
  }

  try {
    await database.insert(slotReservations).values({
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
      slotStart: new Date(input.slot.start),
      slotEnd: new Date(input.slot.end),
      status: "held",
      holdExpiresAt: input.expiresAt,
    });
  } catch {
    throw new SlotConflictError();
  }
}

export async function confirmPaidCheckoutSlot(input: {
  bookingId: string;
  stripeCheckoutSessionId: string;
  slotStart: Date;
  slotEnd: Date;
}): Promise<void> {
  const database = getDatabase();
  const now = new Date();
  const confirmed = await database
    .update(slotReservations)
    .set({
      bookingId: input.bookingId,
      status: "confirmed",
      holdExpiresAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(
          slotReservations.stripeCheckoutSessionId,
          input.stripeCheckoutSessionId,
        ),
        eq(slotReservations.slotStart, input.slotStart),
        eq(slotReservations.slotEnd, input.slotEnd),
        inArray(slotReservations.status, ["held", "confirmed"]),
      ),
    )
    .returning({ id: slotReservations.id });
  if (confirmed.length === 1) {
    return;
  }

  await releaseExpiredSlotReservations(now);
  try {
    await database.insert(slotReservations).values({
      bookingId: input.bookingId,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
      slotStart: input.slotStart,
      slotEnd: input.slotEnd,
      status: "confirmed",
      holdExpiresAt: null,
    });
  } catch {
    throw new SlotConflictError(
      "The paid booking slot conflicts with another active reservation.",
    );
  }
}

export async function prepareCustomerReschedule(input: {
  bookingId: string;
  requestKey: string;
  slot: VisitSlot;
  now?: Date;
}): Promise<PreparedReschedule> {
  const database = getDatabase();
  const now = input.now ?? new Date();
  const [booking] = await database
    .select()
    .from(bookings)
    .where(eq(bookings.id, input.bookingId))
    .limit(1);
  if (!booking) {
    throw new ReschedulePolicyError(
      "booking_not_found",
      "This booking is no longer available.",
    );
  }

  const [existing] = await database
    .select()
    .from(rescheduleRequests)
    .where(
      and(
        eq(rescheduleRequests.bookingId, booking.id),
        eq(rescheduleRequests.requestKey, input.requestKey),
      ),
    )
    .limit(1);
  if (existing) {
    if (
      existing.requestedSlotStart.getTime() !==
        new Date(input.slot.start).getTime() ||
      existing.requestedSlotEnd.getTime() !== new Date(input.slot.end).getTime()
    ) {
      throw new ReschedulePolicyError(
        "request_key_reused",
        "This date/time change request cannot be reused for another slot.",
      );
    }
    if (existing.status === "completed") {
      return { request: existing, booking, resumed: true };
    }
    if (!["requested", "processing"].includes(existing.status)) {
      throw new ReschedulePolicyError(
        existing.failureCode || "reschedule_failed",
        "That date/time change did not complete. Choose a slot and try again.",
      );
    }
    return { request: existing, booking, resumed: true };
  }

  const eligibility = rescheduleEligibility(booking, now);
  if (!eligibility.allowed) {
    throw new ReschedulePolicyError("reschedule_not_allowed", eligibility.reason);
  }

  await releaseExpiredSlotReservations(now);
  const requestId = randomUUID();
  const requestedSlotStart = new Date(input.slot.start);
  const requestedSlotEnd = new Date(input.slot.end);
  try {
    await database.batch([
      database.insert(rescheduleRequests).values({
        id: requestId,
        requestKey: input.requestKey,
        bookingId: booking.id,
        status: "processing",
        previousSlotStart: booking.slotStart,
        previousSlotEnd: booking.slotEnd,
        requestedSlotStart,
        requestedSlotEnd,
      }),
      database.insert(slotReservations).values({
        bookingId: booking.id,
        rescheduleRequestId: requestId,
        slotStart: requestedSlotStart,
        slotEnd: requestedSlotEnd,
        status: "held",
        holdExpiresAt: new Date(now.getTime() + RESCHEDULE_HOLD_MS),
      }),
    ]);
  } catch {
    const [activeRequest] = await database
      .select({ id: rescheduleRequests.id })
      .from(rescheduleRequests)
      .where(
        and(
          eq(rescheduleRequests.bookingId, booking.id),
          inArray(rescheduleRequests.status, ["requested", "processing"]),
        ),
      )
      .limit(1);
    if (activeRequest) {
      throw new ReschedulePolicyError(
        "reschedule_in_progress",
        "A date/time change is already in progress for this booking.",
      );
    }
    throw new SlotConflictError();
  }

  const [request] = await database
    .select()
    .from(rescheduleRequests)
    .where(eq(rescheduleRequests.id, requestId))
    .limit(1);
  if (!request) {
    throw new Error("The reschedule request could not be loaded.");
  }
  return { request, booking, resumed: false };
}

export async function failCustomerReschedule(
  requestId: string,
  failureCode: string,
): Promise<void> {
  const now = new Date();
  const database = getDatabase();
  await database.batch([
    database
      .update(rescheduleRequests)
      .set({ status: "failed", failureCode, updatedAt: now })
      .where(
        and(
          eq(rescheduleRequests.id, requestId),
          inArray(rescheduleRequests.status, ["requested", "processing"]),
        ),
      ),
    database
      .update(slotReservations)
      .set({ status: "released", releasedAt: now, updatedAt: now })
      .where(
        and(
          eq(slotReservations.rescheduleRequestId, requestId),
          eq(slotReservations.status, "held"),
        ),
      ),
  ]);
}

export async function completeCustomerReschedule(input: {
  bookingId: string;
  requestId: string;
  expectedRecordVersion: number;
  previousSlotStart: Date;
  previousSlotEnd: Date;
  requestedSlotStart: Date;
  requestedSlotEnd: Date;
}): Promise<{ rescheduleCount: number; recordVersion: number } | null> {
  const result = await getDatabase().execute<{
    reschedule_count: number;
    record_version: number;
  }>(sql`
    with updated_booking as (
      update bookings
      set slot_start = ${input.requestedSlotStart},
          slot_end = ${input.requestedSlotEnd},
          reschedule_count = reschedule_count + 1,
          record_version = record_version + 1,
          updated_at = now()
      where id = ${input.bookingId}::uuid
        and slot_start = ${input.previousSlotStart}
        and slot_end = ${input.previousSlotEnd}
        and record_version = ${input.expectedRecordVersion}
        and reschedule_count < 2
      returning id, reschedule_count, record_version
    ), confirmed_reservation as (
      update slot_reservations
      set status = 'confirmed', hold_expires_at = null, updated_at = now()
      where reschedule_request_id = ${input.requestId}::uuid
        and status = 'held'
        and exists (select 1 from updated_booking)
      returning id
    ), completed_request as (
      update reschedule_requests
      set status = 'completed', failure_code = null,
          completed_at = now(), updated_at = now()
      where id = ${input.requestId}::uuid
        and status in ('requested', 'processing')
        and exists (select 1 from updated_booking)
        and exists (select 1 from confirmed_reservation)
      returning id
    ), released_previous as (
      update slot_reservations
      set status = 'released', released_at = now(), updated_at = now()
      where booking_id = ${input.bookingId}::uuid
        and slot_start = ${input.previousSlotStart}
        and slot_end = ${input.previousSlotEnd}
        and status = 'confirmed'
        and exists (select 1 from completed_request)
      returning id
    )
    select updated_booking.reschedule_count, updated_booking.record_version
    from updated_booking, completed_request
  `);
  const record = result.rows[0];
  return record
    ? {
        rescheduleCount: record.reschedule_count,
        recordVersion: record.record_version,
      }
    : null;
}
