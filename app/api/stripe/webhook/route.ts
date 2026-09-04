import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { databaseIsConfigured } from "@/lib/database";
import {
  createMaintenanceVisitRecordWithRetry,
  createMaintenanceVisitWithRetry,
  deleteMaintenanceVisitWithRetry,
} from "@/lib/microsoft";
import {
  databaseFulfillmentStore,
  databasePaymentLifecycleStore,
} from "@/lib/portal/bookings";
import {
  bookingPortalEnabled,
  checkoutReservationsEnabled,
  manageLinkSecret,
  paymentLifecycleEnabled,
  transactionalEmailEnabled,
} from "@/lib/portal/config";
import { fulfillPaidCheckout } from "@/lib/portal/fulfillment";
import {
  deliverBookingCustomerNotification,
  deliverBookingOperationsNotification,
  deliverPaymentLifecycleOperationsNotification,
} from "@/lib/portal/notifications";
import { processPaymentLifecycleEvent } from "@/lib/portal/payment-lifecycle";
import {
  confirmCheckoutSlotWithoutBooking,
  extendCheckoutSlotForAsyncPayment,
  releaseCheckoutSlot,
} from "@/lib/portal/rescheduling";
import {
  checkoutLifecycleAction,
  type CheckoutLifecycleAction,
} from "@/lib/portal/stripe-lifecycle";
import { getStripe, stripeWebhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ASYNC_PAYMENT_HOLD_MS = 7 * 24 * 60 * 60 * 1_000;

function meta(session: Stripe.Checkout.Session, key: string): string {
  return session.metadata?.[key]?.trim() || "";
}

function amountPaidLabel(session: Stripe.Checkout.Session): string {
  if (typeof session.amount_total === "number") {
    return `S$${(session.amount_total / 100).toLocaleString("en-SG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  const fromMeta = meta(session, "amountSgd");
  if (fromMeta) {
    return fromMeta;
  }
  return "unknown";
}

function loggableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function markCalendarStatus(
  session: Stripe.Checkout.Session,
  status: "created" | "exists" | "failed",
): Promise<void> {
  try {
    await getStripe().checkout.sessions.update(session.id, {
      metadata: {
        ...(session.metadata ?? {}),
        calendarStatus: status,
      },
    });
  } catch (error) {
    console.error(
      "[fomo-maintenance] could not write calendarStatus on Stripe session",
      { sessionId: session.id, status, error },
    );
  }
}

async function handlePaidCheckout(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") {
    console.info(
      "[fomo-maintenance] skipping calendar; payment_status is",
      session.payment_status,
      session.id,
    );
    return { calendar: "skipped" as const };
  }

  const installer = meta(session, "installer");
  if (installer === "rto") {
    console.error(
      "[fomo-maintenance] paid RTO session; calendar not created",
      session.id,
    );
    return { calendar: "skipped" as const };
  }

  const slotStart = meta(session, "slotStart");
  const slotEnd = meta(session, "slotEnd");
  const address = meta(session, "address");
  const email = meta(session, "email") || session.customer_email || "";

  if (!slotStart || !slotEnd || !address || !email) {
    console.error(
      "[fomo-maintenance] paid Checkout Session missing booking metadata",
      { sessionId: session.id },
    );
    await markCalendarStatus(session, "failed");
    return { calendar: "failed" as const };
  }

  try {
    const result = await createMaintenanceVisitWithRetry({
      sessionId: session.id,
      address,
      email,
      name: meta(session, "name"),
      phone: meta(session, "phone"),
      slotStart,
      slotEnd,
      kwp: meta(session, "kwp"),
      installer,
      installerName: meta(session, "installerName"),
      serviceCode: meta(session, "serviceCode"),
      packageName: meta(session, "package"),
      breakdown: meta(session, "breakdown"),
      extras: meta(session, "extras"),
      amountPaidSgd: amountPaidLabel(session),
      scope: meta(session, "scope"),
      exclusions: meta(session, "exclusions"),
      cleaningAccessStatus: meta(session, "cleaningAccessStatus"),
      monitoringCompatibilityStatus: meta(
        session,
        "monitoringCompatibilityStatus",
      ),
      indicative: meta(session, "indicative") === "1",
    });
    await markCalendarStatus(session, result);
    return { calendar: result };
  } catch (error) {
    console.error(
      "[fomo-maintenance] Graph calendar create failed after retry",
      {
        sessionId: session.id,
        slotStart,
        slotEnd,
        amount: amountPaidLabel(session),
        error: loggableError(error),
      },
    );
    await markCalendarStatus(session, "failed");
    return { calendar: "failed" as const };
  }
}

async function handleDurablePaidCheckout(
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
) {
  if (!databaseIsConfigured()) {
    throw new Error(
      "BOOKING_PORTAL_ENABLED is set but DATABASE_URL is not configured.",
    );
  }
  manageLinkSecret();

  const result = await fulfillPaidCheckout(
    {
      eventId: event.id,
      eventType: event.type,
      sessionId: session.id,
      paidAt: new Date(event.created * 1_000),
    },
    {
      store: databaseFulfillmentStore,
      loadSession: (sessionId) =>
        getStripe().checkout.sessions.retrieve(sessionId),
      ensureCalendar: createMaintenanceVisitRecordWithRetry,
      ...(transactionalEmailEnabled()
        ? {
            sendCustomerEmail: deliverBookingCustomerNotification,
            sendOperationsEmail: deliverBookingOperationsNotification,
          }
        : {}),
    },
  );

  if (result.status === "complete") {
    await markCalendarStatus(session, result.calendar);
  } else if (result.status === "rejected") {
    console.error("[fomo-maintenance] paid fulfilment rejected", {
      eventId: event.id,
      sessionId: session.id,
      reason: result.reason,
    });
    await markCalendarStatus(session, "failed");
  } else if (result.status === "failed") {
    console.error("[fomo-maintenance] paid fulfilment will be retried", {
      eventId: event.id,
      sessionId: session.id,
      reason: result.reason,
    });
    await markCalendarStatus(session, "failed");
  }

  return result;
}

async function handleReservationLifecycle(
  action: CheckoutLifecycleAction,
  session: Stripe.Checkout.Session,
): Promise<"released" | "expired" | "awaiting_payment" | null> {
  if (!checkoutReservationsEnabled()) {
    return null;
  }
  if (!databaseIsConfigured()) {
    throw new Error(
      "CHECKOUT_RESERVATIONS_ENABLED is set but DATABASE_URL is not configured.",
    );
  }

  if (action === "expire") {
    await releaseCheckoutSlot({
      stripeCheckoutSessionId: session.id,
      reason: "expired",
    });
    return "expired";
  }
  if (action === "release") {
    await releaseCheckoutSlot({
      stripeCheckoutSessionId: session.id,
      reason: "released",
    });
    return "released";
  }
  if (action === "await_payment") {
    // A delayed payment has left Checkout but has not settled. Keep the slot
    // until Stripe reports async success/failure instead of letting the normal
    // Checkout expiry release a potentially paid appointment.
    await extendCheckoutSlotForAsyncPayment({
      stripeCheckoutSessionId: session.id,
      expiresAt: new Date(Date.now() + ASYNC_PAYMENT_HOLD_MS),
    });
    return "awaiting_payment";
  }
  return null;
}

async function handlePaymentLifecycle(event: Stripe.Event) {
  if (!bookingPortalEnabled() || !paymentLifecycleEnabled()) {
    throw new Error(
      "Payment lifecycle handling requires BOOKING_PORTAL_ENABLED=1 and PAYMENT_LIFECYCLE_ENABLED=1.",
    );
  }
  if (!databaseIsConfigured()) {
    throw new Error("Payment lifecycle database is not configured.");
  }
  const object = event.data.object as { id?: string };
  if (!object.id) {
    throw new Error("Stripe lifecycle event is missing its object ID.");
  }
  const result = await processPaymentLifecycleEvent(
    {
      eventId: event.id,
      eventType: event.type as
        | "charge.refunded"
        | "charge.dispute.created",
      objectId: object.id,
    },
    {
      store: databasePaymentLifecycleStore,
      loadCharge: (chargeId) => getStripe().charges.retrieve(chargeId),
      loadDispute: (disputeId) => getStripe().disputes.retrieve(disputeId),
      async paymentBelongsToApplication(paymentIntentId) {
        const paymentIntent = await getStripe().paymentIntents.retrieve(
          paymentIntentId,
        );
        if (paymentIntent.metadata.application === "fomo-maintenance") {
          return true;
        }
        const sessions = await getStripe().checkout.sessions.list({
          payment_intent: paymentIntentId,
          limit: 3,
        });
        return sessions.data.some(
          (session) =>
            session.metadata?.application === "fomo-maintenance" ||
            Boolean(session.metadata?.pricingVersion) ||
            session.metadata?.fulfillmentStatus === "service_booked",
        );
      },
      cancelCalendar: deleteMaintenanceVisitWithRetry,
      ...(transactionalEmailEnabled()
        ? {
            sendOperationsAlert:
              deliverPaymentLifecycleOperationsNotification,
          }
        : {}),
    },
  );
  return result;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      stripeWebhookSecret(),
    );
  } catch (error) {
    console.error("[fomo-maintenance] invalid Stripe webhook signature", error);
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  if (
    event.type === "charge.refunded" ||
    event.type === "charge.dispute.created"
  ) {
    try {
      const result = await handlePaymentLifecycle(event);
      if (result.status === "busy" || result.status === "failed") {
        return NextResponse.json(
          { received: true, paymentLifecycle: result.status },
          { status: 503 },
        );
      }
      return NextResponse.json({
        received: true,
        paymentLifecycle: result.status,
      });
    } catch (error) {
      console.error("[fomo-maintenance] payment lifecycle failed", {
        eventId: event.id,
        eventType: event.type,
        error: loggableError(error),
      });
      return NextResponse.json(
        { received: true, paymentLifecycle: "failed" },
        { status: 503 },
      );
    }
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const action = checkoutLifecycleAction(event.type, session.payment_status);
  if (action === "ignore") {
    return NextResponse.json({ received: true });
  }
  try {
    const reservation = await handleReservationLifecycle(action, session);
    if (reservation) {
      return NextResponse.json({ received: true, reservation });
    }
  } catch (error) {
    console.error("[fomo-maintenance] checkout reservation lifecycle failed", {
      eventId: event.id,
      eventType: event.type,
      sessionId: session.id,
      error: loggableError(error),
    });
    return NextResponse.json(
      { received: true, reservation: "failed" },
      { status: 503 },
    );
  }

  // Deployments without durable reservations still acknowledge non-payment
  // lifecycle events; only paid events should proceed to fulfilment.
  if (action !== "fulfill") {
    return NextResponse.json({ received: true });
  }

  if (session.payment_status !== "paid") {
    console.error("[fomo-maintenance] paid Checkout event is not marked paid", {
      eventId: event.id,
      eventType: event.type,
      sessionId: session.id,
      paymentStatus: session.payment_status,
    });
    return NextResponse.json(
      { received: true, fulfillment: "payment_not_paid" },
      { status: 503 },
    );
  }

  if (bookingPortalEnabled()) {
    try {
      const result = await handleDurablePaidCheckout(event, session);
      if (result.status === "busy" || result.status === "failed") {
        return NextResponse.json(
          { received: true, fulfillment: result.status },
          { status: 503 },
        );
      }
      return NextResponse.json({ received: true, fulfillment: result.status });
    } catch (error) {
      console.error("[fomo-maintenance] durable fulfilment failed", {
        eventId: event.id,
        sessionId: session.id,
        error: loggableError(error),
      });
      return NextResponse.json(
        { received: true, fulfillment: "failed" },
        { status: 503 },
      );
    }
  }

  if (checkoutReservationsEnabled()) {
    try {
      await confirmCheckoutSlotWithoutBooking(session.id);
    } catch (error) {
      console.error("[fomo-maintenance] paid slot confirmation failed", {
        eventId: event.id,
        eventType: event.type,
        sessionId: session.id,
        error: loggableError(error),
      });
      return NextResponse.json(
        { received: true, reservation: "failed" },
        { status: 503 },
      );
    }
  }

  const result = await handlePaidCheckout(session);
  if (result.calendar === "failed") {
    return NextResponse.json(
      { received: true, ...result },
      { status: 502 },
    );
  }
  return NextResponse.json({ received: true, ...result });
}
