import assert from "node:assert/strict";
import type Stripe from "stripe";
import type { Booking, FulfillmentStepName } from "@/db/schema";
import {
  buildManageToken,
  digestManageToken,
  newManageTokenId,
  verifyManageToken,
} from "@/lib/portal/access-token";
import {
  fulfillPaidCheckout,
  type FulfillmentStore,
} from "@/lib/portal/fulfillment";
import type { PaidBookingInput } from "@/lib/portal/bookings";

const paidAt = new Date("2026-09-02T03:32:00.000Z");

function checkoutSession(
  overrides: Partial<Stripe.Checkout.Session> = {},
): Stripe.Checkout.Session {
  return {
    id: "cs_test_portal",
    object: "checkout.session",
    amount_subtotal: 19900,
    amount_total: 21691,
    currency: "sgd",
    customer_email: "customer@example.com",
    customer_details: null,
    metadata: {
      name: "Portal Test",
      phone: "+6500000000",
      email: "customer@example.com",
      address: "1 Test Road, Singapore",
      slotStart: "2026-10-05T01:00:00.000Z",
      slotEnd: "2026-10-05T05:00:00.000Z",
      kwp: "10",
      installer: "fomo",
      serviceCode: "ESSENTIAL",
      package: "Essential Health Check",
      breakdown: "Essential Health Check: S$199.00",
      extras: "None",
      scope: "Report generation",
      exclusions: "Roof access",
    },
    payment_intent: "pi_test_portal",
    payment_status: "paid",
    total_details: {
      amount_discount: 0,
      amount_shipping: 0,
      amount_tax: 1791,
    },
    ...overrides,
  } as Stripe.Checkout.Session;
}

class MemoryStore implements FulfillmentStore {
  eventStatus = new Map<string, "processing" | "processed" | "failed">();
  booking: Booking | undefined;
  calendarCalls = 0;
  persistedBookings = 0;
  manageAccessCalls = 0;
  customerEmailCalls = 0;
  operationsEmailCalls = 0;
  stepStatus = new Map<FulfillmentStepName, string>();

  async claimEvent(eventId: string) {
    const status = this.eventStatus.get(eventId);
    if (status === "processed") return "processed" as const;
    if (status === "processing") return "busy" as const;
    this.eventStatus.set(eventId, "processing");
    return "claimed" as const;
  }

  async persistBooking(input: PaidBookingInput) {
    this.persistedBookings += 1;
    this.booking = {
      id: "10000000-0000-4000-8000-000000000001",
      ...input,
      paymentStatus: "paid",
      fulfillmentStatus: "pending",
      currency: "sgd",
      graphEventId: null,
      calendarStatus: "pending",
      customerEmailStatus: "pending",
      operationsEmailStatus: "pending",
      rescheduleCount: 0,
      recordVersion: 1,
      createdAt: paidAt,
      updatedAt: paidAt,
    };
    return this.booking;
  }

  async startStep(_bookingId: string, step: FulfillmentStepName) {
    this.stepStatus.set(step, "processing");
  }

  async completeCalendar(
    _bookingId: string,
    eventId: string,
  ) {
    assert.ok(this.booking);
    this.booking.graphEventId = eventId;
    this.booking.calendarStatus = "created";
    this.stepStatus.set("calendar", "complete");
  }

  async completeStep(
    _bookingId: string,
    step: FulfillmentStepName,
  ) {
    this.stepStatus.set(step, "complete");
  }

  async failStep(
    _bookingId: string,
    step: FulfillmentStepName,
  ) {
    this.stepStatus.set(step, "failed");
  }

  async completeBooking() {
    assert.ok(this.booking);
    this.booking.fulfillmentStatus = "complete";
  }

  async failBooking() {
    assert.ok(this.booking);
    this.booking.fulfillmentStatus = "attention";
  }

  async completeEvent(eventId: string) {
    this.eventStatus.set(eventId, "processed");
  }

  async failEvent(eventId: string) {
    this.eventStatus.set(eventId, "failed");
  }

  async ensureManageAccess() {
    this.manageAccessCalls += 1;
    return {
      id: "20000000-0000-4000-8000-000000000002",
      token: "test-manage-token",
      expiresAt: new Date("2026-11-05T05:00:00.000Z"),
      rotated: false,
    };
  }
}

async function verifyTokens() {
  const secret = "test-secret-with-more-than-thirty-two-bytes";
  const id = newManageTokenId();
  const expiresAt = new Date("2026-11-05T05:00:00.000Z");
  const token = buildManageToken({ id, expiresAt }, secret);
  assert.deepEqual(
    verifyManageToken(token, secret, new Date("2026-09-02T00:00:00.000Z")),
    { id, expiresAt },
  );
  assert.equal(digestManageToken(token).length, 64);
  const tokenParts = token.split(".");
  const signature = tokenParts[3] || "";
  tokenParts[3] = `${signature.startsWith("a") ? "b" : "a"}${signature.slice(1)}`;
  assert.equal(
    verifyManageToken(tokenParts.join("."), secret, paidAt),
    null,
    "tampered tokens must fail",
  );
  assert.equal(
    verifyManageToken(token, `${secret}-wrong`, paidAt),
    null,
    "a different server secret must fail",
  );
  assert.equal(
    verifyManageToken(token, secret, new Date("2026-11-05T05:00:01.000Z")),
    null,
    "expired tokens must fail",
  );
}

