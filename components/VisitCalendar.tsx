"use client";

import type { VisitSlot } from "@/lib/slots";
import {
  WEEKDAY_HEADERS,
  addYearMonths,
  formatYearMonthLabel,
  isWeekdayDate,
  monthCells,
  yearMonthFromDateKey,
} from "@/lib/slots";

type VisitCalendarProps = {
  slots: VisitSlot[];
  selectedDateKey: string | null;
  onSelectDate: (dateKey: string) => void;
  visibleMonth: string;
  onVisibleMonthChange: (yearMonth: string) => void;
};

function friendlyDate(dateKey: string): string {
  return new Intl.DateTimeFormat("en-SG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Singapore",
  }).format(new Date(`${dateKey}T12:00:00+08:00`));
}

export function VisitCalendar({
  slots,
  selectedDateKey,
  onSelectDate,
  visibleMonth,
  onVisibleMonthChange,
}: VisitCalendarProps) {
  const bookableDates = new Set(slots.map((slot) => slot.dateKey));
  const minMonth = slots[0]
    ? yearMonthFromDateKey(slots[0].dateKey)
    : visibleMonth;
  const maxMonth = slots.at(-1)
    ? yearMonthFromDateKey(slots[slots.length - 1].dateKey)
    : visibleMonth;
  const cells = monthCells(visibleMonth);
  const canPrev = visibleMonth > minMonth;
  const canNext = visibleMonth < maxMonth;

  return (
    <div className="overflow-x-auto rounded-2xl border border-orange-100 bg-peach/50 p-2 sm:p-3">
      <div className="mb-2 flex min-w-[20rem] items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous month"
          disabled={!canPrev}
          onClick={() => onVisibleMonthChange(addYearMonths(visibleMonth, -1))}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink outline-none ring-brand focus:ring-2 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          ‹
        </button>
        <p className="text-sm font-bold text-ink" role="status" aria-live="polite">
          {formatYearMonthLabel(visibleMonth)}
        </p>
        <button
          type="button"
          aria-label="Next month"
          disabled={!canNext}
          onClick={() => onVisibleMonthChange(addYearMonths(visibleMonth, 1))}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink outline-none ring-brand focus:ring-2 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          ›
        </button>
      </div>
      <div className="grid min-w-[20rem] grid-cols-7 gap-0.5 text-center sm:gap-1">
        {WEEKDAY_HEADERS.map((label) => (
          <div
            key={label}
            className="py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500"
          >
            {label}
          </div>
        ))}
        {cells.map((cell) => {
          const bookable =
            cell.inMonth &&
            isWeekdayDate(cell.dateKey) &&
            bookableDates.has(cell.dateKey);
          const selected = selectedDateKey === cell.dateKey;
          const dateLabel = friendlyDate(cell.dateKey);
          return (
            <button
              key={cell.dateKey}
              type="button"
              disabled={!bookable}
              aria-pressed={selected}
              aria-label={`${dateLabel}, ${
                selected ? "selected" : bookable ? "available" : "unavailable"
              }`}
              onClick={() => onSelectDate(cell.dateKey)}
              className={`h-11 min-w-0 rounded-lg text-sm font-semibold outline-none ring-brand focus:ring-2 ${
                selected
                  ? "bg-brand text-ink"
                  : bookable
                    ? "text-ink hover:bg-white"
                    : "cursor-not-allowed text-slate-300"
              }`}
            >
              {Number(cell.dateKey.slice(8, 10))}
            </button>
          );
        })}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {selectedDateKey
          ? `${friendlyDate(selectedDateKey)} selected.`
          : "No visit date selected."}
      </p>
    </div>
  );
}
