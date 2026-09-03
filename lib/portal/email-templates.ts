import type { Booking } from "@/db/schema";
import { formatSlotRange } from "@/lib/slots";

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};

type BookingEmailData = Pick<
  Booking,
  | "reference"
  | "customerName"
  | "customerEmail"
  | "customerPhone"
  | "siteAddress"
  | "serviceCode"
  | "packageName"
  | "kwp"
  | "subtotalCents"
  | "gstCents"
  | "totalCents"
  | "slotStart"
  | "slotEnd"
>;

type EmailRow = readonly [label: string, value: string];

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(cents: number): string {
  return `S$${(cents / 100).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function systemSize(booking: BookingEmailData): string | null {
  return booking.kwp ? `${Number(booking.kwp)} kWp` : null;
}

function bookingRows(booking: BookingEmailData): EmailRow[] {
  const rows: EmailRow[] = [
    ["Booking reference", booking.reference],
    ["Service", booking.packageName],
  ];
  const size = systemSize(booking);
  if (size) rows.push(["System size", size]);
  rows.push(
    ["Visit time", formatSlotRange(booking.slotStart.toISOString(), booking.slotEnd.toISOString())],
    ["Site address", booking.siteAddress],
    ["Subtotal before GST", money(booking.subtotalCents)],
    ["GST (9%)", money(booking.gstCents)],
    ["Total paid", money(booking.totalCents)],
  );
  return rows;
}

function rowsText(rows: EmailRow[]): string {
  return rows.map(([label, value]) => `${label}: ${value}`).join("\n");
}

function rowsHtml(rows: EmailRow[]): string {
  return rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:7px 12px 7px 0;color:#64748b;vertical-align:top">${escapeHtml(label)}</td><td style="padding:7px 0;color:#0f172a;font-weight:600;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
}

function shell(input: {
  preview: string;
  heading: string;
  intro: string;
  rows: EmailRow[];
  action?: { label: string; url: string };
  footer: string;
  warning?: string;
}): string {
  const warning = input.warning
    ? `<p style="margin:20px 0;padding:14px 16px;background:#fff3ed;border-radius:10px;color:#9a3412;font-weight:600">${escapeHtml(input.warning)}</p>`
    : "";
  const action = input.action
    ? `<p style="margin:28px 0"><a href="${escapeHtml(input.action.url)}" style="display:inline-block;padding:13px 20px;border-radius:999px;background:#111827;color:#ffffff;text-decoration:none;font-weight:700">${escapeHtml(input.action.label)}</a></p><p style="font-size:12px;line-height:18px;color:#64748b;word-break:break-all">If the button does not work, copy this link into your browser:<br>${escapeHtml(input.action.url)}</p>`
    : "";
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>${escapeHtml(input.preview)}</title></head><body style="margin:0;background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(input.preview)}</div><main style="max-width:620px;margin:0 auto;padding:32px 20px"><section style="background:#ffffff;border-radius:18px;padding:30px"><p style="margin:0;color:#a83212;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Fomo Maintenance</p><h1 style="margin:12px 0 16px;font-size:28px;line-height:34px">${escapeHtml(input.heading)}</h1><p style="font-size:16px;line-height:25px;color:#334155">${escapeHtml(input.intro)}</p>${warning}<table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;line-height:21px"><tbody>${rowsHtml(input.rows)}</tbody></table>${action}<p style="margin-top:28px;font-size:13px;line-height:20px;color:#64748b">${escapeHtml(input.footer)}</p></section></main></body></html>`;
}

function testingWarning(booking: BookingEmailData): string | undefined {
  return booking.serviceCode === "TESTING"
    ? "Testing only — no inspection, maintenance, cleaning or other service is offered."
    : undefined;
}

export function bookingCustomerEmail(
  booking: BookingEmailData,
  manageUrl: string,
): RenderedEmail {
  const rows = bookingRows(booking);
  const warning = testingWarning(booking);
  const subject = `${warning ? "[TESTING] " : ""}Booking confirmed — ${booking.reference}`;
  return {
    subject,
    text: [
      `Hello ${booking.customerName},`,
      "",
      "Your Fomo Maintenance booking is confirmed after successful payment.",
      warning || "",
      "",
      rowsText(rows),
      "",
      `Manage your booking and upload PV documents: ${manageUrl}`,
      "",
      "Keep this private link secure. Anyone with it can view this booking and use its enabled customer actions.",
      "This booking confirmation is not an IRAS tax invoice.",
    ]
      .filter((line, index, lines) => line || lines[index - 1] !== "")
      .join("\n"),
    html: shell({
      preview: `Booking ${booking.reference} is confirmed`,
      heading: "Your booking is confirmed",
      intro: `Hello ${booking.customerName}. Your payment was successful and the appointment below is confirmed.`,
      rows,
      warning,
      action: { label: "Manage booking and upload documents", url: manageUrl },
      footer:
        "Keep this private link secure. Anyone with it can view this booking and use its enabled customer actions. This booking confirmation is not an IRAS tax invoice.",
    }),
  };
}

