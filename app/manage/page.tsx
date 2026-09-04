import type { Metadata } from "next";
import { cookies } from "next/headers";
import ManageAccessBootstrap from "@/components/ManageAccessBootstrap";
import DocumentUploadPanel from "@/components/DocumentUploadPanel";
import ReschedulePanel from "@/components/ReschedulePanel";
import { formatSgd } from "@/lib/pricing";
import { customerBookingActionsAllowed } from "@/lib/portal/booking-actions";
import { findManageBooking } from "@/lib/portal/bookings";
import {
  blobStorageIsConfigured,
  bookingPortalEnabled,
  documentUploadsEnabled,
  MANAGE_COOKIE_NAME,
  reschedulingEnabled,
} from "@/lib/portal/config";
import {
  documentCategoryLabel,
  listManageDocuments,
} from "@/lib/portal/documents";
import { rescheduleEligibility } from "@/lib/portal/reschedule-policy";
import { findActiveCustomerReschedule } from "@/lib/portal/rescheduling";
import { formatSlotRange } from "@/lib/slots";
import { formatInstaller } from "@/lib/installer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manage booking",
  description: "View a confirmed Fomo Maintenance booking.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function ManageBookingPage() {
  const token = (await cookies()).get(MANAGE_COOKIE_NAME)?.value;
  const booking =
    bookingPortalEnabled() && token
      ? await findManageBooking(token).catch(() => null)
      : null;
  const historicalTestingBooking =
    booking && !customerBookingActionsAllowed(booking.serviceCode);
  const documents = booking
    ? await listManageDocuments(booking.id).catch(() => [])
    : [];
  const storageReady = blobStorageIsConfigured();
  const uploadsReady =
    !historicalTestingBooking && storageReady && documentUploadsEnabled();
  const reschedulePolicy = booking ? rescheduleEligibility(booking) : null;
  const activeReschedule =
    booking && reschedulingEnabled()
      ? await findActiveCustomerReschedule(booking.id).catch(() => null)
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
            {historicalTestingBooking ? (
              <p className="mt-5 rounded-2xl bg-amber-50 px-5 py-4 text-sm font-semibold leading-6 text-amber-900">
                Historical test payment only — no inspection, maintenance,
                cleaning, or other service is offered. Document uploads and
                appointment changes are disabled.
              </p>
            ) : null}
            <dl className="mt-8 grid gap-6 text-sm sm:grid-cols-2">
              <BookingDetail label="Booking reference" value={booking.reference} />
              <BookingDetail label="Customer" value={booking.customerName} />
              <BookingDetail label="Service" value={booking.packageName} />
              <BookingDetail
                label="Installer"
                value={formatInstaller(
                  booking.installerType,
                  booking.installerName,
                )}
              />
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
            {!historicalTestingBooking &&
            reschedulingEnabled() &&
            (reschedulePolicy?.allowed || activeReschedule) ? (
              <ReschedulePanel
                bookingReference={booking.reference}
                currentSlotStart={booking.slotStart.toISOString()}
                currentSlotEnd={booking.slotEnd.toISOString()}
                changesRemaining={reschedulePolicy?.changesRemaining ?? 0}
              />
            ) : (
              <div className="mt-10 rounded-2xl bg-peach px-5 py-4 text-sm leading-6 text-slate-600">
                {historicalTestingBooking
                  ? "Online date/time changes are disabled for this historical test payment."
                  : reschedulingEnabled() &&
                      reschedulePolicy &&
                      !reschedulePolicy.allowed
                    ? reschedulePolicy.reason
                    : "Online date/time changes are not available yet."}{" "}
                Email{" "}
                <a
                  className="font-semibold text-ink underline underline-offset-2"
                  href="mailto:service@fomo.energy"
                >
                  service@fomo.energy
                </a>{" "}
                if this booking needs attention.
              </div>
            )}
            <section className="mt-10 border-t border-slate-200 pt-8 text-left">
              <h2 className="text-xl font-bold text-ink">PV documents</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Upload your single-line diagram and other relevant PV system
                documents. Do not include passwords, payment-card details, or
                unrelated identity documents.
              </p>
              {historicalTestingBooking ? (
                <p className="mt-4 rounded-xl bg-peach px-4 py-3 text-sm text-slate-600">
                  New document uploads are disabled for this historical test
                  payment.
                </p>
              ) : uploadsReady ? (
                <DocumentUploadPanel currentCount={documents.length} />
              ) : (
                <p className="mt-4 rounded-xl bg-peach px-4 py-3 text-sm text-slate-600">
                  Secure document upload is not available yet. Your booking is
                  still confirmed.
                </p>
              )}
              {documents.length > 0 ? (
                <ul className="mt-8 space-y-3" aria-label="Uploaded documents">
                  {documents.map((document) => (
                    <li
                      key={document.id}
                      className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">
                            {document.originalFilename}
                          </p>
                          <p className="mt-1 text-slate-500">
                            {documentCategoryLabel(document.category)} ·{" "}
                            {formatFileSize(document.sizeBytes)} ·{" "}
                            {document.status === "available"
                              ? "Received"
                              : "Processing"}
                          </p>
                        </div>
                        {document.status === "available" && storageReady ? (
                          <a
                            href={`/api/manage/documents/${document.id}/download`}
                            className="font-semibold text-ink underline"
                          >
                            Download
                          </a>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
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

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
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
