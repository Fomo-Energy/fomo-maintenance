export type CalendarSummary = {
  id?: string;
  name?: string;
};

function normalizedName(value: string): string {
  return value.trim().toLocaleLowerCase("en-SG");
}

export function calendarIdMatchingName(
  calendars: CalendarSummary[],
  requestedName: string,
): string {
  const target = normalizedName(requestedName);
  const matches = calendars.filter(
    (calendar) =>
      Boolean(calendar.id) && normalizedName(calendar.name ?? "") === target,
  );

  if (matches.length === 0) {
    throw new Error(
      `Microsoft calendar "${requestedName}" was not found. Create it under the configured mailbox or set MICROSOFT_MAINTENANCE_CALENDAR_ID.`,
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `More than one Microsoft calendar is named "${requestedName}". Set MICROSOFT_MAINTENANCE_CALENDAR_ID to select one explicitly.`,
    );
  }

  return matches[0].id as string;
}
