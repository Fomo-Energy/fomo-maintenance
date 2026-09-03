export const MANAGE_COOKIE_NAME = "fomo_manage";

export function bookingPortalEnabled(): boolean {
  return process.env.BOOKING_PORTAL_ENABLED?.trim() === "1";
}

export function checkoutReservationsEnabled(): boolean {
  return (
    bookingPortalEnabled() ||
    process.env.CHECKOUT_RESERVATIONS_ENABLED?.trim() === "1"
  );
}

export function apiRateLimitingEnabled(): boolean {
  return process.env.API_RATE_LIMITING_ENABLED?.trim() === "1";
}

export function rateLimitHashSecret(): string {
  const secret = process.env.RATE_LIMIT_HASH_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("RATE_LIMIT_HASH_SECRET must contain at least 32 bytes.");
  }
  return secret;
}

export function blobStorageIsConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export function documentUploadsEnabled(): boolean {
  return process.env.DOCUMENT_UPLOADS_ENABLED?.trim() === "1";
}

export function reschedulingEnabled(): boolean {
  return process.env.RESCHEDULING_ENABLED?.trim() === "1";
}

export function transactionalEmailEnabled(): boolean {
  return process.env.TRANSACTIONAL_EMAIL_ENABLED?.trim() === "1";
}

export function paymentLifecycleEnabled(): boolean {
  return process.env.PAYMENT_LIFECYCLE_ENABLED?.trim() === "1";
}

export function manageLinkSecret(): string {
  const secret = process.env.MANAGE_LINK_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("MANAGE_LINK_SECRET must contain at least 32 bytes.");
  }
  return secret;
}
