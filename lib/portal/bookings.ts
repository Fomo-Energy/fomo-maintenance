import "server-only";

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
  bookingAccessTokens,
  bookings,
  fulfillmentSteps,
  rescheduleRequests,
  slotReservations,
  webhookEvents,
  type Booking,
  type FulfillmentStepName,
} from "@/db/schema";
import { getDatabase } from "@/lib/database";
import {
  buildManageToken,
  digestManageToken,
  newManageTokenId,
  verifyManageToken,
} from "@/lib/portal/access-token";
import { manageLinkSecret } from "@/lib/portal/config";
import type {
  CalendarResult,
  EventClaim,
  FulfillmentStore,
  ManageAccessCredential,
} from "@/lib/portal/fulfillment";
import { confirmPaidCheckoutSlot } from "@/lib/portal/rescheduling";
import type { PaymentLifecycleStore } from "@/lib/portal/payment-lifecycle";
import { PermanentFulfillmentError } from "@/lib/portal/stripe-booking";
import type { InstallerId } from "@/lib/pricing";

export type PaidBookingInput = {
  reference: string;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  siteAddress: string;
  installerType: InstallerId;
  installerName: string | null;
  serviceCode: string;
  packageName: string;
  kwp: string | null;
  subtotalCents: number;
  gstCents: number;
  totalCents: number;
  slotStart: Date;
  slotEnd: Date;
  paidAt: Date;
  checkoutRequestKey?: string;
};

export type WebhookReceiptInput = {
  eventId: string;
  eventType: string;
};

export type WebhookProcessingStatus =
  | "received"
  | "processing"
  | "processed"
  | "failed";

export async function findBookingByStripeSessionId(
  stripeCheckoutSessionId: string,
): Promise<Booking | null> {
  const [booking] = await getDatabase()
    .select()
    .from(bookings)
    .where(eq(bookings.stripeCheckoutSessionId, stripeCheckoutSessionId))
    .limit(1);

  return booking ?? null;
}

export async function findBookingByStripePaymentIntentId(
  stripePaymentIntentId: string,
): Promise<Booking | null> {
  const [booking] = await getDatabase()
    .select()
    .from(bookings)
    .where(eq(bookings.stripePaymentIntentId, stripePaymentIntentId))
    .limit(1);
  return booking ?? null;
}

export async function markPaymentLifecycleAttention(input: {
  bookingId: string;
  paymentStatus: "refunded" | "partially_refunded" | "disputed";
  phase?: "start" | "complete";
  eventId?: string;
}): Promise<Booking> {
  if (!input.eventId) {
    throw new Error("payment_lifecycle_event_missing");
  }
  const paymentStatus =
    input.paymentStatus === "partially_refunded"
      ? sql`case when ${bookings.paymentStatus} in ('refunded', 'disputed') then ${bookings.paymentStatus} else 'partially_refunded' end`
      : input.paymentStatus === "disputed"
        ? sql`case when ${bookings.paymentStatus} = 'refunded' then ${bookings.paymentStatus} else 'disputed' end`
        : input.paymentStatus;
  const phase = input.phase ?? "start";
  const competingEventFreshAfter = new Date(
    Date.now() - EVENT_CLAIM_STALE_AFTER_MS,
  );
  const database = getDatabase();
  const claimed = await database.execute<{ id: string }>(sql`
    with lifecycle_event as (
      select event_id, booking_id
      from webhook_events
      where provider = 'stripe'
        and event_id = ${input.eventId}
        and status = 'processing'
        and (booking_id is null or booking_id = ${input.bookingId}::uuid)
      for update
    ), claimed_booking as (
      update bookings
      set payment_status = ${paymentStatus},
          fulfillment_status = ${phase === "start" ? "processing" : "attention"},
          updated_at = now()
      where id = ${input.bookingId}::uuid
        and exists (select 1 from lifecycle_event)
        and ${
          phase === "start"
            ? sql`(
                fulfillment_status in ('complete', 'attention')
                or (
                fulfillment_status = 'processing'
                and exists (
                  select 1 from lifecycle_event
                  where booking_id = bookings.id
                )
                and not exists (
                  select 1 from webhook_events as competing_event
                  where competing_event.provider = 'stripe'
                    and competing_event.booking_id = bookings.id
                    and competing_event.event_id <> ${input.eventId}
                    and competing_event.status = 'processing'
                    and competing_event.updated_at > ${competingEventFreshAfter}
                )
              )
              )`
            : sql`fulfillment_status = 'processing'
                  and exists (
                    select 1 from lifecycle_event
                    where booking_id = bookings.id
                  )`
        }
      returning id
    ), bound_event as (
      update webhook_events
      set booking_id = ${input.bookingId}::uuid, updated_at = now()
      where provider = 'stripe'
        and event_id = ${input.eventId}
        and status = 'processing'
        and (booking_id is null or booking_id = ${input.bookingId}::uuid)
        and exists (select 1 from claimed_booking)
      returning event_id
    )
    select id from claimed_booking
    where exists (select 1 from bound_event)
  `);
  if (!claimed.rows[0]) {
    const [existing] = await database
      .select({ fulfillmentStatus: bookings.fulfillmentStatus })
      .from(bookings)
      .where(eq(bookings.id, input.bookingId))
      .limit(1);
    if (!existing) throw new Error("payment_lifecycle_booking_missing");
    throw new Error("payment_lifecycle_busy");
  }
  const [booking] = await database
    .select()
    .from(bookings)
    .where(eq(bookings.id, input.bookingId))
    .limit(1);
  if (!booking) throw new Error("payment_lifecycle_booking_missing");
  return booking;
}

