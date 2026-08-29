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
export const CALENDLY_EVENT_URL = "https://calendly.com/jtan-fomo/new-meeting";
export const FOMO_ENERGY_URL = "https://fomo.energy/";
export const FOMO_ENERGY_CONTACT = "https://fomo.energy/contact/";

export type CalendlyPrefill = {
  name?: string;
  email?: string;
  location?: string;
  phone?: string;
};

export function calendlyEmbedUrl(prefill: CalendlyPrefill = {}): string {
  const params = new URLSearchParams();
  params.set("hide_gdpr_banner", "1");
  params.set("hide_event_type_details", "1");
  const name = prefill.name?.trim();
  const email = prefill.email?.trim();
  const location = prefill.location?.trim();
  const phone = prefill.phone?.trim();
  if (name) {
    params.set("name", name);
  }
  if (email) {
    params.set("email", email);
  }
  if (location) {
    params.set("location", location);
    params.set("a1", location);
  }
  if (phone) {
    params.set("a2", phone);
  }
  return `${CALENDLY_EVENT_URL}?${params.toString()}`;
}
