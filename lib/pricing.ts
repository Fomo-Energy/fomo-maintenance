export const INSTALLERS = [
  { id: "fomo", label: "FOMO-installed" },
  { id: "other", label: "Other installer" },
  { id: "rto", label: "FOMO rent-to-own" },
] as const;

export const SERVICE_LEVELS = [
  { id: "essential", label: "Essential Health Check" },
  { id: "electrical_assurance", label: "Electrical Assurance" },
] as const;

export type InstallerId = (typeof INSTALLERS)[number]["id"];
export type ServiceLevel = (typeof SERVICE_LEVELS)[number]["id"];
export type ServiceCode =
  | "ESSENTIAL"
  | "ELECTRICAL_ASSURANCE"
  | "ESSENTIAL_CLEAN"
  | "ELECTRICAL_CLEAN";

export type QuoteInput = {
  kwp: number;
  installer: InstallerId;
  serviceLevel: ServiceLevel;
  cleaning: boolean;
  monitoring: boolean;
};

export type QuoteResult = {
  kwp: number;
  installer: InstallerId;
  serviceLevel: ServiceLevel;
  serviceCode: ServiceCode;
  packageName: string;
  essentialSgd: number;
  electricalUpgradeSgd: number;
  servicePackageSgd: number;
  cleaningSgd: number;
  monitoringSgd: number;
  totalSgd: number;
  monitoringEligible: boolean;
  sellable: boolean;
  cleaningApplied: boolean;
  monitoringApplied: boolean;
  scope: string[];
  exclusions: string[];
};

const ESSENTIAL_MINIMUM_SGD = 199;
const ESSENTIAL_FIXED_SGD = 149;
const ESSENTIAL_PER_KWP_SGD = 5;
const ELECTRICAL_FIXED_SGD = 150;
const ELECTRICAL_PER_KWP_SGD = 5;
const CLEANING_MINIMUM_SGD = 450;
const CLEANING_FIXED_SGD = 390;
const CLEANING_PER_KWP_SGD = 6;
export const MONITORING_SGD = 120;

/** Every displayed and charged line item is rounded to the nearest whole SGD. */
export function roundSgd(amount: number): number {
  return Math.round(amount);
}

function normalizedKwp(kwp: number): number {
  return Number.isFinite(kwp) ? Math.max(0, kwp) : 0;
}

export function essentialPriceSgd(kwp: number): number {
  const size = normalizedKwp(kwp);
  return roundSgd(
    Math.max(
      ESSENTIAL_MINIMUM_SGD,
      ESSENTIAL_FIXED_SGD + ESSENTIAL_PER_KWP_SGD * size,
    ),
  );
}

export function electricalUpgradePriceSgd(kwp: number): number {
  const size = normalizedKwp(kwp);
  return roundSgd(ELECTRICAL_FIXED_SGD + ELECTRICAL_PER_KWP_SGD * size);
}

export function cleaningPriceSgd(kwp: number): number {
  const size = normalizedKwp(kwp);
  return roundSgd(
    Math.max(
      CLEANING_MINIMUM_SGD,
      CLEANING_FIXED_SGD + CLEANING_PER_KWP_SGD * size,
    ),
  );
}

function serviceCodeFor(
  serviceLevel: ServiceLevel,
  cleaning: boolean,
): ServiceCode {
  if (serviceLevel === "electrical_assurance") {
    return cleaning ? "ELECTRICAL_CLEAN" : "ELECTRICAL_ASSURANCE";
  }
  return cleaning ? "ESSENTIAL_CLEAN" : "ESSENTIAL";
}

export function quote(input: QuoteInput): QuoteResult {
  const size = normalizedKwp(input.kwp);
  const sellable = input.installer !== "rto";
  const monitoringEligible = input.installer === "fomo";
  const electricalApplied =
    sellable && input.serviceLevel === "electrical_assurance";
  const cleaningApplied = sellable && input.cleaning;
  const monitoringApplied = sellable && monitoringEligible && input.monitoring;
  const essentialSgd = essentialPriceSgd(size);
  const electricalUpgradeSgd = electricalApplied
    ? electricalUpgradePriceSgd(size)
    : 0;
  const servicePackageSgd = essentialSgd + electricalUpgradeSgd;
  const cleaningSgd = cleaningApplied ? cleaningPriceSgd(size) : 0;
  const monitoringSgd = monitoringApplied ? MONITORING_SGD : 0;
  const packageName = electricalApplied
    ? "Electrical Assurance"
    : "Essential Health Check";

  const scope = [
    "Inverter and fault-log review",
    "Accessible electrical checks",
    "Generation sanity check",
    "Remote pre-check when available",
    "Digital maintenance report",
  ];
  if (electricalApplied) {
    scope.push(
      "Deeper DC-side safety and performance testing using professional solar testing equipment",
    );
  }
  if (cleaningApplied) {
    scope.push("Full panel cleaning, subject to confirmed safe roof access");
  }
  if (monitoringApplied) {
    scope.push(
      "Continuous monitoring for one year, subject to compatibility confirmation",
    );
  }

  const exclusions = ["Repairs and replacement parts"];
  if (!electricalApplied) {
    exclusions.push("Deeper DC-side testing");
  }
  if (!cleaningApplied) {
    exclusions.push("Roof access and panel cleaning");
  } else {
    exclusions.push("Roof work until safe access is confirmed");
  }

  return {
    kwp: input.kwp,
    installer: input.installer,
    serviceLevel: input.serviceLevel,
    serviceCode: serviceCodeFor(input.serviceLevel, cleaningApplied),
    packageName,
    essentialSgd,
    electricalUpgradeSgd,
    servicePackageSgd,
    cleaningSgd,
    monitoringSgd,
    totalSgd: servicePackageSgd + cleaningSgd + monitoringSgd,
    monitoringEligible,
    sellable,
    cleaningApplied,
    monitoringApplied,
    scope,
    exclusions,
  };
}

export function formatSgd(amount: number): string {
  return `S$${roundSgd(amount).toLocaleString("en-SG")}`;
}

export function quoteTotalSgd(options: {
  kwp: number;
  serviceLevel?: ServiceLevel;
  cleaning?: boolean;
  monitoring?: boolean;
  installer?: InstallerId;
}): number {
  return quote({
    kwp: options.kwp,
    installer: options.installer ?? "fomo",
    serviceLevel: options.serviceLevel ?? "essential",
    cleaning: Boolean(options.cleaning),
    monitoring: Boolean(options.monitoring),
  }).totalSgd;
}
