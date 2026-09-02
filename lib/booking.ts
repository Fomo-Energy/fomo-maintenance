import {
  quote,
  type InstallerId,
  type QuoteResult,
  type ServiceLevel,
} from "@/lib/pricing";

export type CheckoutRequest = {
  kwp: number;
  installer: InstallerId;
  serviceLevel: ServiceLevel;
  cleaning: boolean;
  testing: boolean;
  name: string;
  phone: string;
  email: string;
  address: string;
  slotStart: string;
  slotEnd: string;
};

const INSTALLERS: InstallerId[] = ["fomo", "other", "rto"];
const SERVICE_LEVELS: ServiceLevel[] = ["essential", "electrical_assurance"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asSingleLineString(value: unknown): string {
  return asString(value)
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

function asNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const normalized = value.trim();
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
      return Number.NaN;
    }
    return Number(normalized);
  }
  return Number.NaN;
}

export function extrasMetadata(input: {
  serviceLevel: ServiceLevel;
  cleaning: boolean;
  testing: boolean;
}): string {
  return [
    `serviceLevel=${input.serviceLevel}`,
    `cleaning=${input.cleaning ? "1" : "0"}`,
    `testing=${input.testing ? "1" : "0"}`,
  ].join(";");
}

export function priceBreakdown(result: QuoteResult): string {
  if (result.testingApplied) {
    return `Testing=${result.testingSgd.toFixed(2)}; Subtotal=${result.subtotalSgd.toFixed(2)}; GST (9%)=${result.gstSgd.toFixed(2)}; Total incl. GST=${result.totalSgd.toFixed(2)}`;
  }
  const parts = [`Essential=${result.essentialSgd}`];
  if (result.electricalUpgradeSgd) {
    parts.push(`Electrical upgrade=${result.electricalUpgradeSgd}`);
  }
  if (result.cleaningSgd) {
    parts.push(`Cleaning=${result.cleaningSgd}`);
  }
  parts.push(`Subtotal=${result.subtotalSgd.toFixed(2)}`);
  parts.push(`GST (9%)=${result.gstSgd.toFixed(2)}`);
  parts.push(`Total incl. GST=${result.totalSgd.toFixed(2)}`);
  return parts.join("; ");
}

export type PriceLineItem = {
  name: string;
  amountSgd: number;
};

export function priceLineItems(result: QuoteResult): PriceLineItem[] {
  if (result.testingApplied) {
    return [
      {
        name: "Testing — no service offered",
        amountSgd: result.testingSgd,
      },
    ];
  }
  const items: PriceLineItem[] = [
    { name: "Essential Health Check", amountSgd: result.essentialSgd },
  ];
  if (result.electricalUpgradeSgd) {
    items.push({
      name: "Electrical Assurance upgrade",
      amountSgd: result.electricalUpgradeSgd,
    });
  }
  if (result.cleaningSgd) {
    items.push({ name: "Full panel cleaning", amountSgd: result.cleaningSgd });
  }
  return items;
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
  const serviceLevel = asString(raw.serviceLevel) as ServiceLevel;
  if (!SERVICE_LEVELS.includes(serviceLevel)) {
    throw new Error("Choose a service level.");
  }

  const name = asSingleLineString(raw.name);
  const phone = asSingleLineString(raw.phone);
  const email = asSingleLineString(raw.email).toLowerCase();
  const address = asSingleLineString(raw.address);
  const slotStart = asString(raw.slotStart);
  const slotEnd = asString(raw.slotEnd);
  const kwp = asNumber(raw.kwp);
  const cleaning = asBoolean(raw.cleaning);
  const monitoring = asBoolean(raw.monitoring);
  const testing = asBoolean(raw.testing);

  if (!Number.isFinite(kwp) || kwp <= 0 || kwp > 10000) {
    throw new Error("Enter a system size in kWp.");
  }
  if (monitoring) {
    throw new Error("Continuous monitoring is not available for online booking.");
  }
  if (testing && cleaning) {
    throw new Error("Testing cannot be combined with cleaning.");
  }
  if (name.length < 1 || name.length > 120) {
    throw new Error("Enter a name.");
  }
  if (phone.replace(/\s/g, "").length < 8 || phone.length > 32) {
    throw new Error("Enter a phone number.");
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
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
    serviceLevel,
    cleaning,
    testing,
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
    serviceLevel: input.serviceLevel,
    cleaning: input.cleaning,
    testing: input.testing,
  });
}

export function scopeSummary(result: QuoteResult): string {
  return result.scope.join("; ");
}

export function exclusionsSummary(result: QuoteResult): string {
  return result.exclusions.join("; ");
}
