import { NextResponse } from "next/server";
import {
  exclusionsSummary,
  extrasMetadata,
  parseCheckoutRequest,
  priceBreakdown,
  priceLineItems,
  quoteForCheckout,
  scopeSummary,
  sgdToCents,
} from "@/lib/booking";
import { formatSgd } from "@/lib/pricing";
import { listBusyPeriods } from "@/lib/microsoft";
import {
  getStripe,
  publicSiteUrl,
  stripeGstTaxRateId,
} from "@/lib/stripe";
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

  const subtotalCents = sgdToCents(quoted.subtotalSgd);
  const gstCents = sgdToCents(quoted.gstSgd);
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
  const description = quoted.testingApplied
    ? `Testing only · no service offered · ${slot.timeLabel} SGT`
    : `${quoted.kwp} kWp · ${slot.timeLabel} SGT`;
  try {
    const stripe = getStripe();
    const gstTaxRateId = stripeGstTaxRateId();
    const lineItems = priceLineItems(quoted).map((item) => ({
      quantity: 1,
      tax_rates: [gstTaxRateId],
      price_data: {
        currency: "sgd" as const,
        unit_amount: sgdToCents(item.amountSgd),
        product_data: {
          name: item.name,
          description,
        },
      },
    }));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "sgd",
      adaptive_pricing: { enabled: false },
      customer_email: parsed.email,
      success_url: `${site}/book/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/book/cancel`,
      line_items: lineItems,
      metadata: {
        pricingVersion: "packages-v3-gst",
        kwp: String(quoted.kwp),
        installer: quoted.installer,
        serviceCode: quoted.serviceCode,
        serviceLevel: quoted.serviceLevel,
        package: quoted.packageName,
        breakdown: priceBreakdown(quoted).slice(0, 500),
        extras: extrasMetadata(parsed),
        name: parsed.name,
        phone: parsed.phone,
        email: parsed.email,
        address: parsed.address,
        slotStart: slot.start,
        slotEnd: slot.end,
        amount: String(amountCents),
        subtotalSgd: formatSgd(quoted.subtotalSgd),
        gstRatePercent: "9",
        gstSgd: formatSgd(quoted.gstSgd),
        scope: scopeSummary(quoted).slice(0, 500),
        exclusions: exclusionsSummary(quoted).slice(0, 500),
        cleaning: quoted.cleaningApplied ? "1" : "0",
        cleaningAccessStatus: quoted.cleaningApplied
          ? "pending_confirmation"
          : "not_requested",
        monitoring: "0",
        monitoringCompatibilityStatus: "not_requested",
        testing: quoted.testingApplied ? "1" : "0",
        fulfillmentStatus: quoted.testingApplied
          ? "no_service_offered"
          : "service_booked",
        amountSgd: formatSgd(quoted.totalSgd),
      },
    });

    if (
      session.amount_subtotal !== subtotalCents ||
      session.total_details?.amount_tax !== gstCents ||
      session.amount_total !== amountCents
    ) {
      console.error("[fomo-maintenance] Stripe GST total mismatch", {
        sessionId: session.id,
        expectedSubtotal: subtotalCents,
        actualSubtotal: session.amount_subtotal,
        expectedGst: gstCents,
        actualGst: session.total_details?.amount_tax,
        expectedTotal: amountCents,
        actualTotal: session.amount_total,
      });
      try {
        await stripe.checkout.sessions.expire(session.id);
      } catch (expireError) {
        console.error(
          "[fomo-maintenance] Could not expire mismatched Stripe session",
          {
            sessionId: session.id,
            error:
              expireError instanceof Error
                ? expireError.message
                : "Unknown Stripe error",
          },
        );
      }
      return NextResponse.json(
        { error: "Payment total could not be verified. Try again shortly." },
        { status: 502 },
      );
    }

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
