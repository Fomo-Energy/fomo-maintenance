import {
  quote,
  type InstallerId,
  type QuoteResult,
} from "@/lib/pricing";

export type CheckoutRequest = {
  kwp: number;
  installer: InstallerId;
  roofAccess: boolean;
  advancedPreventive: boolean;
  monitoring: boolean;
  name: string;
  phone: string;
  email: string;
  address: string;
  slotStart: string;
  slotEnd: string;
};

const INSTALLERS: InstallerId[] = ["fomo", "other", "rto"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

function asNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    return Number.parseFloat(value);
  }
  return Number.NaN;
}

export function extrasMetadata(input: {
  advancedPreventive: boolean;
  monitoring: boolean;
  roofAccess: boolean;
}): string {
  return [
    `advancedPreventive=${input.advancedPreventive ? "1" : "0"}`,
    `monitoring=${input.monitoring ? "1" : "0"}`,
    `roofAccess=${input.roofAccess ? "1" : "0"}`,
  ].join(";");
}

export function sgdToCents(amountSgd: number): number {
  return Math.round(amountSgd * 100);
}

export function parseCheckoutRequest(body: unknown): CheckoutRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid booking details.");
  }
  const raw = body as Record<string, unknown>;
  const installer = asString(raw.installer) as InstallerId;
  if (!INSTALLERS.includes(installer)) {
    throw new Error("Choose who installed the system.");
  }

  const name = asString(raw.name);
  const phone = asString(raw.phone);
  const email = asString(raw.email).toLowerCase();
  const address = asString(raw.address);
  const slotStart = asString(raw.slotStart);
  const slotEnd = asString(raw.slotEnd);
  const kwp = asNumber(raw.kwp);

  if (!Number.isFinite(kwp) || kwp <= 0 || kwp > 10000) {
    throw new Error("Enter a system size in kWp.");
  }
  if (name.length < 1 || name.length > 120) {
    throw new Error("Enter a name.");
  }
  if (phone.replace(/\s/g, "").length < 8 || phone.length > 32) {
    throw new Error("Enter a phone number.");
  }
  if (!EMAIL_RE.test(email)) {
    throw new Error("Enter an email address.");
  }
  if (address.length < 5 || address.length > 500) {
    throw new Error("Enter the site address for the visit.");
  }
  if (!slotStart || !slotEnd) {
    throw new Error("Choose a visit time.");
  }

  return {
    kwp,
    installer,
    roofAccess: asBoolean(raw.roofAccess),
    advancedPreventive: asBoolean(raw.advancedPreventive),
    monitoring: asBoolean(raw.monitoring),
    name,
    phone,
    email,
    address,
    slotStart,
    slotEnd,
  };
}

export function quoteForCheckout(input: CheckoutRequest): QuoteResult {
  return quote({
    kwp: input.kwp,
    installer: input.installer,
    roofAccess: input.roofAccess,
    advancedPreventive: input.advancedPreventive,
    monitoring: input.monitoring,
  });
}

export function scopeSummary(result: QuoteResult): string {
  return result.scope.join(", ");
}
