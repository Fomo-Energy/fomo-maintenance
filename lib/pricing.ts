export const INSTALLERS = [
  { id: "fomo", label: "Fomo-installed" },
  { id: "other", label: "Other installer" },
  { id: "rto", label: "FOMO rent-to-own" },
] as const;

export type InstallerId = (typeof INSTALLERS)[number]["id"];

export type QuoteInput = {
  kwp: number;
  installer: InstallerId;
  roofAccess: boolean;
  advancedPreventive: boolean;
  monitoring: boolean;
};

export type QuoteResult = {
  kwp: number;
  installer: InstallerId;
  roofAccess: boolean;
  baseSgd: number;
  advancedSgd: number;
  monitoringSgd: number;
  totalSgd: number;
  monitoringEligible: boolean;
  sellable: boolean;
  indicative: boolean;
  advancedApplied: boolean;
  monitoringApplied: boolean;
  scope: string[];
};

const FIRST_BAND_KWP = 10;
const SECOND_BAND_KWP = 30;
const RATE_FIRST = 40;
const RATE_SECOND = 20;
const RATE_ABOVE = 5;
const ADVANCED_RATE = 0.25;
const MONITORING_RATE = 0.125;

export function roundSgd(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Stepped Condition & Standard annual tariff in SGD. */
export function baseTariffSgd(kwp: number): number {
  const size = Number.isFinite(kwp) ? Math.max(0, kwp) : 0;
  const first = Math.min(size, FIRST_BAND_KWP) * RATE_FIRST;
  const second =
    Math.min(Math.max(size - FIRST_BAND_KWP, 0), SECOND_BAND_KWP) * RATE_SECOND;
  const rest = Math.max(size - (FIRST_BAND_KWP + SECOND_BAND_KWP), 0) * RATE_ABOVE;
  return roundSgd(first + second + rest);
}

export function quote(input: QuoteInput): QuoteResult {
  const baseSgd = baseTariffSgd(input.kwp);
  const sellable = input.installer !== "rto";
  const monitoringEligible = input.installer === "fomo";
  const advancedApplied = sellable && input.advancedPreventive;
  const monitoringApplied = monitoringEligible && input.monitoring;
  const advancedSgd = advancedApplied ? roundSgd(baseSgd * ADVANCED_RATE) : 0;
  const monitoringSgd = monitoringApplied
    ? roundSgd(baseSgd * MONITORING_RATE)
    : 0;

  const scope: string[] = ["Inverter checks"];
  if (input.roofAccess) {
    scope.push("Module checks", "Localised cleaning");
  }
  scope.push("Site tests", "O&M report");
  if (input.installer === "fomo") {
    scope.push("Remote checks");
  }
  if (advancedApplied) {
    scope.push("IR hotspot survey", "DC/AC insulation tests", "Cable thermal checks");
  }
  if (monitoringApplied) {
    scope.push("Monitoring and reporting");
  }

  return {
    kwp: input.kwp,
    installer: input.installer,
    roofAccess: input.roofAccess,
    baseSgd,
    advancedSgd,
    monitoringSgd,
    totalSgd: roundSgd(baseSgd + advancedSgd + monitoringSgd),
    monitoringEligible,
    sellable,
    indicative: input.installer === "other",
    advancedApplied,
    monitoringApplied,
    scope,
  };
}

export function formatSgd(amount: number): string {
  const rounded = roundSgd(amount);
  const isInt = Number.isInteger(rounded);
  return `S$${rounded.toLocaleString("en-SG", {
    minimumFractionDigits: isInt ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function quoteTotalSgd(options: {
  kwp: number;
  advancedPreventive?: boolean;
  monitoring?: boolean;
  installer?: InstallerId;
}): number {
  return quote({
    kwp: options.kwp,
    installer: options.installer ?? "fomo",
    roofAccess: true,
    advancedPreventive: Boolean(options.advancedPreventive),
    monitoring: Boolean(options.monitoring),
  }).totalSgd;
}
