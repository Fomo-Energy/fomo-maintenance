import type { Metadata } from "next";
import { cookies } from "next/headers";
import ManageAccessBootstrap from "@/components/ManageAccessBootstrap";
import { formatSgd } from "@/lib/pricing";
import { findManageBooking } from "@/lib/portal/bookings";
import { bookingPortalEnabled } from "@/lib/portal/config";
import { formatSlotRange } from "@/lib/slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manage booking",
  description: "View a confirmed Fomo Maintenance booking.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

const COOKIE_NAME = "fomo_manage";

export default async function ManageBookingPage() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const booking =
    bookingPortalEnabled() && token
      ? await findManageBooking(token).catch(() => null)
      : null;

  return (
    <main className="min-h-screen bg-peach px-6 py-16">
      <section className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow-sm sm:p-12">
        <p className="text-brand-on-light text-sm font-semibold uppercase tracking-[0.2em]">
          Fomo Maintenance
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">
          Manage booking
        </h1>
        {booking ? (
          <>
            <p className="mt-4 text-slate-600">
              Your paid appointment is confirmed below.
            </p>
            <dl className="mt-8 grid gap-6 text-sm sm:grid-cols-2">
              <BookingDetail label="Booking reference" value={booking.reference} />
              <BookingDetail label="Customer" value={booking.customerName} />
              <BookingDetail label="Service" value={booking.packageName} />
              <BookingDetail
                label="System size"
                value={booking.kwp ? `${Number(booking.kwp)} kWp` : "—"}
              />
              <BookingDetail
                label="Visit time"
                value={formatSlotRange(
                  booking.slotStart.toISOString(),
                  booking.slotEnd.toISOString(),
                )}
              />
              <BookingDetail
                label="Amount paid"
                value={formatSgd(booking.totalCents / 100)}
              />
              <div className="sm:col-span-2">
                <BookingDetail
                  label="Site address"
                  value={booking.siteAddress}
                />
              </div>
            </dl>
            <div className="mt-10 rounded-2xl bg-peach px-5 py-4 text-sm leading-6 text-slate-600">
              Secure document upload and self-service date/time changes are the
              next delivery stages. For now, contact the FOMO team if this
              booking needs attention.
            </div>
          </>
        ) : (
          <div className="mt-6 rounded-2xl bg-peach px-5 py-4 text-slate-600">
            <ManageAccessBootstrap />
          </div>
        )}
      </section>
    </main>
  );
}
function BookingDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap font-semibold text-ink">{value}</dd>
    </div>
  );
}
