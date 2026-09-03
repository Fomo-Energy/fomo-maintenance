"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { VisitCalendar } from "@/components/VisitCalendar";
import { QUOTE_EMAIL } from "@/lib/site";
import {
  formatSgd,
  type InstallerId,
  type ServiceLevel,
} from "@/lib/pricing";
import {
  singaporeDateKey,
  yearMonthFromDateKey,
  type VisitSlot,
} from "@/lib/slots";

type VisitBookingProps = {
  kwp: number;
  installer: InstallerId;
  serviceLevel: ServiceLevel;
  cleaning: boolean;
  totalSgd: number;
};

type FieldState = {
  name: string;
  phone: string;
  email: string;
  address: string;
};

const EMPTY_FIELDS: FieldState = {
  name: "",
  phone: "",
  email: "",
  address: "",
};

const SAVED_DETAILS_STORAGE_KEY = "fomo-maintenance:booking-details:v1";

function parseSavedFields(value: string | null): FieldState | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<
      Record<keyof FieldState, unknown>
    >;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const name =
      typeof parsed.name === "string" ? parsed.name.slice(0, 120) : "";
    const phone =
      typeof parsed.phone === "string" ? parsed.phone.slice(0, 32) : "";
    const email =
      typeof parsed.email === "string" ? parsed.email.slice(0, 254) : "";
    const address =
      typeof parsed.address === "string" ? parsed.address.slice(0, 500) : "";

    return { name, phone, email, address };
  } catch {
    return null;
  }
}

