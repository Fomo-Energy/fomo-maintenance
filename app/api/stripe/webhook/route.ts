import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createMaintenanceVisitWithRetry } from "@/lib/microsoft";
import { getStripe, stripeWebhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function meta(session: Stripe.Checkout.Session, key: string): string {
  return session.metadata?.[key]?.trim() || "";
}

function amountPaidLabel(session: Stripe.Checkout.Session): string {
  const fromMeta = meta(session, "amountSgd");
  if (fromMeta) {
    return fromMeta;
  }
  if (typeof session.amount_total === "number") {
    return `S$${(session.amount_total / 100).toLocaleString("en-SG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return "unknown";
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
  if (session.payment_status && session.payment_status !== "paid") {
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
      { sessionId: session.id, metadata: session.metadata },
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
      extras: meta(session, "extras"),
      amountPaidSgd: amountPaidLabel(session),
      scope: meta(session, "scope"),
      indicative: meta(session, "indicative") === "1",
    });
    await markCalendarStatus(session, result);
    return { calendar: result };
  } catch (error) {
    console.error(
      "[fomo-maintenance] Graph calendar create failed after retry",
      {
        sessionId: session.id,
        email,
        address,
        slotStart,
        slotEnd,
        amount: amountPaidLabel(session),
        error,
      },
    );
    await markCalendarStatus(session, "failed");
    return { calendar: "failed" as const };
  }
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
  const result = await handleCheckoutCompleted(session);
  return NextResponse.json({ received: true, ...result });
}
