import type Stripe from "stripe";
import type { Booking } from "@/db/schema";
import type { EventClaim } from "@/lib/portal/fulfillment";

export type LifecyclePaymentStatus =
  | "refunded"
  | "partially_refunded"
  | "disputed";

export type PaymentLifecycleStore = {
  claimEvent(eventId: string, eventType: string): Promise<EventClaim>;
  findBookingByPaymentIntent(paymentIntentId: string): Promise<Booking | null>;
  markAttention(input: {
    bookingId: string;
    paymentStatus: LifecyclePaymentStatus;
    phase?: "start" | "complete";
    eventId?: string;
  }): Promise<Booking>;
  completeFullRefund(bookingId: string): Promise<Booking>;
  completeEvent(eventId: string, bookingId?: string): Promise<void>;
  failEvent(
    eventId: string,
    failureCode: string,
    bookingId?: string,
  ): Promise<void>;
};

export type PaymentLifecycleServices = {
  store: PaymentLifecycleStore;
  loadCharge(chargeId: string): Promise<Stripe.Charge>;
  loadDispute(disputeId: string): Promise<Stripe.Dispute>;
  paymentBelongsToApplication(paymentIntentId: string): Promise<boolean>;
  cancelCalendar(eventId: string): Promise<void>;
  sendOperationsAlert?(input: {
    booking: Booking;
    eventId: string;
    kind: "partial_refund" | "dispute";
    amountCents: number;
    chargeId: string;
    disputeId?: string;
    appointmentRetained: boolean;
  }): Promise<unknown>;
};

export type PaymentLifecycleResult =
  | { status: "complete"; outcome: LifecyclePaymentStatus }
  | { status: "duplicate" }
  | { status: "busy" }
  | { status: "ignored"; reason: string }
  | { status: "rejected"; reason: string }
  | { status: "failed"; reason: string };

class PermanentLifecycleError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "PermanentLifecycleError";
  }
}

function expandableId(
  value: string | { id: string } | null | undefined,
): string | null {
  return typeof value === "string" ? value : value?.id || null;
}

function validateChargeForBooking(
  charge: Stripe.Charge,
  booking: Booking,
): string {
  const paymentIntentId = expandableId(charge.payment_intent);
  if (!paymentIntentId || paymentIntentId !== booking.stripePaymentIntentId) {
    throw new PermanentLifecycleError("payment_intent_mismatch");
  }
  if (
    charge.currency.toLowerCase() !== booking.currency.toLowerCase() ||
    charge.amount !== booking.totalCents
  ) {
    throw new PermanentLifecycleError("charge_amount_mismatch");
  }
  return paymentIntentId;
}

async function bookingForCharge(
  charge: Stripe.Charge,
  services: PaymentLifecycleServices,
): Promise<Booking> {
  const paymentIntentId = expandableId(charge.payment_intent);
  if (!paymentIntentId) {
    throw new PermanentLifecycleError("charge_missing_payment_intent");
  }
  const booking = await services.store.findBookingByPaymentIntent(
    paymentIntentId,
  );
  if (!booking) {
    if (await services.paymentBelongsToApplication(paymentIntentId)) {
      throw new Error("booking_not_found_yet");
    }
    throw new PermanentLifecycleError("unrelated_payment");
  }
  validateChargeForBooking(charge, booking);
  return booking;
}

