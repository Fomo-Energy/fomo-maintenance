import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { databaseIsConfigured } from "@/lib/database";
import {
  createMaintenanceVisitRecordWithRetry,
  createMaintenanceVisitWithRetry,
} from "@/lib/microsoft";
import { databaseFulfillmentStore } from "@/lib/portal/bookings";
import {
  bookingPortalEnabled,
  manageLinkSecret,
} from "@/lib/portal/config";
import { fulfillPaidCheckout } from "@/lib/portal/fulfillment";
import { getStripe, stripeWebhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
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
      "[fomo-maintenance] checkout.session.completed missing booking metadata",
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

async function handleDurableCheckoutCompleted(
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

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (bookingPortalEnabled()) {
    try {
      const result = await handleDurableCheckoutCompleted(event, session);
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

  const result = await handleCheckoutCompleted(session);
  if (result.calendar === "failed") {
    return NextResponse.json(
      { received: true, ...result },
      { status: 502 },
    );
  }
  return NextResponse.json({ received: true, ...result });
}