async function verifyIdempotentFulfillment() {
  const store = new MemoryStore();
  const session = checkoutSession();
  const services = {
    store,
    loadSession: async () => session,
    ensureCalendar: async () => {
      store.calendarCalls += 1;
      return { status: "created" as const, eventId: "graph-event-1" };
    },
    sendCustomerEmail: async () => {
      store.customerEmailCalls += 1;
      return { providerMessageId: "email-customer-1" };
    },
    sendOperationsEmail: async () => {
      store.operationsEmailCalls += 1;
      return { providerMessageId: "email-operations-1" };
    },
  };
  const input = {
    eventId: "evt_test_portal",
    eventType: "checkout.session.completed",
    sessionId: session.id,
    paidAt,
  };

  assert.deepEqual(await fulfillPaidCheckout(input, services), {
    status: "complete",
    calendar: "created",
  });
  assert.deepEqual(await fulfillPaidCheckout(input, services), {
    status: "duplicate",
  });
  assert.equal(store.persistedBookings, 1);
  assert.equal(store.calendarCalls, 1);
  assert.equal(store.manageAccessCalls, 1);
  assert.equal(store.customerEmailCalls, 1);
  assert.equal(store.operationsEmailCalls, 1);
  assert.equal(store.stepStatus.get("customer_email"), "complete");
  assert.equal(store.stepStatus.get("operations_email"), "complete");
  assert.equal(store.booking?.totalCents, 21691);
  assert.equal(store.booking?.gstCents, 1791);
  assert.equal(store.booking?.fulfillmentStatus, "complete");
}

async function verifyRetryRecovery() {
  const store = new MemoryStore();
  const session = checkoutSession({ id: "cs_test_retry" });
  let calendarAttempts = 0;
  const services = {
    store,
    loadSession: async () => session,
    ensureCalendar: async () => {
      calendarAttempts += 1;
      store.calendarCalls += 1;
      if (calendarAttempts === 1) {
        throw new Error("temporary Graph failure");
      }
      return { status: "exists" as const, eventId: "graph-event-recovered" };
    },
  };
  const input = {
    eventId: "evt_test_retry",
    eventType: "checkout.session.completed",
    sessionId: session.id,
    paidAt,
  };

  assert.deepEqual(await fulfillPaidCheckout(input, services), {
    status: "failed",
    reason: "calendar_failed",
  });
  assert.deepEqual(await fulfillPaidCheckout(input, services), {
    status: "complete",
    calendar: "exists",
  });
  assert.equal(store.calendarCalls, 2);
  assert.equal(store.stepStatus.get("calendar"), "complete");
  assert.equal(store.stepStatus.get("manage_link"), "complete");
}

async function verifyPermanentRejection() {
  const store = new MemoryStore();
  const session = checkoutSession({ currency: "usd" });
  const result = await fulfillPaidCheckout(
    {
      eventId: "evt_test_invalid",
      eventType: "checkout.session.completed",
      sessionId: session.id,
      paidAt,
    },
    {
      store,
      loadSession: async () => session,
      ensureCalendar: async () => {
        throw new Error("calendar must not be called");
      },
    },
  );
  assert.deepEqual(result, {
    status: "rejected",
    reason: "unsupported_currency",
  });
  assert.equal(store.booking, undefined);
}

async function verifyDatabaseAndConcurrencyFailures() {
  const session = checkoutSession({ id: "cs_test_database_failure" });
  let externalCalls = 0;
  const databaseFailureStore = new MemoryStore();
  databaseFailureStore.claimEvent = async () => {
    throw new Error("temporary database failure");
  };
  await assert.rejects(
    () =>
      fulfillPaidCheckout(
        {
          eventId: "evt_test_database_failure",
          eventType: "checkout.session.completed",
          sessionId: session.id,
          paidAt,
        },
        {
          store: databaseFailureStore,
          loadSession: async () => {
            externalCalls += 1;
            return session;
          },
          ensureCalendar: async () => {
            externalCalls += 1;
            return { status: "created", eventId: "must-not-run" } as const;
          },
        },
      ),
    "a database claim failure must propagate so Stripe receives a retryable response",
  );
  assert.equal(externalCalls, 0);

  const busyStore = new MemoryStore();
  busyStore.eventStatus.set("evt_test_busy", "processing");
  assert.deepEqual(
    await fulfillPaidCheckout(
      {
        eventId: "evt_test_busy",
        eventType: "checkout.session.completed",
        sessionId: session.id,
        paidAt,
      },
      {
        store: busyStore,
        loadSession: async () => session,
        ensureCalendar: async () => ({
          status: "created",
          eventId: "must-not-run",
        }),
      },
    ),
    { status: "busy" },
  );
}

async function main() {
  await verifyTokens();
  await verifyIdempotentFulfillment();
  await verifyRetryRecovery();
  await verifyPermanentRejection();
  await verifyDatabaseAndConcurrencyFailures();
  console.log("Portal fulfilment and access verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
