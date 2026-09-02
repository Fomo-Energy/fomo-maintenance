import "server-only";

import {
  and,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import {
  bookingAccessTokens,
  bookings,
  fulfillmentSteps,
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
} from "@/lib/portal/fulfillment";

export type PaidBookingInput = {
  reference: string;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  siteAddress: string;
  serviceCode: string;
  packageName: string;
  kwp: string | null;
  subtotalCents: number;
  gstCents: number;
  totalCents: number;
  slotStart: Date;
  slotEnd: Date;
  paidAt: Date;
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

export async function upsertPaidBooking(
  input: PaidBookingInput,
): Promise<Booking> {
  const now = new Date();
  const [booking] = await getDatabase()
    .insert(bookings)
    .values({
      ...input,
      paymentStatus: "paid",
      fulfillmentStatus: "pending",
      calendarStatus: "pending",
      customerEmailStatus: "pending",
      operationsEmailStatus: "pending",
      currency: "sgd",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: bookings.stripeCheckoutSessionId,
      set: {
        stripePaymentIntentId: input.stripePaymentIntentId,
        paymentStatus: "paid",
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        siteAddress: input.siteAddress,
        serviceCode: input.serviceCode,
        packageName: input.packageName,
        kwp: input.kwp,
        subtotalCents: input.subtotalCents,
        gstCents: input.gstCents,
        totalCents: input.totalCents,
        slotStart: input.slotStart,
        slotEnd: input.slotEnd,
        paidAt: input.paidAt,
        updatedAt: now,
      },
    })
    .returning();

  if (!booking) {
    throw new Error("Paid booking could not be persisted.");
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

export type ManageBookingView = Pick<
  Booking,
  | "id"
  | "reference"
  | "customerName"
  | "siteAddress"
  | "packageName"
  | "kwp"
  | "currency"
  | "subtotalCents"
  | "gstCents"
  | "totalCents"
  | "slotStart"
  | "slotEnd"
  | "calendarStatus"
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
  await getDatabase()
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
  await getDatabase()
    .update(bookings)
    .set({ fulfillmentStatus: "processing", updatedAt: now })
    .where(eq(bookings.id, bookingId));
}

async function completeFulfillmentStep(
  bookingId: string,
  stepName: FulfillmentStepName,
  externalId?: string,
): Promise<void> {
  await getDatabase()
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
    );
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
  await getDatabase()
    .update(bookings)
    .set({
      graphEventId: eventId,
      calendarStatus: "created",
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, bookingId));
  await completeFulfillmentStep(bookingId, "calendar", eventId);
  void status;
}

async function ensureManageAccess(
  bookingId: string,
  slotEnd: Date,
): Promise<string> {
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
    .select()
    .from(bookingAccessTokens)
    .where(
      and(
        eq(bookingAccessTokens.bookingId, bookingId),
        eq(bookingAccessTokens.purpose, "manage_booking"),
        isNull(bookingAccessTokens.revokedAt),
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
      digestManageToken(activeToken) === active.tokenDigest
    ) {
      return active.id;
    }
    await database
      .update(bookingAccessTokens)
      .set({ revokedAt: now, revokedReason: "expired_or_secret_rotated" })
      .where(eq(bookingAccessTokens.id, active.id));
  }

  const id = newManageTokenId();
  const token = buildManageToken({ id, expiresAt }, secret);
  try {
    await database.insert(bookingAccessTokens).values({
      id,
      bookingId,
      tokenDigest: digestManageToken(token),
      expiresAt,
    });
    return id;
  } catch (error) {
    // A simultaneous replay may have won the single-active-token constraint.
    const [winner] = await database
      .select({ id: bookingAccessTokens.id })
      .from(bookingAccessTokens)
      .where(
        and(
          eq(bookingAccessTokens.bookingId, bookingId),
          eq(bookingAccessTokens.purpose, "manage_booking"),
          isNull(bookingAccessTokens.revokedAt),
          gt(bookingAccessTokens.expiresAt, now),
        ),
      )
      .limit(1);
    if (winner) {
      return winner.id;
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
        packageName: bookings.packageName,
        kwp: bookings.kwp,
        currency: bookings.currency,
        subtotalCents: bookings.subtotalCents,
        gstCents: bookings.gstCents,
        totalCents: bookings.totalCents,
        slotStart: bookings.slotStart,
        slotEnd: bookings.slotEnd,
        calendarStatus: bookings.calendarStatus,
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
    await getDatabase()
      .update(bookings)
      .set({ fulfillmentStatus: "complete", updatedAt: new Date() })
      .where(eq(bookings.id, bookingId));
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
      .where(eq(bookings.id, bookingId));
  },
  async completeEvent(eventId, bookingId) {
    await markWebhookReceipt(eventId, "processed", { bookingId });
  },
  async failEvent(eventId, failureCode, bookingId) {
    await markWebhookReceipt(eventId, "failed", { bookingId, failureCode });
  },
  ensureManageAccess,
};