export async function completeFullRefundCancellation(
  bookingId: string,
): Promise<Booking> {
  const now = new Date();
  const database = getDatabase();
  const cancelled = await database.execute<{ id: string }>(sql`
    with cancelled_booking as (
      update bookings
      set payment_status = 'refunded', fulfillment_status = 'complete',
          calendar_status = 'cancelled', updated_at = ${now}
      where id = ${bookingId}::uuid
        and payment_status = 'refunded'
        and fulfillment_status = 'processing'
      returning id
    ), revoked_tokens as (
      update booking_access_tokens
      set revoked_at = ${now}, revoked_reason = 'full_refund'
      where booking_id = ${bookingId}::uuid
        and revoked_at is null
        and exists (select 1 from cancelled_booking)
      returning id
    ), released_slots as (
      update slot_reservations
      set status = 'released', released_at = ${now}, updated_at = ${now}
      where booking_id = ${bookingId}::uuid
        and status in ('held', 'confirmed')
        and exists (select 1 from cancelled_booking)
      returning id
    ), cancelled_reschedules as (
      update reschedule_requests
      set status = 'cancelled', updated_at = ${now}
      where booking_id = ${bookingId}::uuid
        and status in ('requested', 'processing')
        and exists (select 1 from cancelled_booking)
      returning id
    )
    select id from cancelled_booking
  `);
  if (!cancelled.rows[0]) throw new Error("payment_lifecycle_busy");
  const [booking] = await database
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!booking) throw new Error("payment_lifecycle_booking_missing");
  return booking;
}

