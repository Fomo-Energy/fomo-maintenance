import { NextResponse } from "next/server";
import {
  extrasMetadata,
  parseCheckoutRequest,
  quoteForCheckout,
  scopeSummary,
  sgdToCents,
} from "@/lib/booking";
import { formatSgd } from "@/lib/pricing";
import { listBusyPeriods } from "@/lib/microsoft";
import { getStripe, publicSiteUrl } from "@/lib/stripe";
import { findCandidateSlot, slotIsFree } from "@/lib/slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid booking details." }, { status: 400 });
  }

  let parsed;
  try {
    parsed = parseCheckoutRequest(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid booking details.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (parsed.installer === "rto") {
    return NextResponse.json(
      {
        error:
          "Rent-to-own already includes maintenance. Contact FOMO Energy support instead of paying here.",
      },
      { status: 400 },
    );
  }

  const quoted = quoteForCheckout(parsed);
  if (!quoted.sellable) {
    return NextResponse.json(
      { error: "This plan is not available for checkout." },
      { status: 400 },
    );
  }

  const amountCents = sgdToCents(quoted.totalSgd);
  if (amountCents < 50) {
    return NextResponse.json(
      { error: "Enter a system size so the annual figure is above the minimum charge." },
      { status: 400 },
    );
  }

  const slot = findCandidateSlot(parsed.slotStart, parsed.slotEnd);
  if (!slot) {
    return NextResponse.json(
      { error: "That visit time is not available. Choose another slot." },
      { status: 409 },
    );
  }

  try {
    const busy = await listBusyPeriods(new Date(slot.start), new Date(slot.end));
    if (!slotIsFree(slot, busy)) {
      return NextResponse.json(
        { error: "That visit time was just taken. Choose another slot." },
        { status: 409 },
      );
    }
  } catch (error) {
    console.error("[fomo-maintenance] checkout availability check failed", error);
    return NextResponse.json(
      { error: "Visit times could not be confirmed. Try again shortly." },
      { status: 503 },
    );
  }

  const site = publicSiteUrl();
  const productName = quoted.indicative
    ? "Fomo Maintenance site-check visit"
    : "Fomo Maintenance annual program";
  const description = quoted.indicative
    ? `${quoted.kwp} kWp · indicative until site check · ${slot.timeLabel} SGT`
    : `${quoted.kwp} kWp · ${slot.timeLabel} SGT`;

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      currency: "sgd",
      adaptive_pricing: { enabled: false },
      customer_email: parsed.email,
      success_url: `${site}/book/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/book/cancel`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "sgd",
            unit_amount: amountCents,
            product_data: {
              name: productName,
              description,
            },
          },
        },
      ],
      metadata: {
        kwp: String(quoted.kwp),
        installer: quoted.installer,
        extras: extrasMetadata(parsed),
        name: parsed.name,
        phone: parsed.phone,
        email: parsed.email,
        address: parsed.address,
        slotStart: slot.start,
        slotEnd: slot.end,
        amount: String(amountCents),
        scope: scopeSummary(quoted).slice(0, 450),
        indicative: quoted.indicative ? "1" : "0",
        amountSgd: formatSgd(quoted.totalSgd),
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Checkout could not start. Try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ url: session.url, id: session.id });
  } catch (error) {
    console.error("[fomo-maintenance] Stripe checkout failed", error);
    return NextResponse.json(
      { error: "Payment could not be started. Try again, or email hello@fomomaintenance.com." },
      { status: 502 },
    );
  }
}
