export function bookingPortalEnabled(): boolean {
  return process.env.BOOKING_PORTAL_ENABLED?.trim() === "1";
}

export function manageLinkSecret(): string {
  const secret = process.env.MANAGE_LINK_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("MANAGE_LINK_SECRET must contain at least 32 bytes.");
  }
  return secret;
}
