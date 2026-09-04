import type { InstallerId } from "@/lib/pricing";

const INSTALLER_NAME_MAX_LENGTH = 120;
const INSTALLER_NAME_CONTENT_RE = /[\p{L}\p{N}]/u;

/** Normalize customer-entered installer names before validation or persistence. */
export function normalizeInstallerName(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function validInstallerName(value: string): boolean {
  return (
    value.length >= 1 &&
    value.length <= INSTALLER_NAME_MAX_LENGTH &&
    INSTALLER_NAME_CONTENT_RE.test(value)
  );
}

export function installerNameForSelection(
  installer: InstallerId,
  value: unknown,
): string | null {
  if (installer !== "other") {
    return null;
  }

  const installerName = normalizeInstallerName(value);
  if (!validInstallerName(installerName)) {
    throw new Error("Enter the name of the third-party installer.");
  }
  return installerName;
}

/** Provide one customer-safe installer label across all booking surfaces. */
export function formatInstaller(
  installer: string | null | undefined,
  installerName?: string | null,
): string {
  if (installer === "fomo") {
    return "FOMO-installed";
  }
  if (installer === "rto") {
    return "FOMO rent-to-own";
  }
  if (installer === "other") {
    const normalizedName = normalizeInstallerName(installerName);
    return validInstallerName(normalizedName)
      ? `3rd party — ${normalizedName}`
      : "3rd party (name not recorded)";
  }
  return "Not recorded";
}