export async function upsertPaidBooking(
  input: PaidBookingInput,
): Promise<Booking> {
  const now = new Date();
  const { checkoutRequestKey, ...bookingInput } = input;
  const database = getDatabase();
  const [inserted] = await database
    .insert(bookings)
    .values({
      ...bookingInput,
      paymentStatus: "paid",
      fulfillmentStatus: "pending",
      calendarStatus: "pending",
      customerEmailStatus: "pending",
      operationsEmailStatus: "pending",
      currency: "sgd",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: bookings.stripeCheckoutSessionId,
    })
    .returning();

  const booking = inserted ?? (await findBookingByStripeSessionId(
    input.stripeCheckoutSessionId,
  ));

  if (!booking) {
    throw new Error("Paid booking could not be persisted.");
  }
  if (
    booking.paymentStatus !== "paid" ||
    booking.calendarStatus === "cancelled"
  ) {
    throw new PermanentFulfillmentError(
      "booking_cancelled",
      "This paid booking has already been cancelled or refunded.",
    );
  }

  try {
    await confirmPaidCheckoutSlot({
      bookingId: booking.id,
      stripeCheckoutSessionId: booking.stripeCheckoutSessionId,
      checkoutRequestKey,
      slotStart: booking.slotStart,
      slotEnd: booking.slotEnd,
    });
  } catch (error) {
    const current = await findBookingByStripeSessionId(
      booking.stripeCheckoutSessionId,
    );
    if (
      current &&
      (current.paymentStatus !== "paid" ||
        current.calendarStatus === "cancelled")
    ) {
      throw new PermanentFulfillmentError(
        "booking_cancelled",
        "This paid booking has already been cancelled or refunded.",
      );
    }
    throw error;
  }

  return booking;
}

export async function recordWebhookReceipt(
  input: WebhookReceiptInput,
): Promise<boolean> {
  const inserted = await getDatabase()
    .insert(webhookEvents)
    .values({
      provider: "stripe",
      eventId: input.eventId,
      eventType: input.eventType,
      status: "received",
    })
    .onConflictDoNothing({
      target: [webhookEvents.provider, webhookEvents.eventId],
    })
    .returning({ eventId: webhookEvents.eventId });

  return inserted.length === 1;
}

export async function markWebhookReceipt(
  eventId: string,
  status: WebhookProcessingStatus,
  options: { bookingId?: string; failureCode?: string } = {},
): Promise<void> {
  await getDatabase()
    .update(webhookEvents)
    .set({
      status,
      bookingId: options.bookingId,
      failureCode: options.failureCode,
      processedAt: status === "processed" ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(webhookEvents.provider, "stripe"),
        eq(webhookEvents.eventId, eventId),
      ),
    );
}

const MANAGE_LINK_LIFETIME_AFTER_VISIT_MS = 30 * 24 * 60 * 60 * 1_000;
const EVENT_CLAIM_STALE_AFTER_MS = 5 * 60 * 1_000;
const MANAGEABLE_PAYMENT_STATUSES = [
  "paid",
  "partially_refunded",
  "disputed",
];

export type ManageBookingView = Pick<
  Booking,
  | "id"
  | "reference"
  | "customerName"
  | "siteAddress"
  | "installerType"
  | "installerName"
  | "serviceCode"
  | "packageName"
  | "kwp"
  | "currency"
  | "subtotalCents"
  | "gstCents"
  | "totalCents"
  | "slotStart"
  | "slotEnd"
  | "paymentStatus"
  | "graphEventId"
  | "calendarStatus"
  | "rescheduleCount"
  | "recordVersion"
>;

export type ManageAccess = {
  accessTokenId: string;
  booking: ManageBookingView;
};

async function claimWebhookEvent(
  eventId: string,
  eventType: string,
): Promise<EventClaim> {
  await recordWebhookReceipt({ eventId, eventType });
  const staleBefore = new Date(Date.now() - EVENT_CLAIM_STALE_AFTER_MS);
  const claimed = await getDatabase()
    .update(webhookEvents)
    .set({ status: "processing", failureCode: null, updatedAt: new Date() })
    .where(
      and(
        eq(webhookEvents.provider, "stripe"),
        eq(webhookEvents.eventId, eventId),
        or(
          inArray(webhookEvents.status, ["received", "failed"]),
          and(
            eq(webhookEvents.status, "processing"),
            lt(webhookEvents.updatedAt, staleBefore),
          ),
        ),
      ),
    )
    .returning({ eventId: webhookEvents.eventId });

  if (claimed.length === 1) {
    return "claimed";
  }

  const [receipt] = await getDatabase()
    .select({ status: webhookEvents.status })
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.provider, "stripe"),
        eq(webhookEvents.eventId, eventId),
      ),
    )
    .limit(1);
  return receipt?.status === "processed" ? "processed" : "busy";
}

