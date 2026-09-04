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
import { customerBookingActionsAllowed } from "@/lib/portal/booking-actions";
import { checkoutLifecycleAction } from "@/lib/portal/stripe-lifecycle";
import {
  processPaymentLifecycleEvent,
  type LifecyclePaymentStatus,
  type PaymentLifecycleStore,
} from "@/lib/portal/payment-lifecycle";
import {
  maintenanceVisitFromSession,
  paidBookingFromSession,
  PermanentFulfillmentError,
} from "@/lib/portal/stripe-booking";

const paidAt = new Date("2026-09-02T03:32:00.000Z");

assert.equal(customerBookingActionsAllowed("ESSENTIAL"), true);
assert.equal(customerBookingActionsAllowed("TESTING"), false);
assert.equal(
  checkoutLifecycleAction("checkout.session.completed", "paid"),
  "fulfill",
);
assert.equal(
  checkoutLifecycleAction("checkout.session.completed", "unpaid"),
  "await_payment",
);
assert.equal(
  checkoutLifecycleAction("checkout.session.async_payment_succeeded", "paid"),
  "fulfill",
);
assert.equal(
  checkoutLifecycleAction("checkout.session.async_payment_failed", "unpaid"),
  "release",
);
assert.equal(
  checkoutLifecycleAction("checkout.session.expired", "unpaid"),
  "expire",
);
assert.equal(checkoutLifecycleAction("charge.refunded", null), "ignore");

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

