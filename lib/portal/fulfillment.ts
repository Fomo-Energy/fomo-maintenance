import type Stripe from "stripe";
import type { Booking, FulfillmentStepName } from "@/db/schema";
import type { PaidBookingInput } from "@/lib/portal/bookings";
import {
  maintenanceVisitFromSession,
  paidBookingFromSession,
  PermanentFulfillmentError,
} from "@/lib/portal/stripe-booking";
import type { MaintenanceVisitInput } from "@/lib/microsoft";

export type EventClaim = "claimed" | "processed" | "busy";
export type CalendarResult = {
  status: "created" | "exists";
  eventId: string;
};

export type ManageAccessCredential = {
  id: string;
  token: string;
  expiresAt: Date;
  rotated: boolean;
};

export type FulfillmentStore = {
  claimEvent(eventId: string, eventType: string): Promise<EventClaim>;
  persistBooking(input: PaidBookingInput): Promise<Booking>;
  startStep(bookingId: string, step: FulfillmentStepName): Promise<void>;
  completeCalendar(
    bookingId: string,
    eventId: string,
    status: CalendarResult["status"],
  ): Promise<void>;
  completeStep(
    bookingId: string,
    step: FulfillmentStepName,
    externalId?: string,
  ): Promise<void>;
  failStep(
    bookingId: string,
    step: FulfillmentStepName,
    failureCode: string,
  ): Promise<void>;
  completeBooking(bookingId: string): Promise<void>;
  failBooking(bookingId: string, failureCode: string): Promise<void>;
  completeEvent(eventId: string, bookingId: string): Promise<void>;
  failEvent(
    eventId: string,
    failureCode: string,
    bookingId?: string,
  ): Promise<void>;
  ensureManageAccess(
    bookingId: string,
    slotEnd: Date,
  ): Promise<ManageAccessCredential>;
};

export type FulfillmentServices = {
  store: FulfillmentStore;
  loadSession(sessionId: string): Promise<Stripe.Checkout.Session>;
  ensureCalendar(input: MaintenanceVisitInput): Promise<CalendarResult>;
  sendCustomerEmail?(input: {
    booking: Booking;
    manageToken: string;
  }): Promise<{ providerMessageId: string | null }>;
  sendOperationsEmail?(input: {
    booking: Booking;
  }): Promise<{ providerMessageId: string | null }>;
};

export type FulfillmentResult =
  | { status: "complete"; calendar: CalendarResult["status"] }
  | { status: "duplicate" }
  | { status: "busy" }
  | { status: "rejected"; reason: string }
  | { status: "failed"; reason: string };

export async function fulfillPaidCheckout(
  input: {
    eventId: string;
    eventType: string;
    sessionId: string;
    paidAt: Date;
  },
  services: FulfillmentServices,
): Promise<FulfillmentResult> {
  const claim = await services.store.claimEvent(input.eventId, input.eventType);
  if (claim === "processed") {
    return { status: "duplicate" };
  }
  if (claim === "busy") {
    return { status: "busy" };
  }

  let booking: Booking | undefined;
  let activeStep: FulfillmentStepName | undefined;
  try {
    const session = await services.loadSession(input.sessionId);
    const bookingInput = paidBookingFromSession(session, input.paidAt);
    booking = await services.store.persistBooking(bookingInput);

    activeStep = "calendar";
    await services.store.startStep(booking.id, activeStep);
    const calendar = await services.ensureCalendar(
      maintenanceVisitFromSession(session),
    );
    await services.store.completeCalendar(
      booking.id,
      calendar.eventId,
      calendar.status,
    );

    activeStep = "manage_link";
    await services.store.startStep(booking.id, activeStep);
    const access = await services.store.ensureManageAccess(
      booking.id,
      booking.slotEnd,
    );
    await services.store.completeStep(booking.id, activeStep, access.id);

    if (services.sendCustomerEmail && services.sendOperationsEmail) {
      activeStep = "customer_email";
      await services.store.startStep(booking.id, activeStep);
      const customerEmail = await services.sendCustomerEmail({
        booking,
        manageToken: access.token,
      });
      await services.store.completeStep(
        booking.id,
        activeStep,
        customerEmail.providerMessageId || undefined,
      );

      activeStep = "operations_email";
      await services.store.startStep(booking.id, activeStep);
      const operationsEmail = await services.sendOperationsEmail({ booking });
      await services.store.completeStep(
        booking.id,
        activeStep,
        operationsEmail.providerMessageId || undefined,
      );
    }

    await services.store.completeBooking(booking.id);
    await services.store.completeEvent(input.eventId, booking.id);
    return { status: "complete", calendar: calendar.status };
  } catch (error) {
    const permanent = error instanceof PermanentFulfillmentError;
    const failureCode = permanent ? error.code : `${activeStep || "booking"}_failed`;

    if (booking) {
      if (activeStep) {
        await services.store.failStep(booking.id, activeStep, failureCode);
      }
      await services.store.failBooking(booking.id, failureCode);
    }
    await services.store.failEvent(input.eventId, failureCode, booking?.id);

    return permanent
      ? { status: "rejected", reason: failureCode }
      : { status: "failed", reason: failureCode };
  }
}