async function startFulfillmentStep(
  bookingId: string,
  stepName: FulfillmentStepName,
): Promise<void> {
  const now = new Date();
  const database = getDatabase();
  const active = await database
    .update(bookings)
    .set({ fulfillmentStatus: "processing", updatedAt: now })
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.paymentStatus, "paid"),
        ne(bookings.calendarStatus, "cancelled"),
      ),
    )
    .returning({ id: bookings.id });
  if (active.length !== 1) {
    throw new PermanentFulfillmentError(
      "booking_not_fulfillable",
      "This booking is no longer eligible for fulfillment.",
    );
  }
  await database
    .insert(fulfillmentSteps)
    .values({
      bookingId,
      stepName,
      status: "processing",
      attemptCount: 1,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [fulfillmentSteps.bookingId, fulfillmentSteps.stepName],
      set: {
        status: "processing",
        attemptCount: sql`${fulfillmentSteps.attemptCount} + 1`,
        failureCode: null,
        updatedAt: now,
      },
    });
}

async function completeFulfillmentStep(
  bookingId: string,
  stepName: FulfillmentStepName,
  externalId?: string,
): Promise<void> {
  const completed = await getDatabase()
    .update(fulfillmentSteps)
    .set({
      status: "complete",
      externalId,
      failureCode: null,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(fulfillmentSteps.bookingId, bookingId),
        eq(fulfillmentSteps.stepName, stepName),
      ),
    )
    .returning({ bookingId: fulfillmentSteps.bookingId });
  if (completed.length !== 1) {
    throw new Error("fulfillment_step_not_active");
  }
}

async function failFulfillmentStep(
  bookingId: string,
  stepName: FulfillmentStepName,
  failureCode: string,
): Promise<void> {
  await getDatabase()
    .update(fulfillmentSteps)
    .set({ status: "failed", failureCode, updatedAt: new Date() })
    .where(
      and(
        eq(fulfillmentSteps.bookingId, bookingId),
        eq(fulfillmentSteps.stepName, stepName),
      ),
    );
}

async function completeCalendar(
  bookingId: string,
  eventId: string,
  status: CalendarResult["status"],
): Promise<void> {
  const completed = await getDatabase()
    .update(bookings)
    .set({
      graphEventId: eventId,
      calendarStatus: "created",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.paymentStatus, "paid"),
        ne(bookings.calendarStatus, "cancelled"),
        eq(bookings.fulfillmentStatus, "processing"),
      ),
    )
    .returning({ id: bookings.id });
  if (completed.length !== 1) {
    throw new PermanentFulfillmentError(
      "booking_not_fulfillable",
      "This booking is no longer eligible for calendar fulfillment.",
    );
  }
  await completeFulfillmentStep(bookingId, "calendar", eventId);
  void status;
}

