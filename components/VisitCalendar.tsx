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

export function VisitCalendar({
  slots,
  selectedDateKey,
  onSelectDate,
  visibleMonth,
  onVisibleMonthChange,
}: VisitCalendarProps) {
  const bookableDates = new Set(slots.map((slot) => slot.dateKey));
  const minMonth = slots[0] ? yearMonthFromDateKey(slots[0].dateKey) : visibleMonth;
  const maxMonth = slots.at(-1)
    ? yearMonthFromDateKey(slots[slots.length - 1].dateKey)
    : visibleMonth;
  const cells = monthCells(visibleMonth);
  const canPrev = visibleMonth > minMonth;
  const canNext = visibleMonth < maxMonth;

  return (
    <div className="rounded-2xl border border-orange-100 bg-peach/50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous month"
          disabled={!canPrev}
          onClick={() => onVisibleMonthChange(addYearMonths(visibleMonth, -1))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink disabled:cursor-not-allowed disabled:text-slate-300"
        >
          ‹
        </button>
        <p className="text-sm font-bold text-ink">
          {formatYearMonthLabel(visibleMonth)}
        </p>
        <button
          type="button"
          aria-label="Next month"
          disabled={!canNext}
          onClick={() => onVisibleMonthChange(addYearMonths(visibleMonth, 1))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink disabled:cursor-not-allowed disabled:text-slate-300"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
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
          return (
            <button
              key={cell.dateKey}
              type="button"
              disabled={!bookable}
              aria-pressed={selected}
              aria-label={cell.dateKey}
              onClick={() => onSelectDate(cell.dateKey)}
              className={`h-9 rounded-lg text-sm font-semibold ${
                selected
                  ? "bg-brand text-white"
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
    </div>
  );
}