export function bookingOperationsEmail(
  booking: BookingEmailData,
): RenderedEmail {
  const rows: EmailRow[] = [
    ...bookingRows(booking),
    ["Customer", booking.customerName],
    ["Customer email", booking.customerEmail],
    ["Customer phone", booking.customerPhone],
  ];
  const warning = testingWarning(booking);
  const subject = `${warning ? "[TESTING] " : ""}New paid booking — ${booking.reference}`;
  return {
    subject,
    text: [
      "A paid Fomo Maintenance booking has completed calendar fulfilment.",
      warning || "",
      "",
      rowsText(rows),
      "",
      "The customer manage credential is intentionally excluded from this operations email.",
    ]
      .filter((line, index, lines) => line || lines[index - 1] !== "")
      .join("\n"),
    html: shell({
      preview: `New paid booking ${booking.reference}`,
      heading: "New paid booking",
      intro:
        "A paid Fomo Maintenance booking has completed calendar fulfilment.",
      rows,
      warning,
      footer:
        "The customer manage credential is intentionally excluded from this operations email.",
    }),
  };
}

export function rescheduleCustomerEmail(input: {
  booking: BookingEmailData;
  previousSlotStart: Date;
  previousSlotEnd: Date;
  newSlotStart: Date;
  newSlotEnd: Date;
  manageUrl: string;
}): RenderedEmail {
  const { booking } = input;
  const rows: EmailRow[] = [
    ["Booking reference", booking.reference],
    ["Service", booking.packageName],
    ["Previous visit", formatSlotRange(input.previousSlotStart.toISOString(), input.previousSlotEnd.toISOString())],
    ["New visit", formatSlotRange(input.newSlotStart.toISOString(), input.newSlotEnd.toISOString())],
    ["Site address", booking.siteAddress],
  ];
  const warning = testingWarning(booking);
  const subject = `${warning ? "[TESTING] " : ""}Appointment changed — ${booking.reference}`;
  return {
    subject,
    text: `Hello ${booking.customerName},\n\nYour Fomo Maintenance appointment has been changed.${warning ? `\n\n${warning}` : ""}\n\n${rowsText(rows)}\n\nManage your booking and upload PV documents: ${input.manageUrl}\n\nKeep this private link secure.`,
    html: shell({
      preview: `Appointment ${booking.reference} has changed`,
      heading: "Your appointment has changed",
      intro: `Hello ${booking.customerName}. Your new appointment time is confirmed below.`,
      rows,
      warning,
      action: {
        label: "Manage booking and upload documents",
        url: input.manageUrl,
      },
      footer: "Keep this private link secure.",
    }),
  };
}

export function rescheduleOperationsEmail(input: {
  booking: BookingEmailData;
  previousSlotStart: Date;
  previousSlotEnd: Date;
  newSlotStart: Date;
  newSlotEnd: Date;
}): RenderedEmail {
  const { booking } = input;
  const rows: EmailRow[] = [
    ["Booking reference", booking.reference],
    ["Customer", booking.customerName],
    ["Customer email", booking.customerEmail],
    ["Customer phone", booking.customerPhone],
    ["Service", booking.packageName],
    ["Previous visit", formatSlotRange(input.previousSlotStart.toISOString(), input.previousSlotEnd.toISOString())],
    ["New visit", formatSlotRange(input.newSlotStart.toISOString(), input.newSlotEnd.toISOString())],
    ["Site address", booking.siteAddress],
  ];
  const warning = testingWarning(booking);
  return {
    subject: `${warning ? "[TESTING] " : ""}Appointment changed — ${booking.reference}`,
    text: `A customer appointment has been changed and confirmed in Microsoft Calendar.${warning ? `\n\n${warning}` : ""}\n\n${rowsText(rows)}\n\nThe customer manage credential is intentionally excluded from this operations email.`,
    html: shell({
      preview: `Appointment ${booking.reference} has changed`,
      heading: "Customer appointment changed",
      intro:
        "A customer appointment has been changed and confirmed in Microsoft Calendar.",
      rows,
      warning,
      footer:
        "The customer manage credential is intentionally excluded from this operations email.",
    }),
  };
}

export function paymentLifecycleOperationsEmail(input: {
  booking: BookingEmailData;
  kind: "partial_refund" | "dispute";
  amountCents: number;
  chargeId: string;
  disputeId?: string;
  appointmentRetained?: boolean;
}): RenderedEmail {
  const isDispute = input.kind === "dispute";
  const heading = isDispute
    ? "Payment dispute requires attention"
    : "Partial refund requires attention";
  const rows: EmailRow[] = [
    ["Booking reference", input.booking.reference],
    ["Customer", input.booking.customerName],
    ["Customer email", input.booking.customerEmail],
    ["Service", input.booking.packageName],
    ["Visit time", formatSlotRange(input.booking.slotStart.toISOString(), input.booking.slotEnd.toISOString())],
    ["Site address", input.booking.siteAddress],
    [isDispute ? "Disputed amount" : "Refunded amount", money(input.amountCents)],
    ["Stripe charge", input.chargeId],
  ];
  if (input.disputeId) rows.push(["Stripe dispute", input.disputeId]);
  const instruction = isDispute && input.appointmentRetained === false
    ? "This booking was already fully refunded and its appointment was cancelled before the dispute arrived. Check Stripe and coordinate any financial response manually."
    : isDispute
      ? "The appointment remains confirmed while the dispute is reviewed. Check Stripe and coordinate any operational decision manually."
    : "The appointment remains confirmed because this was not a full refund. Check Stripe and coordinate any operational decision manually.";
  return {
    subject: `${isDispute ? "Payment dispute" : "Partial refund"} — ${input.booking.reference}`,
    text: `${heading}.\n\n${rowsText(rows)}\n\n${instruction}`,
    html: shell({
      preview: `${heading} for ${input.booking.reference}`,
      heading,
      intro: instruction,
      rows,
      footer:
        "This is an internal operations alert. The customer manage credential is intentionally excluded.",
    }),
  };
}