export async function ensureManageAccessForBooking(
  bookingId: string,
  slotEnd: Date,
): Promise<ManageAccessCredential> {
  const database = getDatabase();
  const secret = manageLinkSecret();
  const now = new Date();
  const expiresAt = new Date(
    slotEnd.getTime() + MANAGE_LINK_LIFETIME_AFTER_VISIT_MS,
  );
  if (expiresAt <= now) {
    throw new Error("Manage-link expiry is already in the past.");
  }

  const [active] = await database
    .select({
      id: bookingAccessTokens.id,
      tokenDigest: bookingAccessTokens.tokenDigest,
      expiresAt: bookingAccessTokens.expiresAt,
    })
    .from(bookingAccessTokens)
    .innerJoin(bookings, eq(bookings.id, bookingAccessTokens.bookingId))
    .where(
      and(
        eq(bookingAccessTokens.bookingId, bookingId),
        eq(bookingAccessTokens.purpose, "manage_booking"),
        isNull(bookingAccessTokens.revokedAt),
        inArray(bookings.paymentStatus, MANAGEABLE_PAYMENT_STATUSES),
        eq(bookings.calendarStatus, "created"),
      ),
    )
    .limit(1);
  if (active) {
    const activeToken = buildManageToken(
      { id: active.id, expiresAt: active.expiresAt },
      secret,
    );
    if (
      active.expiresAt > now &&
      active.expiresAt >= expiresAt &&
      digestManageToken(activeToken) === active.tokenDigest
    ) {
      return {
        id: active.id,
        token: activeToken,
        expiresAt: active.expiresAt,
        rotated: false,
      };
    }

    const id = newManageTokenId();
    const token = buildManageToken({ id, expiresAt }, secret);
    const rotated = await database.execute<{ id: string }>(sql`
      with active_booking as (
        select id from bookings
        where id = ${bookingId}::uuid
          and payment_status in ('paid', 'partially_refunded', 'disputed')
          and calendar_status = 'created'
        for update
      ), revoked as (
        update booking_access_tokens
        set revoked_at = ${now},
            revoked_reason = ${active.expiresAt < expiresAt
              ? "appointment_extended"
              : "expired_or_secret_rotated"}
        where id = ${active.id}::uuid
          and revoked_at is null
          and exists (select 1 from active_booking)
        returning id
      )
      insert into booking_access_tokens (
        id, booking_id, purpose, token_digest, expires_at
      )
      select ${id}::uuid, ${bookingId}::uuid, 'manage_booking',
             ${digestManageToken(token)}, ${expiresAt}
      where exists (select 1 from revoked)
      returning id
    `);
    if (rotated.rows[0]) {
      return { id, token, expiresAt, rotated: true };
    }
  }

  const id = newManageTokenId();
  const token = buildManageToken({ id, expiresAt }, secret);
  try {
    const created = await database.execute<{ id: string }>(sql`
      with active_booking as (
        select id from bookings
        where id = ${bookingId}::uuid
          and payment_status in ('paid', 'partially_refunded', 'disputed')
          and calendar_status = 'created'
        for update
      )
      insert into booking_access_tokens (
        id, booking_id, purpose, token_digest, expires_at
      )
      select ${id}::uuid, id, 'manage_booking', ${digestManageToken(token)},
             ${expiresAt}
      from active_booking
      returning id
    `);
    if (created.rows[0]) {
      return { id, token, expiresAt, rotated: Boolean(active) };
    }
    throw new PermanentFulfillmentError(
      "booking_not_manageable",
      "This booking is no longer eligible for manage access.",
    );
  } catch (error) {
    // A simultaneous replay may have won the single-active-token constraint.
    const [winner] = await database
      .select({
        id: bookingAccessTokens.id,
        tokenDigest: bookingAccessTokens.tokenDigest,
        expiresAt: bookingAccessTokens.expiresAt,
      })
      .from(bookingAccessTokens)
      .innerJoin(bookings, eq(bookings.id, bookingAccessTokens.bookingId))
      .where(
        and(
          eq(bookingAccessTokens.bookingId, bookingId),
          eq(bookingAccessTokens.purpose, "manage_booking"),
          isNull(bookingAccessTokens.revokedAt),
          gt(bookingAccessTokens.expiresAt, now),
          inArray(bookings.paymentStatus, MANAGEABLE_PAYMENT_STATUSES),
          eq(bookings.calendarStatus, "created"),
        ),
      )
      .limit(1);
    if (winner) {
      const winnerToken = buildManageToken(
        { id: winner.id, expiresAt: winner.expiresAt },
        secret,
      );
      if (digestManageToken(winnerToken) !== winner.tokenDigest) throw error;
      return {
        id: winner.id,
        token: winnerToken,
        expiresAt: winner.expiresAt,
        rotated: Boolean(active),
      };
    }
    throw error;
  }
}

