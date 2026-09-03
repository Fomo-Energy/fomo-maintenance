import "server-only";

import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { bookings, emailDeliveries } from "@/db/schema";
import { getDatabase } from "@/lib/database";
import type {
  EmailClaim,
  EmailDeliveryStore,
} from "@/lib/portal/email-flow";

const PROCESSING_STALE_AFTER_MS = 5 * 60 * 1_000;

export type EmailMessageKind =
  | "booking_customer"
  | "booking_operations"
  | "reschedule_customer"
  | "reschedule_operations"
  | "partial_refund_operations"
  | "dispute_operations";

function bookingStatusColumn(messageKind: string) {
  if (messageKind === "booking_customer") return "customer" as const;
  if (messageKind === "booking_operations") return "operations" as const;
  return null;
}

async function setBookingEmailStatus(
  bookingId: string,
  messageKind: string,
  status: "processing" | "sent" | "failed" | "suppressed",
): Promise<void> {
  const column = bookingStatusColumn(messageKind);
  if (!column) return;
  await getDatabase()
    .update(bookings)
    .set({
      ...(column === "customer"
        ? { customerEmailStatus: status }
        : { operationsEmailStatus: status }),
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, bookingId));
}

async function claimEmailDelivery(input: {
  bookingId: string;
  rescheduleRequestId?: string;
  messageKind: string;
  recipient: string;
  idempotencyKey: string;
}): Promise<EmailClaim> {
  const now = new Date();
  const database = getDatabase();
  const inserted = await database
    .insert(emailDeliveries)
    .values({
      bookingId: input.bookingId,
      rescheduleRequestId: input.rescheduleRequestId,
      messageKind: input.messageKind,
      recipient: input.recipient,
      idempotencyKey: input.idempotencyKey,
      status: "processing",
      attemptCount: 1,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: emailDeliveries.idempotencyKey })
    .returning({ id: emailDeliveries.id });
  if (inserted[0]) {
    await setBookingEmailStatus(
      input.bookingId,
      input.messageKind,
      "processing",
    );
    return { status: "send", deliveryId: inserted[0].id };
  }

  const [existing] = await database
    .select()
    .from(emailDeliveries)
    .where(eq(emailDeliveries.idempotencyKey, input.idempotencyKey))
    .limit(1);
  if (!existing) throw new Error("email_delivery_claim_missing");
  if (existing.status === "sent") {
    return {
      status: "sent",
      providerMessageId: existing.providerMessageId,
    };
  }
  if (existing.status === "suppressed") {
    throw new Error("email_delivery_suppressed");
  }

  const staleBefore = new Date(now.getTime() - PROCESSING_STALE_AFTER_MS);
  const reclaimed = await database
    .update(emailDeliveries)
    .set({
      status: "processing",
      recipient: input.recipient,
      failureCode: null,
      attemptCount: sql`${emailDeliveries.attemptCount} + 1`,
      updatedAt: now,
    })
    .where(
      and(
        eq(emailDeliveries.id, existing.id),
        or(
          eq(emailDeliveries.status, "failed"),
          and(
            eq(emailDeliveries.status, "processing"),
            lt(emailDeliveries.updatedAt, staleBefore),
          ),
        ),
      ),
    )
    .returning({ id: emailDeliveries.id });
  if (!reclaimed[0]) return { status: "busy" };
  await setBookingEmailStatus(
    input.bookingId,
    input.messageKind,
    "processing",
  );
  return { status: "send", deliveryId: reclaimed[0].id };
}

async function completeEmailDelivery(
  deliveryId: string,
  providerMessageId: string,
): Promise<void> {
  const now = new Date();
  const [delivery] = await getDatabase()
    .update(emailDeliveries)
    .set({
      status: "sent",
      providerMessageId,
      failureCode: null,
      sentAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(emailDeliveries.id, deliveryId),
        eq(emailDeliveries.status, "processing"),
      ),
    )
    .returning({
      bookingId: emailDeliveries.bookingId,
      messageKind: emailDeliveries.messageKind,
    });
  if (!delivery) throw new Error("email_delivery_completion_conflict");
  await setBookingEmailStatus(delivery.bookingId, delivery.messageKind, "sent");
}

async function failEmailDelivery(
  deliveryId: string,
  failureCode: string,
): Promise<void> {
  const [delivery] = await getDatabase()
    .update(emailDeliveries)
    .set({
      status: "failed",
      failureCode: failureCode.slice(0, 80),
      updatedAt: new Date(),
    })
    .where(eq(emailDeliveries.id, deliveryId))
    .returning({
      bookingId: emailDeliveries.bookingId,
      messageKind: emailDeliveries.messageKind,
    });
  if (delivery) {
    await setBookingEmailStatus(
      delivery.bookingId,
      delivery.messageKind,
      "failed",
    );
  }
}

export const databaseEmailDeliveryStore: EmailDeliveryStore = {
  claim: claimEmailDelivery,
  complete: completeEmailDelivery,
  fail: failEmailDelivery,
};

export async function listRetryableEmailDeliveries(limit = 50) {
  return getDatabase()
    .select()
    .from(emailDeliveries)
    .where(inArray(emailDeliveries.status, ["failed", "processing"]))
    .limit(Math.max(1, Math.min(limit, 50)));
}
