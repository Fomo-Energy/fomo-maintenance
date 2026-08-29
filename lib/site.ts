export function withBasePath(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  if (!path.startsWith("/")) {
    return `${base}/${path}`;
  }
  return `${base}${path}`;
}

export const SITE_NAME = "Fomo Maintenance";
export const SITE_TAGLINE =
  "FOMO Energy’s annual operations and maintenance program in Singapore.";
export const SITE_URL = "https://juliustanch.github.io/fomo-maintenance/";
export const QUOTE_EMAIL = "hello@fomomaintenance.com";
export const FOMO_ENERGY_URL = "https://fomo.energy/";
export const FOMO_ENERGY_CONTACT = "https://fomo.energy/contact/";