export async function findManageAccess(token: string): Promise<ManageAccess | null> {
  const claims = verifyManageToken(token, manageLinkSecret());
  if (!claims) {
    return null;
  }
  const digest = digestManageToken(token);
  const [result] = await getDatabase()
    .select({
      tokenId: bookingAccessTokens.id,
      booking: {
        id: bookings.id,
        reference: bookings.reference,
        customerName: bookings.customerName,
        siteAddress: bookings.siteAddress,
        installerType: bookings.installerType,
        installerName: bookings.installerName,
        serviceCode: bookings.serviceCode,
        packageName: bookings.packageName,
        kwp: bookings.kwp,
        currency: bookings.currency,
        subtotalCents: bookings.subtotalCents,
        gstCents: bookings.gstCents,
        totalCents: bookings.totalCents,
        slotStart: bookings.slotStart,
        slotEnd: bookings.slotEnd,
        paymentStatus: bookings.paymentStatus,
        graphEventId: bookings.graphEventId,
        calendarStatus: bookings.calendarStatus,
        rescheduleCount: bookings.rescheduleCount,
        recordVersion: bookings.recordVersion,
      },
    })
    .from(bookingAccessTokens)
    .innerJoin(bookings, eq(bookings.id, bookingAccessTokens.bookingId))
    .where(
      and(
        eq(bookingAccessTokens.id, claims.id),
        eq(bookingAccessTokens.tokenDigest, digest),
        isNull(bookingAccessTokens.revokedAt),
        gt(bookingAccessTokens.expiresAt, new Date()),
        inArray(bookings.paymentStatus, MANAGEABLE_PAYMENT_STATUSES),
        eq(bookings.calendarStatus, "created"),
      ),
    )
    .limit(1);
  if (!result) {
    return null;
  }
  await getDatabase()
    .update(bookingAccessTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(bookingAccessTokens.id, result.tokenId));
  return { accessTokenId: result.tokenId, booking: result.booking };
}

export async function findManageBooking(
  token: string,
): Promise<ManageBookingView | null> {
  return (await findManageAccess(token))?.booking ?? null;
}

export function manageTokenForAccessRecord(input: {
  id: string;
  expiresAt: Date;
}): string {
  return buildManageToken(input, manageLinkSecret());
}

export const databaseFulfillmentStore: FulfillmentStore = {
  claimEvent: claimWebhookEvent,
  persistBooking: upsertPaidBooking,
  startStep: startFulfillmentStep,
  completeCalendar,
  completeStep: completeFulfillmentStep,
  failStep: failFulfillmentStep,
  async completeBooking(bookingId) {
    const completed = await getDatabase()
      .update(bookings)
      .set({ fulfillmentStatus: "complete", updatedAt: new Date() })
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.paymentStatus, "paid"),
          eq(bookings.calendarStatus, "created"),
          eq(bookings.fulfillmentStatus, "processing"),
        ),
      )
      .returning({ id: bookings.id });
    if (completed.length !== 1) {
      throw new PermanentFulfillmentError(
        "booking_not_fulfillable",
        "This booking is no longer eligible for fulfillment completion.",
      );
    }
  },
  async failBooking(bookingId, failureCode) {
    await getDatabase()
      .update(bookings)
      .set({
        fulfillmentStatus: "attention",
        ...(failureCode.startsWith("calendar")
          ? { calendarStatus: "failed" }
          : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bookings.id, bookingId),
          ne(bookings.paymentStatus, "refunded"),
          ne(bookings.calendarStatus, "cancelled"),
        ),
      );
  },
  async completeEvent(eventId, bookingId) {
    await markWebhookReceipt(eventId, "processed", { bookingId });
  },
  async failEvent(eventId, failureCode, bookingId) {
    await markWebhookReceipt(eventId, "failed", { bookingId, failureCode });
  },
  ensureManageAccess: ensureManageAccessForBooking,
};

export const databasePaymentLifecycleStore: PaymentLifecycleStore = {
  claimEvent: claimWebhookEvent,
  findBookingByPaymentIntent: findBookingByStripePaymentIntentId,
  markAttention: markPaymentLifecycleAttention,
  completeFullRefund: completeFullRefundCancellation,
  async completeEvent(eventId, bookingId) {
    await markWebhookReceipt(eventId, "processed", { bookingId });
  },
  async failEvent(eventId, failureCode, bookingId) {
    await markWebhookReceipt(eventId, "failed", { bookingId, failureCode });
  },
};
