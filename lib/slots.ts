import { TIMEZONE } from "@/lib/site";

export const SLOT_HOURS = 4;
export const DAY_START_HOUR = 9;
export const DAY_END_HOUR = 17;
export const BOOKING_MONTHS = 3;
export const SLOT_START_HOURS = [9, 13] as const;
export const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type VisitSlot = {
  start: string;
  end: string;
  dateKey: string;
  dayLabel: string;
  timeLabel: string;
};

export type BusyPeriod = {
  start: Date;
  end: Date;
};

export type MonthCell = {
  dateKey: string;
  inMonth: boolean;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Calendar date YYYY-MM-DD in Asia/Singapore. */
export function singaporeDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addCalendarDays(dateKey: string, days: number): string {
  const noon = new Date(`${dateKey}T12:00:00+08:00`);
  noon.setUTCDate(noon.getUTCDate() + days);
  return singaporeDateKey(noon);
}

export function addCalendarMonths(dateKey: string, months: number): string {
  const [year, month, day] = dateKey.split("-").map((part) => Number(part));
  const totalMonths = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  return `${nextYear}-${pad(nextMonth)}-${pad(Math.min(day, lastDay))}`;
}

export function bookingHorizonEnd(now = new Date()): string {
  return addCalendarMonths(singaporeDateKey(now), BOOKING_MONTHS);
}

export function weekdayUtcIndex(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00+08:00`).getUTCDay();
}

export function isWeekdayDate(dateKey: string): boolean {
  const day = weekdayUtcIndex(dateKey);
  return day !== 0 && day !== 6;
}

export function isoSingapore(dateKey: string, hour: number, minute = 0): string {
  return `${dateKey}T${pad(hour)}:${pad(minute)}:00+08:00`;
}

export function formatDayLabel(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00+08:00`).toLocaleDateString("en-SG", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

export function formatTimeLabel(startHour: number): string {
  return `${pad(startHour)}:00–${pad(startHour + SLOT_HOURS)}:00`;
}

export function formatSlotRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const day = start.toLocaleDateString("en-SG", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const startTime = start.toLocaleTimeString("en-SG", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const endTime = end.toLocaleTimeString("en-SG", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${day}, ${startTime}–${endTime} SGT`;
}

export function yearMonthFromDateKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function addYearMonths(yearMonth: string, delta: number): string {
  return addCalendarMonths(`${yearMonth}-01`, delta).slice(0, 7);
}

export function formatYearMonthLabel(yearMonth: string): string {
  return new Date(`${yearMonth}-01T12:00:00+08:00`).toLocaleDateString("en-SG", {
    timeZone: TIMEZONE,
    month: "long",
    year: "numeric",
  });
}

export function monthCells(yearMonth: string): MonthCell[] {
  const first = `${yearMonth}-01`;
  const mondayFirst = (weekdayUtcIndex(first) + 6) % 7;
  const [year, month] = yearMonth.split("-").map((part) => Number(part));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: MonthCell[] = [];

  for (let lead = 0; lead < mondayFirst; lead += 1) {
    cells.push({
      dateKey: addCalendarDays(first, lead - mondayFirst),
      inMonth: false,
    });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      dateKey: `${yearMonth}-${pad(day)}`,
      inMonth: true,
    });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    cells.push({
      dateKey: addCalendarDays(last.dateKey, 1),
      inMonth: false,
    });
  }

  return cells;
}

export function generateCandidateSlots(now = new Date()): VisitSlot[] {
  const todayKey = singaporeDateKey(now);
  const lastKey = bookingHorizonEnd(now);
  const slots: VisitSlot[] = [];

  for (let offset = 0; offset <= 100; offset += 1) {
    const dateKey = addCalendarDays(todayKey, offset);
    if (dateKey > lastKey) {
      break;
    }
    if (!isWeekdayDate(dateKey)) {
      continue;
    }
    for (const hour of SLOT_START_HOURS) {
      const start = isoSingapore(dateKey, hour);
      const end = isoSingapore(dateKey, hour + SLOT_HOURS);
      if (new Date(start).getTime() <= now.getTime()) {
        continue;
      }
      slots.push({
        start,
        end,
        dateKey,
        dayLabel: formatDayLabel(dateKey),
        timeLabel: formatTimeLabel(hour),
      });
    }
  }

  return slots;
}

export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function slotIsFree(slot: VisitSlot, busy: BusyPeriod[]): boolean {
  const start = new Date(slot.start);
  const end = new Date(slot.end);
  return !busy.some((period) => rangesOverlap(start, end, period.start, period.end));
}

export function filterFreeSlots(
  slots: VisitSlot[],
  busy: BusyPeriod[],
): VisitSlot[] {
  return slots.filter((slot) => slotIsFree(slot, busy));
}

export function findCandidateSlot(
  start: string,
  end: string,
  now = new Date(),
): VisitSlot | undefined {
  return generateCandidateSlots(now).find(
    (slot) => slot.start === start && slot.end === end,
  );
}