export async function processPaymentLifecycleEvent(
  input: {
    eventId: string;
    eventType: "charge.refunded" | "charge.dispute.created";
    objectId: string;
  },
  services: PaymentLifecycleServices,
): Promise<PaymentLifecycleResult> {
  const claim = await services.store.claimEvent(input.eventId, input.eventType);
  if (claim === "processed") return { status: "duplicate" };
  if (claim === "busy") return { status: "busy" };

  let booking: Booking | undefined;
  let lifecycleStatus: LifecyclePaymentStatus | undefined;
  let lifecycleClaimed = false;
  try {
    if (input.eventType === "charge.refunded") {
      const charge = await services.loadCharge(input.objectId);
      booking = await bookingForCharge(charge, services);
      if (
        !Number.isInteger(charge.amount_refunded) ||
        charge.amount_refunded <= 0 ||
        charge.amount_refunded > charge.amount
      ) {
        throw new PermanentLifecycleError("invalid_refund_amount");
      }

      const fullRefund =
        charge.refunded || charge.amount_refunded === charge.amount;
      if (fullRefund) {
        lifecycleStatus = "refunded";
        booking = await services.store.markAttention({
          bookingId: booking.id,
          paymentStatus: "refunded",
          eventId: input.eventId,
        });
        lifecycleClaimed = true;
        if (booking.graphEventId) {
          await services.cancelCalendar(booking.graphEventId);
        } else if (
          booking.calendarStatus !== "pending" &&
          booking.calendarStatus !== "cancelled"
        ) {
          throw new Error("calendar_event_id_missing");
        }
        booking = await services.store.completeFullRefund(booking.id);
        await services.store.completeEvent(input.eventId, booking.id);
        return { status: "complete", outcome: "refunded" };
      }

      lifecycleStatus = "partially_refunded";
      booking = await services.store.markAttention({
        bookingId: booking.id,
        paymentStatus: "partially_refunded",
        eventId: input.eventId,
      });
      lifecycleClaimed = true;
      if (services.sendOperationsAlert) {
        await services.sendOperationsAlert({
          booking,
          eventId: input.eventId,
          kind: "partial_refund",
          amountCents: charge.amount_refunded,
          chargeId: charge.id,
          appointmentRetained: true,
        });
      }
      booking = await services.store.markAttention({
        bookingId: booking.id,
        paymentStatus: "partially_refunded",
        phase: "complete",
        eventId: input.eventId,
      });
      await services.store.completeEvent(input.eventId, booking.id);
      return { status: "complete", outcome: "partially_refunded" };
    }

    const dispute = await services.loadDispute(input.objectId);
    const chargeId = expandableId(dispute.charge);
    if (!chargeId) {
      throw new PermanentLifecycleError("dispute_missing_charge");
    }
    const charge = await services.loadCharge(chargeId);
    booking = await bookingForCharge(charge, services);
    if (
      !Number.isInteger(dispute.amount) ||
      dispute.amount <= 0 ||
      dispute.amount > charge.amount ||
      dispute.currency.toLowerCase() !== booking.currency.toLowerCase()
    ) {
      throw new PermanentLifecycleError("invalid_dispute_amount");
    }
    lifecycleStatus = "disputed";
    booking = await services.store.markAttention({
      bookingId: booking.id,
      paymentStatus: "disputed",
      eventId: input.eventId,
    });
    lifecycleClaimed = true;
    if (services.sendOperationsAlert) {
      await services.sendOperationsAlert({
        booking,
        eventId: input.eventId,
        kind: "dispute",
        amountCents: dispute.amount,
        chargeId: charge.id,
        disputeId: dispute.id,
        appointmentRetained:
          booking.paymentStatus !== "refunded" &&
          booking.calendarStatus === "created",
      });
    }
    booking = await services.store.markAttention({
      bookingId: booking.id,
      paymentStatus: "disputed",
      phase: "complete",
      eventId: input.eventId,
    });
    await services.store.completeEvent(input.eventId, booking.id);
    return { status: "complete", outcome: "disputed" };
  } catch (error) {
    const reason =
      error instanceof PermanentLifecycleError
        ? error.code
        : error instanceof Error
          ? error.message.slice(0, 80)
          : "payment_lifecycle_failed";
    if (booking && lifecycleStatus && lifecycleClaimed) {
      await services.store.markAttention({
        bookingId: booking.id,
        paymentStatus: lifecycleStatus,
        phase: "complete",
        eventId: input.eventId,
      });
    }
    if (
      error instanceof PermanentLifecycleError &&
      ["unrelated_payment", "charge_missing_payment_intent"].includes(
        error.code,
      )
    ) {
      await services.store.completeEvent(input.eventId);
      return { status: "ignored", reason };
    }
    await services.store.failEvent(
      input.eventId,
      reason,
      lifecycleClaimed ? booking?.id : undefined,
    );
    return error instanceof PermanentLifecycleError
      ? { status: "rejected", reason }
      : { status: "failed", reason };
  }
}
