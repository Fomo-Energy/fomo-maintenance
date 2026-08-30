"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { VisitCalendar } from "@/components/VisitCalendar";
import { QUOTE_EMAIL } from "@/lib/site";
import { formatSgd, type InstallerId } from "@/lib/pricing";
import {
  singaporeDateKey,
  yearMonthFromDateKey,
  type VisitSlot,
} from "@/lib/slots";

type VisitBookingProps = {
  kwp: number;
  installer: InstallerId;
  roofAccess: boolean;
  advancedPreventive: boolean;
  monitoring: boolean;
  totalSgd: number;
  indicative: boolean;
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

export function VisitBooking({
  kwp,
  installer,
  roofAccess,
  advancedPreventive,
  monitoring,
  totalSgd,
  indicative,
}: VisitBookingProps) {
  const [fields, setFields] = useState<FieldState>(EMPTY_FIELDS);
  const [slots, setSlots] = useState<VisitSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    yearMonthFromDateKey(singaporeDateKey(new Date())),
  );
  const [payError, setPayError] = useState<string | null>(null);
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
  }
  const formReady =
    fields.name.trim().length > 0 &&
    fields.phone.trim().length >= 8 &&
    fields.email.includes("@") &&
    fields.address.trim().length >= 5 &&
    selected !== null &&
    Number.isFinite(kwp) &&
    kwp > 0 &&
    totalSgd > 0;

  function update<K extends keyof FieldState>(key: K, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function pay() {
    if (!selected || submitting) {
      return;
    }
    setPayError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kwp,
          installer,
          roofAccess,
          advancedPreventive,
          monitoring,
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
    <div className="mt-8 border-t border-orange-100 pt-8">
      <h3 className="text-lg font-bold">Book a visit</h3>
      <p className="mt-1 text-sm text-slate-500">
        {indicative
          ? "This figure is indicative until a site check. Paying books a four-hour site-check visit at the address below."
          : "Name, phone, email, and the site address, then a four-hour weekday visit. Paying books that visit at the annual figure above."}
      </p>

      <div className="mt-5 grid gap-3">
        <label className="text-sm font-semibold">
          Name
          <input
            required
            name="name"
            autoComplete="name"
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
          <p className="mt-4 text-sm text-slate-500">Loading visit times…</p>
        ) : null}
        {slotsError ? (
          <div className="mt-4 rounded-xl bg-peach px-4 py-3 text-sm leading-6 text-slate-700">
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
          <p className="mt-4 text-sm text-slate-600">
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
                value={selectedStart ?? ""}
                disabled={!selectedDateKey || daySlots.length === 0}
                onChange={(event) =>
                  setSelectedStart(event.target.value || null)
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

      {payError ? (
        <p className="mt-4 text-sm font-semibold text-red-700" role="alert">
          {payError}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!formReady || submitting}
        onClick={() => void pay()}
        className="cta-pill mt-6 w-full px-7 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting
          ? "Opening payment…"
          : `Pay ${formatSgd(totalSgd)} and book`}
      </button>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        You will pay on Stripe’s checkout page. A calendar event is created only
        after payment succeeds, not when you pick a time.
      </p>
    </div>
  );
}
