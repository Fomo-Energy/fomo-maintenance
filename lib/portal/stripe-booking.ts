import { createHash } from "node:crypto";
import type Stripe from "stripe";
import type { PaidBookingInput } from "@/lib/portal/bookings";
import type { MaintenanceVisitInput } from "@/lib/microsoft";
import {
  normalizeInstallerName,
  validInstallerName,
} from "@/lib/installer";

export class PermanentFulfillmentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PermanentFulfillmentError";
  }
}

function metadata(session: Stripe.Checkout.Session, key: string): string {
  return session.metadata?.[key]?.trim() || "";
}

function requiredMetadata(
  session: Stripe.Checkout.Session,
  key: string,
): string {
  const value = metadata(session, key);
  if (!value) {
    throw new PermanentFulfillmentError(
      "missing_booking_metadata",
      `Checkout Session is missing ${key}.`,
    );
  }
  return value;
}

function referenceFor(sessionId: string, paidAt: Date): string {
  const date = paidAt.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = createHash("sha256")
    .update(sessionId)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();
  return `FM-${date}-${suffix}`;
}

function paymentIntentId(session: Stripe.Checkout.Session): string | null {
  if (typeof session.payment_intent === "string") {
    return session.payment_intent;
  }
  return session.payment_intent?.id || null;
}

function money(session: Stripe.Checkout.Session) {
  const subtotalCents = session.amount_subtotal;
  const gstCents = session.total_details?.amount_tax;
  const totalCents = session.amount_total;
  if (
    typeof subtotalCents !== "number" ||
    typeof gstCents !== "number" ||
    typeof totalCents !== "number" ||
    !Number.isInteger(subtotalCents) ||
    !Number.isInteger(gstCents) ||
    !Number.isInteger(totalCents) ||
    subtotalCents < 0 ||
    gstCents < 0 ||
    totalCents <= 0 ||
    subtotalCents + gstCents !== totalCents
  ) {
    throw new PermanentFulfillmentError(
      "invalid_payment_amounts",
      "Stripe payment amounts are incomplete or inconsistent.",
    );
  }
  return { subtotalCents, gstCents, totalCents };
}

export function paidBookingFromSession(
  session: Stripe.Checkout.Session,
  paidAt: Date,
): PaidBookingInput {
  if (session.payment_status !== "paid") {
    throw new PermanentFulfillmentError(
      "payment_not_paid",
      "Checkout Session is not paid.",
    );
  }
  if (session.currency?.toLowerCase() !== "sgd") {
    throw new PermanentFulfillmentError(
      "unsupported_currency",
      "Checkout Session currency is not SGD.",
    );
  }
  const installerType = requiredMetadata(session, "installer");
  if (installerType === "rto") {
    throw new PermanentFulfillmentError(
      "rto_not_sellable",
      "A paid rent-to-own Checkout Session requires manual review.",
    );
  }
  if (installerType !== "fomo" && installerType !== "other") {
    throw new PermanentFulfillmentError(
      "invalid_installer",
      "Checkout Session has an unsupported installer.",
    );
  }

  const slotStart = new Date(requiredMetadata(session, "slotStart"));
  const slotEnd = new Date(requiredMetadata(session, "slotEnd"));
  if (
    Number.isNaN(slotStart.getTime()) ||
    Number.isNaN(slotEnd.getTime()) ||
    slotEnd <= slotStart
  ) {
    throw new PermanentFulfillmentError(
      "invalid_booking_slot",
      "Checkout Session has an invalid booking slot.",
    );
  }

  const kwpRaw = metadata(session, "kwp");
  const kwp = Number(kwpRaw);
  const customerEmail =
    metadata(session, "email") ||
    session.customer_details?.email?.trim() ||
    session.customer_email?.trim() ||
    "";
  if (!customerEmail) {
    throw new PermanentFulfillmentError(
      "missing_customer_email",
      "Checkout Session has no customer email.",
    );
  }

  const amounts = money(session);
  const candidateInstallerName = normalizeInstallerName(
    metadata(session, "installerName"),
  );
  const installerName =
    installerType === "other" && validInstallerName(candidateInstallerName)
      ? candidateInstallerName
      : null;
  return {
    reference: referenceFor(session.id, paidAt),
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId(session),
    customerName: requiredMetadata(session, "name"),
    customerEmail,
    customerPhone: requiredMetadata(session, "phone"),
    siteAddress: requiredMetadata(session, "address"),
    installerType,
    installerName,
    serviceCode: metadata(session, "serviceCode") || "LEGACY",
    packageName:
      metadata(session, "package") ||
      metadata(session, "serviceLevel") ||
      "Fomo Maintenance visit",
    kwp: Number.isFinite(kwp) && kwp >= 0 ? kwp.toFixed(3) : null,
    ...amounts,
    slotStart,
    slotEnd,
    paidAt,
    ...(metadata(session, "checkoutRequestKey")
      ? { checkoutRequestKey: metadata(session, "checkoutRequestKey") }
      : {}),
  };
}

export function maintenanceVisitFromSession(
  session: Stripe.Checkout.Session,
): MaintenanceVisitInput {
  const amount = typeof session.amount_total === "number"
    ? `S$${(session.amount_total / 100).toFixed(2)}`
    : metadata(session, "amountSgd") || "unknown";
  return {
    sessionId: session.id,
    address: requiredMetadata(session, "address"),
    email:
      metadata(session, "email") ||
      session.customer_details?.email?.trim() ||
      session.customer_email?.trim() ||
      "",
    name: requiredMetadata(session, "name"),
    phone: requiredMetadata(session, "phone"),
    slotStart: requiredMetadata(session, "slotStart"),
    slotEnd: requiredMetadata(session, "slotEnd"),
    kwp: metadata(session, "kwp"),
    installer: metadata(session, "installer"),
    installerName: metadata(session, "installerName"),
    serviceCode: metadata(session, "serviceCode"),
    packageName: metadata(session, "package"),
    breakdown: metadata(session, "breakdown"),
    extras: metadata(session, "extras"),
    amountPaidSgd: amount,
    scope: metadata(session, "scope"),
    exclusions: metadata(session, "exclusions"),
    cleaningAccessStatus: metadata(session, "cleaningAccessStatus"),
    monitoringCompatibilityStatus: metadata(
      session,
      "monitoringCompatibilityStatus",
    ),
    indicative: metadata(session, "indicative") === "1",
  };
}
