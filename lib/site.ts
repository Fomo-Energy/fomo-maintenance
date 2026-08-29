export function withBasePath(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  if (!path.startsWith("/")) {
    return `${base}/${path}`;
  }
  return `${base}${path}`;
}

function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

export const SITE_NAME = "Fomo Maintenance";
export const SITE_TAGLINE =
  "FOMO Energy’s annual operations and maintenance program in Singapore.";
export const SITE_URL = resolveSiteUrl();
export const QUOTE_EMAIL = "hello@fomomaintenance.com";
export const FOMO_ENERGY_URL = "https://fomo.energy/";
export const FOMO_ENERGY_CONTACT = "https://fomo.energy/contact/";
export const TIMEZONE = "Asia/Singapore";
