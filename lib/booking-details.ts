export type SavedBookingDetails = {
  name: string;
  phone: string;
  email: string;
  address: string;
};

export const BOOKING_DETAILS_STORAGE_KEY =
  "fomo-maintenance.booking-details.v1";

const FIELD_LIMITS: Record<keyof SavedBookingDetails, number> = {
  name: 120,
  phone: 32,
  email: 254,
  address: 500,
};

function boundedString(value: unknown, maximumLength: number): string {
  return typeof value === "string" ? value.slice(0, maximumLength) : "";
}

export function hasSavedBookingDetails(details: SavedBookingDetails): boolean {
  return Object.values(details).some((value) => value.trim().length > 0);
}

export function parseSavedBookingDetails(
  storedValue: string | null,
): SavedBookingDetails | null {
  if (!storedValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(storedValue) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    const details: SavedBookingDetails = {
      name: boundedString(record.name, FIELD_LIMITS.name),
      phone: boundedString(record.phone, FIELD_LIMITS.phone),
      email: boundedString(record.email, FIELD_LIMITS.email),
      address: boundedString(record.address, FIELD_LIMITS.address),
    };

    return hasSavedBookingDetails(details) ? details : null;
  } catch {
    return null;
  }
}

export function serializeBookingDetails(details: SavedBookingDetails): string {
  return JSON.stringify(details);
}
