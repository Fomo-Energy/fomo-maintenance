import Stripe from "stripe";
import { SITE_URL } from "@/lib/site";

let stripeClient: Stripe | undefined;
let gstTaxRatePromise: Promise<Stripe.TaxRate> | undefined;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function stripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }
  return secret;
}

export function stripeGstTaxRateId(): string {
  const taxRateId = process.env.STRIPE_GST_TAX_RATE_ID?.trim();
  if (!taxRateId) {
    throw new Error("STRIPE_GST_TAX_RATE_ID is not set");
  }
  return taxRateId;
}

export async function validatedStripeGstTaxRate(): Promise<Stripe.TaxRate> {
  if (!gstTaxRatePromise) {
    gstTaxRatePromise = getStripe().taxRates.retrieve(stripeGstTaxRateId());
  }

  try {
    const taxRate = await gstTaxRatePromise;
    if (
      !taxRate.active ||
      taxRate.inclusive ||
      taxRate.percentage !== 9 ||
      taxRate.country !== "SG"
    ) {
      throw new Error(
        "STRIPE_GST_TAX_RATE_ID must reference an active, exclusive 9% Singapore tax rate",
      );
    }
    return taxRate;
  } catch (error) {
    gstTaxRatePromise = undefined;
    throw error;
  }
}

export function publicSiteUrl(): string {
  return SITE_URL.replace(/\/$/, "");
}
