import "server-only";

import type { Booking } from "@/db/schema";
import {
  customerEmailRecipient,
  emailConfiguration,
  sendEmail,
} from "@/lib/email";
import { databaseEmailDeliveryStore } from "@/lib/portal/email-deliveries";
import { deliverEmailOnce } from "@/lib/portal/email-flow";
import {
  bookingCustomerEmail,
  bookingOperationsEmail,
  rescheduleCustomerEmail,
  rescheduleOperationsEmail,
} from "@/lib/portal/email-templates";
import { SITE_URL } from "@/lib/site";

function manageUrl(token: string): string {
  return `${SITE_URL}/manage#access=${encodeURIComponent(token)}`;
}

async function deliver(input: {
  booking: Booking;
  rescheduleRequestId?: string;
  messageKind:
    | "booking_customer"
    | "booking_operations"
    | "reschedule_customer"
    | "reschedule_operations";
  to: string[];
  message: ReturnType<typeof bookingCustomerEmail>;
  idempotencyKey: string;
}) {
  return deliverEmailOnce(
    {
      bookingId: input.booking.id,
      rescheduleRequestId: input.rescheduleRequestId,
      messageKind: input.messageKind,
      recipient: input.to.join(","),
      idempotencyKey: input.idempotencyKey,
    },
    {
      store: databaseEmailDeliveryStore,
      send: ({ idempotencyKey }) =>
        sendEmail({
          to: input.to,
          message: input.message,
          idempotencyKey,
          bookingReference: input.booking.reference,
          messageKind: input.messageKind,
        }),
    },
  );
}

export async function deliverBookingCustomerNotification(input: {
  booking: Booking;
  manageToken: string;
}) {
  const customerTo = customerEmailRecipient(input.booking.customerEmail);
  return deliver({
    booking: input.booking,
    messageKind: "booking_customer",
    to: [customerTo],
    message: bookingCustomerEmail(input.booking, manageUrl(input.manageToken)),
    idempotencyKey: `fm-booking-customer-${input.booking.id}-v1`,
  });
}

export async function deliverBookingOperationsNotification(input: {
  booking: Booking;
}) {
  const operationsTo = emailConfiguration().operationsTo;
  return deliver({
    booking: input.booking,
    messageKind: "booking_operations",
    to: operationsTo,
    message: bookingOperationsEmail(input.booking),
    idempotencyKey: `fm-booking-operations-${input.booking.id}-v1`,
  });
}

export async function deliverBookingNotifications(input: {
  booking: Booking;
  manageToken: string;
}) {
  const customer = await deliverBookingCustomerNotification(input);
  const operations = await deliverBookingOperationsNotification(input);
  return { customer, operations };
}

export async function deliverRescheduleNotifications(input: {
  booking: Booking;
  rescheduleRequestId: string;
  previousSlotStart: Date;
  previousSlotEnd: Date;
  newSlotStart: Date;
  newSlotEnd: Date;
  manageToken: string;
}) {
  const customerTo = customerEmailRecipient(input.booking.customerEmail);
  const operationsTo = emailConfiguration().operationsTo;
  const templateInput = {
    booking: input.booking,
    previousSlotStart: input.previousSlotStart,
    previousSlotEnd: input.previousSlotEnd,
    newSlotStart: input.newSlotStart,
    newSlotEnd: input.newSlotEnd,
  };
  const customer = await deliver({
    booking: input.booking,
    rescheduleRequestId: input.rescheduleRequestId,
    messageKind: "reschedule_customer",
    to: [customerTo],
    message: rescheduleCustomerEmail({
      ...templateInput,
      manageUrl: manageUrl(input.manageToken),
    }),
    idempotencyKey: `fm-reschedule-customer-${input.rescheduleRequestId}-v1`,
  });
  const operations = await deliver({
    booking: input.booking,
    rescheduleRequestId: input.rescheduleRequestId,
    messageKind: "reschedule_operations",
    to: operationsTo,
    message: rescheduleOperationsEmail(templateInput),
    idempotencyKey: `fm-reschedule-operations-${input.rescheduleRequestId}-v1`,
  });
  return { customer, operations };
}
