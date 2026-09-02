"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { VisitCalendar } from "@/components/VisitCalendar";
import {
  formatSlotRange,
  singaporeDateKey,
  yearMonthFromDateKey,
  type VisitSlot,
} from "@/lib/slots";

type PendingReschedule = {
  requestKey: string;
  slotStart: string;
  slotEnd: string;
};

function readPendingReschedule(storageKey: string): PendingReschedule | null {
  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(storageKey) || "null",
    ) as Partial<PendingReschedule> | null;
    return parsed &&
      typeof parsed.requestKey === "string" &&
      typeof parsed.slotStart === "string" &&
      typeof parsed.slotEnd === "string"
      ? (parsed as PendingReschedule)
      : null;
  } catch {
    return null;
  }
}

function writePendingReschedule(
  storageKey: string,
  pending: PendingReschedule,
): void {
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(pending));
  } catch {
    // The request still works when browser session storage is unavailable.
  }
}

function clearPendingReschedule(storageKey: string): void {
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // The request still works when browser session storage is unavailable.
  }
}

export default function ReschedulePanel({
  currentSlotStart,
  currentSlotEnd,
  changesRemaining,
  bookingReference,
}: {
  currentSlotStart: string;
  currentSlotEnd: string;
  changesRemaining: number;
  bookingReference: string;
}) {
  const router = useRouter();
  const requestStorageKey = `fomo-maintenance:reschedule:${bookingReference}`;
  const requestKey = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<VisitSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retryRequired, setRetryRequired] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    yearMonthFromDateKey(singaporeDateKey(new Date())),
  );

  const daySlots = useMemo(
    () =>
      selectedDateKey
        ? slots.filter((slot) => slot.dateKey === selectedDateKey)
        : [],
    [selectedDateKey, slots],
  );
  const selected = slots.find((slot) => slot.start === selectedStart) ?? null;

  async function loadSlots() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/manage/reschedule/availability", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = (await response.json()) as {
        slots?: VisitSlot[];
        pendingReschedule?: { requestKey: string; slot: VisitSlot };
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Available visit times could not be loaded.");
      }
      const nextSlots = data.slots ?? [];
      if (
        data.pendingReschedule &&
        !nextSlots.some(
          (slot) => slot.start === data.pendingReschedule?.slot.start,
        )
      ) {
        nextSlots.push(data.pendingReschedule.slot);
      }
      setSlots(nextSlots);
      const pending = data.pendingReschedule
        ? {
            requestKey: data.pendingReschedule.requestKey,
            slotStart: data.pendingReschedule.slot.start,
            slotEnd: data.pendingReschedule.slot.end,
          }
        : readPendingReschedule(requestStorageKey);
      const pendingSlot = pending
        ? nextSlots.find(
            (slot) =>
              slot.start === pending.slotStart && slot.end === pending.slotEnd,
          )
        : undefined;
      if (pending && pendingSlot) {
        requestKey.current = pending.requestKey;
        setSelectedDateKey(pendingSlot.dateKey);
        setSelectedStart(pendingSlot.start);
        setRetryRequired(true);
        setMessage(
          "A previous confirmation was interrupted. Retry the same change to verify its status.",
        );
      }
      if (nextSlots[0]) {
        setVisibleMonth(yearMonthFromDateKey(nextSlots[0].dateKey));
      }
      setOpen(true);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Available visit times could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || submitting) {
      setError("Choose an available date and time.");
      return;
    }
    setSubmitting(true);
    setError("");
    setMessage("Confirming the new appointment with the calendar…");
    if (!requestKey.current) {
      requestKey.current = crypto.randomUUID();
      writePendingReschedule(
        requestStorageKey,
        {
          requestKey: requestKey.current,
          slotStart: selected.start,
          slotEnd: selected.end,
        },
      );
    }
    try {
      const response = await fetch("/api/manage/reschedule", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestKey: requestKey.current,
          slotStart: selected.start,
          slotEnd: selected.end,
        }),
      });
      const data = (await response.json()) as { changed?: boolean; error?: string };
      if (!response.ok || !data.changed) {
        if (response.status === 409) {
          clearPendingReschedule(requestStorageKey);
          requestKey.current = null;
          setRetryRequired(false);
          setSelectedDateKey(null);
          setSelectedStart(null);
          void loadSlots();
        } else if (response.status >= 500) {
          setRetryRequired(true);
        } else {
          clearPendingReschedule(requestStorageKey);
          requestKey.current = null;
          setRetryRequired(false);
        }
        throw new Error(data.error || "The date/time change did not complete.");
      }
      requestKey.current = null;
      clearPendingReschedule(requestStorageKey);
      setRetryRequired(false);
      setMessage("Your new appointment time is confirmed.");
      setOpen(false);
      router.refresh();
    } catch (submitError) {
      if (requestKey.current) {
        setRetryRequired(true);
      }
      setError(
        submitError instanceof Error
          ? submitError.message
          : "The date/time change did not complete.",
      );
      setMessage("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-10 border-t border-slate-200 pt-8 text-left">
      <h2 className="text-xl font-bold text-ink">Change visit time</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Your current visit is {formatSlotRange(currentSlotStart, currentSlotEnd)}.
        You can change only the date and time, up to 48 hours before the visit.
        {` ${changesRemaining} online ${changesRemaining === 1 ? "change" : "changes"} remaining.`}
      </p>
      {!open ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => void loadSlots()}
          className="cta-pill mt-5 px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Loading available times…" : "Choose a new time"}
        </button>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={(event) => void submit(event)}>
          {slots.length > 0 ? (
            <>
              {!retryRequired ? (
                <>
                  <VisitCalendar
                    slots={slots}
                    selectedDateKey={selectedDateKey}
                    onSelectDate={(dateKey) => {
                      setSelectedDateKey(dateKey);
                      setSelectedStart(null);
                      requestKey.current = null;
                      clearPendingReschedule(requestStorageKey);
                      setError("");
                    }}
                    visibleMonth={visibleMonth}
                    onVisibleMonthChange={(yearMonth) => {
                      setVisibleMonth(yearMonth);
                      if (
                        selectedDateKey &&
                        yearMonthFromDateKey(selectedDateKey) !== yearMonth
                      ) {
                        setSelectedDateKey(null);
                        setSelectedStart(null);
                        requestKey.current = null;
                        clearPendingReschedule(requestStorageKey);
                      }
                    }}
                  />
                  <label className="block text-sm font-bold text-ink">
                    Time
                    <select
                      required
                      value={selectedStart ?? ""}
                      disabled={!selectedDateKey || daySlots.length === 0 || submitting}
                      onChange={(event) => {
                        setSelectedStart(event.target.value || null);
                        requestKey.current = null;
                        clearPendingReschedule(requestStorageKey);
                        setError("");
                      }}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-ink disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      <option value="">
                        {selectedDateKey ? "Choose a time" : "Choose a date first"}
                      </option>
                      {daySlots.map((slot) => (
                        <option key={slot.start} value={slot.start}>
                          {slot.timeLabel}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              {selected ? (
                <p className="rounded-xl bg-peach px-4 py-3 text-sm leading-6 text-slate-700">
                  New visit: {formatSlotRange(selected.start, selected.end)}. Your
                  existing appointment remains in place until this change is
                  confirmed.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={!selected || submitting}
                  className="cta-pill px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? "Confirming…"
                    : retryRequired
                      ? "Retry confirmation"
                      : "Confirm new time"}
                </button>
                {!retryRequired ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setOpen(false);
                      setSelectedDateKey(null);
                      setSelectedStart(null);
                      requestKey.current = null;
                      clearPendingReschedule(requestStorageKey);
                      setError("");
                    }}
                    className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-ink"
                  >
                    Keep current time
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-600">
              No replacement times are currently available. Contact the FOMO
              team if the booking needs attention.
            </p>
          )}
        </form>
      )}
      {message ? (
        <p className="mt-4 text-sm font-semibold text-ink" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
      {error ? (
        <div className="mt-4 text-sm font-semibold text-red-700" role="alert">
          <p>{error}</p>
          {!open ? (
            <button type="button" className="mt-2 underline" onClick={() => void loadSlots()}>
              Try again
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
