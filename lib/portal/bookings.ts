import "server-only";

import { and, eq } from "drizzle-orm";
import { bookings, webhookEvents, type Booking } from "@/db/schema";
import { getDatabase } from "@/lib/database";

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