export function VisitBooking({
  kwp,
  installer,
  serviceLevel,
  cleaning,
  totalSgd,
}: VisitBookingProps) {
  const [fields, setFields] = useState<FieldState>(EMPTY_FIELDS);
  const [savedDetailsReady, setSavedDetailsReady] = useState(false);
  const [slots, setSlots] = useState<VisitSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    yearMonthFromDateKey(singaporeDateKey(new Date())),
  );
  const [payError, setPayError] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadSlots = useCallback(async () => {
    setSlotsLoading(true);
    setSlotsError(null);
    try {
      const response = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await response.json()) as {
        slots?: VisitSlot[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Visit times could not be loaded.");
      }
      const nextSlots = data.slots ?? [];
      setSlots(nextSlots);
      if (nextSlots[0]) {
        setVisibleMonth(yearMonthFromDateKey(nextSlots[0].dateKey));
      }
    } catch (error) {
      setSlots([]);
      setSlotsError(
        error instanceof Error
          ? error.message
          : "Visit times could not be loaded.",
      );
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  useEffect(() => {
    try {
      const saved = parseSavedFields(
        window.localStorage.getItem(SAVED_DETAILS_STORAGE_KEY),
      );
      if (saved) {
        setFields(saved);
      }
    } catch {
      // The booking form remains usable when browser storage is unavailable.
    } finally {
      setSavedDetailsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!savedDetailsReady) {
      return;
    }

    try {
      const hasSavedValue = Object.values(fields).some(
        (value) => value.trim().length > 0,
      );
      if (hasSavedValue) {
        window.localStorage.setItem(
          SAVED_DETAILS_STORAGE_KEY,
          JSON.stringify(fields),
        );
      } else {
        window.localStorage.removeItem(SAVED_DETAILS_STORAGE_KEY);
      }
    } catch {
      // The booking form remains usable when browser storage is unavailable.
    }
  }, [fields, savedDetailsReady]);

  const daySlots = useMemo(
    () =>
      selectedDateKey
        ? slots.filter((slot) => slot.dateKey === selectedDateKey)
        : [],
    [selectedDateKey, slots],
  );

  const selected = slots.find((slot) => slot.start === selectedStart) ?? null;

  function chooseDate(dateKey: string) {
    setSelectedDateKey(dateKey);
    setSelectedStart(null);
    setSelectionError(null);
  }
  const contactComplete =
    fields.name.trim().length > 0 &&
    fields.phone.trim().length >= 8 &&
    fields.email.includes("@") &&
    fields.address.trim().length >= 5;
  const completionMessage = !contactComplete
    ? "Complete all required contact and site fields."
    : !selectedDateKey
      ? "Next, choose an available visit date."
      : !selected
        ? "Now choose a visit time."
        : "Booking details complete. Continue to secure Stripe checkout.";

  function update<K extends keyof FieldState>(key: K, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function clearSavedDetails() {
    setFields(EMPTY_FIELDS);
  }

  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }
    if (!selected) {
      setSelectionError("Choose an available visit date and time.");
      return;
    }
    setSelectionError(null);
    setPayError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kwp,
          installer,
          serviceLevel,
          cleaning,
          monitoring: false,
          name: fields.name,
          phone: fields.phone,
          email: fields.email,
          address: fields.address,
          slotStart: selected.start,
          slotEnd: selected.end,
        }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        if (response.status === 409) {
          setSelectedStart(null);
          setSelectedDateKey(null);
          void loadSlots();
        }
        throw new Error(data.error || "Checkout could not start.");
      }
      window.location.href = data.url;
    } catch (error) {
      setPayError(
        error instanceof Error ? error.message : "Checkout could not start.",
      );
      setSubmitting(false);
    }
  }

  return (
    <form
      className="mt-8 border-t border-orange-100 pt-8"
      onSubmit={(event) => void pay(event)}
    >
      <h3 className="text-lg font-bold">Book a visit</h3>
      <p className="mt-1 text-sm text-slate-500">
        Add your contact and site details, then choose a four-hour weekday
        visit. Paying books the package at the final price above.
      </p>

      <div className="mt-3 flex items-center justify-between gap-4 text-xs text-slate-500">
        <span>Your contact and site details are saved on this browser.</span>
        <button
          type="button"
          className="shrink-0 font-semibold text-ink underline underline-offset-2"
          onClick={clearSavedDetails}
        >
          Clear saved details
        </button>
      </div>

      <div className="mt-5 grid gap-3">
        <label className="text-sm font-semibold">
          Name
          <input
            required
            name="name"
            autoComplete="name"
            maxLength={120}
            aria-describedby="booking-completion"
            value={fields.name}
            onChange={(event) => update("name", event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none ring-brand focus:ring-2"
          />
        </label>
        <label className="text-sm font-semibold">
          Phone
          <input
            required
            name="phone"
            type="tel"
            autoComplete="tel"
            minLength={8}
            maxLength={32}
            aria-describedby="booking-completion"
            value={fields.phone}
            onChange={(event) => update("phone", event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none ring-brand focus:ring-2"
          />
        </label>
        <label className="text-sm font-semibold">
          Email
          <input
            required
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            aria-describedby="booking-completion"
            value={fields.email}
            onChange={(event) => update("email", event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none ring-brand focus:ring-2"
          />
        </label>
        <label className="text-sm font-semibold">
          Site address
          <textarea
            required
            name="address"
            autoComplete="street-address"
            rows={3}
            minLength={5}
            maxLength={500}
            aria-describedby="booking-completion"
            value={fields.address}
            onChange={(event) => update("address", event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none ring-brand focus:ring-2"
          />
          <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
            This is where the visit happens.
          </span>
        </label>
      </div>

      <div className="mt-6">
        <p className="text-sm font-semibold">Visit time (Asia/Singapore)</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Weekdays in the next three months, 09:00–17:00, four-hour visits.
          Times already held on the operations calendar are hidden.
        </p>

        {slotsLoading ? (
          <p
            className="mt-4 text-sm text-slate-500"
            role="status"
            aria-live="polite"
          >
            Loading visit times…
          </p>
        ) : null}
        {slotsError ? (
          <div
            className="mt-4 rounded-xl bg-peach px-4 py-3 text-sm leading-6 text-slate-700"
            role="alert"
          >
            <p>{slotsError}</p>
            <button
              type="button"
              className="mt-2 font-semibold text-ink underline"
              onClick={() => void loadSlots()}
            >
              Try again
            </button>
          </div>
        ) : null}
        {!slotsLoading && !slotsError && slots.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600" role="status">
            No weekday slots in the next three months. Email{" "}
            <a className="font-semibold text-ink" href={`mailto:${QUOTE_EMAIL}`}>
              {QUOTE_EMAIL}
            </a>
            .
          </p>
        ) : null}

        {!slotsLoading && !slotsError && slots.length > 0 ? (
          <div className="mt-4 grid gap-3">
            <VisitCalendar
              slots={slots}
              selectedDateKey={selectedDateKey}
              onSelectDate={chooseDate}
              visibleMonth={visibleMonth}
              onVisibleMonthChange={(yearMonth) => {
                setVisibleMonth(yearMonth);
                if (
                  selectedDateKey &&
                  yearMonthFromDateKey(selectedDateKey) !== yearMonth
                ) {
                  setSelectedDateKey(null);
                  setSelectedStart(null);
                }
              }}
            />
            <label className="text-sm font-semibold">
              Time
              <select
                required
                aria-describedby="booking-completion"
                value={selectedStart ?? ""}
                disabled={!selectedDateKey || daySlots.length === 0}
                onChange={(event) =>
                  {
                    setSelectedStart(event.target.value || null);
                    setSelectionError(null);
                  }
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal outline-none ring-brand focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400"
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
          </div>
        ) : null}
      </div>

      <p
        id="booking-completion"
        className="mt-4 text-sm font-medium text-slate-600"
        role="status"
        aria-live="polite"
      >
        {completionMessage}
      </p>

      {selectionError ? (
        <p className="mt-3 text-sm font-semibold text-red-700" role="alert">
          {selectionError}
        </p>
      ) : null}

      {payError ? (
        <p className="mt-4 text-sm font-semibold text-red-700" role="alert">
          {payError}
        </p>
      ) : null}

      {cleaning ? (
        <p className="mt-4 rounded-xl bg-peach px-4 py-3 text-xs leading-5 text-slate-700">
          Stripe checkout includes the cleaning charge. Cleaning proceeds only
          after safe roof access is confirmed; if it cannot be confirmed, the
          team will contact you to resolve that charge.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={
          submitting ||
          slotsLoading ||
          Boolean(slotsError) ||
          slots.length === 0 ||
          !Number.isFinite(kwp) ||
          kwp <= 0 ||
          totalSgd <= 0
        }
        className="cta-pill mt-6 min-h-11 w-full px-7 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting
          ? "Opening payment…"
          : `Pay ${formatSgd(totalSgd)} and book`}
      </button>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        The displayed payment amount includes 9% GST. Your booking will be
        confirmed after payment succeeds.
      </p>
    </form>
  );
}
