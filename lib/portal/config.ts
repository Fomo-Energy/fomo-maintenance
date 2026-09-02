export const MANAGE_COOKIE_NAME = "fomo_manage";

export function bookingPortalEnabled(): boolean {
  return process.env.BOOKING_PORTAL_ENABLED?.trim() === "1";
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

export function manageLinkSecret(): string {
  const secret = process.env.MANAGE_LINK_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("MANAGE_LINK_SECRET must contain at least 32 bytes.");
  }
  return secret;
}