function checkoutSessionWithMetadata(
  metadata: Record<string, string>,
  overrides: Partial<Stripe.Checkout.Session> = {},
): Stripe.Checkout.Session {
  const base = checkoutSession();
  return checkoutSession({
    ...overrides,
    metadata: { ...base.metadata, ...metadata },
  });
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

function verifyInstallerSessionMapping() {
  const thirdParty = checkoutSessionWithMetadata({
    installer: "other",
    installerName: "  Solar\tPartners\r\nPte. Ltd.  ",
  });
  const paidBooking = paidBookingFromSession(thirdParty, paidAt);
  assert.equal(paidBooking.installerType, "other");
  assert.equal(
    paidBooking.installerName,
    "Solar Partners Pte. Ltd.",
    "Stripe metadata must be normalized before persistence",
  );
  const calendarVisit = maintenanceVisitFromSession(thirdParty);
  assert.equal(calendarVisit.installer, "other");
  assert.equal(
    calendarVisit.installerName,
    "Solar\tPartners\r\nPte. Ltd.",
    "the calendar formatter owns the final customer-safe normalization",
  );

  const legacyMissingName = checkoutSessionWithMetadata({
    installer: "other",
    installerName: "",
  });
  const legacyBooking = paidBookingFromSession(legacyMissingName, paidAt);
  assert.equal(legacyBooking.installerType, "other");
  assert.equal(
    legacyBooking.installerName,
    null,
    "a paid legacy third-party session without a name must remain replayable",
  );
  for (const legacyInvalidName of ["--- / ...", "A".repeat(121)]) {
    assert.equal(
      paidBookingFromSession(
        checkoutSessionWithMetadata({
          installer: "other",
          installerName: legacyInvalidName,
        }),
        paidAt,
      ).installerName,
      null,
      "invalid legacy installer-name metadata must not be persisted",
    );
  }

  const forgedFomoName = paidBookingFromSession(
    checkoutSessionWithMetadata({
      installer: "fomo",
      installerName: "Must Not Persist",
    }),
    paidAt,
  );
  assert.equal(forgedFomoName.installerType, "fomo");
  assert.equal(
    forgedFomoName.installerName,
    null,
    "names must be discarded from non-third-party sessions",
  );

  assert.throws(
    () =>
      paidBookingFromSession(
        checkoutSessionWithMetadata({ installer: "rto" }),
        paidAt,
      ),
    (error: unknown) =>
      error instanceof PermanentFulfillmentError &&
      error.code === "rto_not_sellable",
    "RTO payments must remain permanently rejected",
  );

  for (const [installer, expectedCode] of [
    ["", "missing_booking_metadata"],
    ["unknown", "invalid_installer"],
  ] as const) {
    assert.throws(
      () =>
        paidBookingFromSession(
          checkoutSessionWithMetadata({ installer }),
          paidAt,
        ),
      (error: unknown) =>
        error instanceof PermanentFulfillmentError &&
        error.code === expectedCode,
      "missing or unsupported installer metadata must never be relabelled as FOMO-installed",
    );
  }
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

function lifecycleBooking(): Booking {
  return {
    id: "30000000-0000-4000-8000-000000000003",
    reference: "FM-20260902-LIFE01",
    stripeCheckoutSessionId: "cs_test_lifecycle",
    stripePaymentIntentId: "pi_test_lifecycle",
    paymentStatus: "paid",
    fulfillmentStatus: "complete",
    customerName: "Lifecycle Test",
    customerEmail: "lifecycle@example.com",
    customerPhone: "+65 8000 0000",
    siteAddress: "1 Lifecycle Road, Singapore",
    installerType: "fomo",
    installerName: null,
    serviceCode: "ESSENTIAL",
    packageName: "Essential Health Check",
    kwp: "10.000",
    currency: "sgd",
    subtotalCents: 19900,
    gstCents: 1791,
    totalCents: 21691,
    slotStart: new Date("2026-10-05T01:00:00.000Z"),
    slotEnd: new Date("2026-10-05T05:00:00.000Z"),
    graphEventId: "graph-event-lifecycle",
    calendarStatus: "created",
    customerEmailStatus: "sent",
    operationsEmailStatus: "sent",
    rescheduleCount: 0,
    recordVersion: 1,
    paidAt,
    createdAt: paidAt,
    updatedAt: paidAt,
  };
}

class MemoryPaymentLifecycleStore implements PaymentLifecycleStore {
  booking = lifecycleBooking();
  eventStatus = new Map<string, "processing" | "processed" | "failed">();
  tokenActive = true;
  slotActive = true;

  async claimEvent(eventId: string) {
    const status = this.eventStatus.get(eventId);
    if (status === "processed") return "processed" as const;
    if (status === "processing") return "busy" as const;
    this.eventStatus.set(eventId, "processing");
    return "claimed" as const;
  }

  async findBookingByPaymentIntent(paymentIntentId: string) {
    return this.booking.stripePaymentIntentId === paymentIntentId
      ? this.booking
      : null;
  }

  async markAttention(input: {
    paymentStatus: LifecyclePaymentStatus;
  }) {
    this.booking.paymentStatus = input.paymentStatus;
    this.booking.fulfillmentStatus = "attention";
    return this.booking;
  }

  async completeFullRefund() {
    this.booking.paymentStatus = "refunded";
    this.booking.fulfillmentStatus = "complete";
    this.booking.calendarStatus = "cancelled";
    this.tokenActive = false;
    this.slotActive = false;
    return this.booking;
  }

  async completeEvent(eventId: string) {
    this.eventStatus.set(eventId, "processed");
  }

  async failEvent(eventId: string) {
    this.eventStatus.set(eventId, "failed");
  }
}

function lifecycleCharge(amountRefunded: number): Stripe.Charge {
  return {
    id: "ch_test_lifecycle",
    object: "charge",
    amount: 21691,
    amount_refunded: amountRefunded,
    currency: "sgd",
    payment_intent: "pi_test_lifecycle",
    refunded: amountRefunded === 21691,
  } as Stripe.Charge;
}

async function verifyPaymentLifecycle() {
  const fullStore = new MemoryPaymentLifecycleStore();
  let fullChargeLoads = 0;
  let cancellationCalls = 0;
  const fullServices = {
    store: fullStore,
    loadCharge: async () => {
      fullChargeLoads += 1;
      return lifecycleCharge(21691);
    },
    loadDispute: async () => {
      throw new Error("dispute must not load");
    },
    paymentBelongsToApplication: async () => true,
    cancelCalendar: async () => {
      cancellationCalls += 1;
    },
  };
  const fullInput = {
    eventId: "evt_full_refund",
    eventType: "charge.refunded" as const,
    objectId: "ch_test_lifecycle",
  };
  assert.deepEqual(
    await processPaymentLifecycleEvent(fullInput, fullServices),
    { status: "complete", outcome: "refunded" },
  );
  assert.equal(fullStore.booking.calendarStatus, "cancelled");
  assert.equal(fullStore.tokenActive, false);
  assert.equal(fullStore.slotActive, false);
  assert.deepEqual(
    await processPaymentLifecycleEvent(fullInput, fullServices),
    { status: "duplicate" },
  );
  assert.equal(fullChargeLoads, 1);
  assert.equal(cancellationCalls, 1);

  const partialStore = new MemoryPaymentLifecycleStore();
  let partialAlerts = 0;
  const partialServices = {
    store: partialStore,
    loadCharge: async () => lifecycleCharge(5000),
    loadDispute: async () => {
      throw new Error("dispute must not load");
    },
    paymentBelongsToApplication: async () => true,
    cancelCalendar: async () => {
      throw new Error("partial refund must retain the calendar event");
    },
    sendOperationsAlert: async () => {
      partialAlerts += 1;
    },
  };
  const partialInput = {
    eventId: "evt_partial_refund",
    eventType: "charge.refunded" as const,
    objectId: "ch_test_lifecycle",
  };
  assert.deepEqual(
    await processPaymentLifecycleEvent(partialInput, partialServices),
    { status: "complete", outcome: "partially_refunded" },
  );
  assert.equal(partialStore.booking.paymentStatus, "partially_refunded");
  assert.equal(partialStore.booking.fulfillmentStatus, "attention");
  assert.equal(partialStore.booking.calendarStatus, "created");
  assert.equal(partialStore.tokenActive, true);
  assert.equal(partialStore.slotActive, true);
  assert.deepEqual(
    await processPaymentLifecycleEvent(partialInput, partialServices),
    { status: "duplicate" },
  );
  assert.equal(partialAlerts, 1);

  const disputeStore = new MemoryPaymentLifecycleStore();
  let disputeAlerts = 0;
  const disputeInput = {
    eventId: "evt_dispute",
    eventType: "charge.dispute.created" as const,
    objectId: "dp_test_lifecycle",
  };
  assert.deepEqual(
    await processPaymentLifecycleEvent(disputeInput, {
      store: disputeStore,
      loadCharge: async () => lifecycleCharge(0),
      loadDispute: async () =>
        ({
          id: "dp_test_lifecycle",
          object: "dispute",
          amount: 21691,
          charge: "ch_test_lifecycle",
          currency: "sgd",
        }) as Stripe.Dispute,
      paymentBelongsToApplication: async () => true,
      cancelCalendar: async () => {
        throw new Error("a dispute must retain the calendar event");
      },
      sendOperationsAlert: async () => {
        disputeAlerts += 1;
      },
    }),
    { status: "complete", outcome: "disputed" },
  );
  assert.equal(disputeStore.booking.paymentStatus, "disputed");
  assert.equal(disputeStore.booking.calendarStatus, "created");
  assert.equal(disputeStore.tokenActive, true);
  assert.equal(disputeStore.slotActive, true);
  assert.equal(disputeAlerts, 1);

  const uncertainStore = new MemoryPaymentLifecycleStore();
  assert.deepEqual(
    await processPaymentLifecycleEvent(fullInput, {
      ...fullServices,
      store: uncertainStore,
      cancelCalendar: async () => {
        throw new Error("graph_delete_uncertain");
      },
    }),
    { status: "failed", reason: "graph_delete_uncertain" },
  );
  assert.equal(uncertainStore.booking.paymentStatus, "refunded");
  assert.equal(uncertainStore.booking.fulfillmentStatus, "attention");
  assert.equal(uncertainStore.booking.calendarStatus, "created");
  assert.equal(uncertainStore.tokenActive, true);
  assert.equal(uncertainStore.slotActive, true);

  const unrelatedStore = new MemoryPaymentLifecycleStore();
  unrelatedStore.booking.stripePaymentIntentId = "pi_known_booking";
  const unrelatedCharge = {
    ...lifecycleCharge(5000),
    payment_intent: "pi_unrelated",
  } as Stripe.Charge;
  assert.deepEqual(
    await processPaymentLifecycleEvent(
      {
        eventId: "evt_unrelated_refund",
        eventType: "charge.refunded",
        objectId: unrelatedCharge.id,
      },
      {
        ...fullServices,
        store: unrelatedStore,
        loadCharge: async () => unrelatedCharge,
        paymentBelongsToApplication: async () => false,
      },
    ),
    { status: "ignored", reason: "unrelated_payment" },
    "unrelated Stripe activity must be acknowledged without endless retries",
  );
  assert.deepEqual(
    await processPaymentLifecycleEvent(
      {
        eventId: "evt_unrelated_refund",
        eventType: "charge.refunded",
        objectId: unrelatedCharge.id,
      },
      {
        ...fullServices,
        store: unrelatedStore,
        loadCharge: async () => unrelatedCharge,
        paymentBelongsToApplication: async () => false,
      },
    ),
    { status: "duplicate" },
    "an ignored external event must still be durably idempotent",
  );
  assert.deepEqual(
    await processPaymentLifecycleEvent(
      {
        eventId: "evt_unrelated_dispute",
        eventType: "charge.dispute.created",
        objectId: "dp_unrelated",
      },
      {
        ...fullServices,
        store: unrelatedStore,
        loadCharge: async () => unrelatedCharge,
        loadDispute: async () =>
          ({
            id: "dp_unrelated",
            object: "dispute",
            amount: 5000,
            charge: unrelatedCharge.id,
            currency: "sgd",
          }) as Stripe.Dispute,
        paymentBelongsToApplication: async () => false,
      },
    ),
    { status: "ignored", reason: "unrelated_payment" },
    "an unrelated dispute must also be acknowledged without retries",
  );

  const delayedBookingStore = new MemoryPaymentLifecycleStore();
  delayedBookingStore.booking.stripePaymentIntentId = "pi_not_persisted_yet";
  const appCharge = {
    ...lifecycleCharge(5000),
    payment_intent: "pi_app_booking_pending",
  } as Stripe.Charge;
  assert.deepEqual(
    await processPaymentLifecycleEvent(
      {
        eventId: "evt_app_booking_pending",
        eventType: "charge.refunded",
        objectId: appCharge.id,
      },
      {
        ...fullServices,
        store: delayedBookingStore,
        loadCharge: async () => appCharge,
        paymentBelongsToApplication: async () => true,
      },
    ),
    { status: "failed", reason: "booking_not_found_yet" },
    "an app-owned payment received out of order must remain retryable",
  );
}

async function main() {
  await verifyTokens();
  verifyInstallerSessionMapping();
  await verifyIdempotentFulfillment();
  await verifyRetryRecovery();
  await verifyPermanentRejection();
  await verifyDatabaseAndConcurrencyFailures();
  await verifyPaymentLifecycle();
  console.log("Portal fulfilment and access verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
