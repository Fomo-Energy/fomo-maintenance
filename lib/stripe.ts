import Stripe from "stripe";
import { SITE_URL } from "@/lib/site";

let stripeClient: Stripe | undefined;

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

export function publicSiteUrl(): string {
  return SITE_URL.replace(/\/$/, "");
}
