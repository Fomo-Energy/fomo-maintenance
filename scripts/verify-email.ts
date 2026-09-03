import assert from "node:assert/strict";
import type { Booking } from "../db/schema";
import {
  deliverEmailOnce,
  type EmailClaim,
  type EmailDeliveryStore,
} from "../lib/portal/email-flow";
import {
  bookingCustomerEmail,
  bookingOperationsEmail,
  rescheduleCustomerEmail,
  rescheduleOperationsEmail,
} from "../lib/portal/email-templates";
import {
  graphClientRequestId,
  graphProviderReference,
  graphSendMailPayload,
} from "../lib/graph-email";

const booking: Booking = {
  id: "10000000-0000-4000-8000-000000000001",
  reference: "FM-20260903-EMAIL01",
  stripeCheckoutSessionId: "cs_test_email",
  stripePaymentIntentId: "pi_test_email",
  paymentStatus: "paid",
  fulfillmentStatus: "processing",
  customerName: "Customer <Test>",
  customerEmail: "customer@example.com",
  customerPhone: "+65 8000 0000",
  siteAddress: "1 Test Road & Annex, Singapore",
  serviceCode: "ESSENTIAL",
  packageName: "Essential Health Check",
  kwp: "10.000",
  currency: "sgd",
  subtotalCents: 19900,
  gstCents: 1791,
  totalCents: 21691,
  slotStart: new Date("2026-10-05T01:00:00.000Z"),
  slotEnd: new Date("2026-10-05T05:00:00.000Z"),
  graphEventId: "graph-event-email",
  calendarStatus: "created",
  customerEmailStatus: "pending",
  operationsEmailStatus: "pending",
  rescheduleCount: 0,
  recordVersion: 1,
  paidAt: new Date("2026-09-03T01:00:00.000Z"),
  createdAt: new Date("2026-09-03T01:00:00.000Z"),
  updatedAt: new Date("2026-09-03T01:00:00.000Z"),
};

class MemoryDeliveryStore implements EmailDeliveryStore {
  state = new Map<
    string,
    { id: string; status: "processing" | "sent" | "failed"; providerId: string | null }
  >();
  completeCalls = 0;
  failCalls = 0;

  async claim(input: { idempotencyKey: string }): Promise<EmailClaim> {
    const existing = this.state.get(input.idempotencyKey);
    if (existing?.status === "sent") {
      return { status: "sent", providerMessageId: existing.providerId };
    }
    if (existing?.status === "processing") return { status: "busy" };
    const id = existing?.id || `delivery-${this.state.size + 1}`;
    this.state.set(input.idempotencyKey, {
      id,
      status: "processing",
      providerId: null,
    });
    return { status: "send", deliveryId: id };
  }

  async complete(deliveryId: string, providerMessageId: string) {
    const entry = [...this.state.entries()].find(
      ([, value]) => value.id === deliveryId,
    );
    assert.ok(entry);
    this.state.set(entry[0], {
      id: deliveryId,
      status: "sent",
      providerId: providerMessageId,
    });
    this.completeCalls += 1;
  }

  async fail(deliveryId: string) {
    const entry = [...this.state.entries()].find(
      ([, value]) => value.id === deliveryId,
    );
    assert.ok(entry);
    this.state.set(entry[0], {
      id: deliveryId,
      status: "failed",
      providerId: null,
    });
    this.failCalls += 1;
  }
}

async function verifyDeliveryIdempotency() {
  const store = new MemoryDeliveryStore();
  let sends = 0;
  const input = {
    bookingId: booking.id,
    messageKind: "booking_customer",
    recipient: "customer@example.com",
    idempotencyKey: `fm-booking-customer-${booking.id}-v1`,
  };
  const services = {
    store,
    send: async () => {
      sends += 1;
      return "microsoft-graph-message-1";
    },
  };
  assert.deepEqual(await deliverEmailOnce(input, services), {
    status: "sent",
    providerMessageId: "microsoft-graph-message-1",
  });
  assert.deepEqual(await deliverEmailOnce(input, services), {
    status: "duplicate",
    providerMessageId: "microsoft-graph-message-1",
  });
  assert.equal(sends, 1, "a completed delivery must not be sent twice");

  let attempts = 0;
  const retryInput = {
    ...input,
    idempotencyKey: `fm-booking-operations-${booking.id}-v1`,
  };
  await assert.rejects(() =>
    deliverEmailOnce(retryInput, {
      store,
      send: async () => {
        attempts += 1;
        throw new Error("temporary provider failure");
      },
    }),
  );
  assert.equal(store.failCalls, 1);
  assert.deepEqual(
    await deliverEmailOnce(retryInput, {
      store,
      send: async () => {
        attempts += 1;
        return "microsoft-graph-message-recovered";
      },
    }),
    { status: "sent", providerMessageId: "microsoft-graph-message-recovered" },
  );
  assert.equal(attempts, 2);
}

function verifyGraphRequest() {
  const idempotencyKey = `fm-booking-customer-${booking.id}-v1`;
  const rendered = bookingCustomerEmail(
    booking,
    "https://example.com/manage#access=fake-token-for-rendering-only",
  );
  const payload = graphSendMailPayload({
    to: ["customer@example.com"],
    replyTo: "service@fomo.energy",
    message: rendered,
    idempotencyKey,
    bookingReference: booking.reference,
    messageKind: "booking_customer",
  });
  assert.equal(payload.saveToSentItems, true);
  assert.equal(payload.message.body.contentType, "HTML");
  assert.equal(
    payload.message.toRecipients[0]?.emailAddress.address,
    "customer@example.com",
  );
  assert.equal(
    payload.message.replyTo[0]?.emailAddress.address,
    "service@fomo.energy",
  );
  assert.deepEqual(
    payload.message.internetMessageHeaders.map(({ name }) => name),
    [
      "x-fomo-idempotency-key",
      "x-fomo-booking-reference",
      "x-fomo-message-kind",
    ],
  );
  assert.match(
    graphClientRequestId(idempotencyKey),
    /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  assert.equal(
    graphProviderReference(idempotencyKey),
    graphProviderReference(idempotencyKey),
    "the accepted Graph request reference must be deterministic for a retry",
  );
  assert.throws(
    () =>
      graphSendMailPayload({
        to: ["customer@example.com"],
        replyTo: "service@fomo.energy",
        message: rendered,
        idempotencyKey: "unsafe\r\nheader",
        bookingReference: booking.reference,
        messageKind: "booking_customer",
      }),
    /ASCII value/,
  );
}

function verifyTemplates() {
  const manageUrl =
    "https://example.com/manage#access=fake-token-for-rendering-only";
  const customer = bookingCustomerEmail(booking, manageUrl);
  assert.match(customer.subject, /Booking confirmed/);
  assert.match(customer.text, /S\$199\.00/);
  assert.match(customer.text, /S\$17\.91/);
  assert.match(customer.text, /S\$216\.91/);
  assert.match(customer.text, /Monday, 5 October 2026, 09:00–13:00 SGT/);
  assert.match(customer.text, /fake-token-for-rendering-only/);
  assert.doesNotMatch(customer.html, /Customer <Test>/);
  assert.match(customer.html, /Customer &lt;Test&gt;/);
  assert.match(customer.html, /1 Test Road &amp; Annex/);

  const operations = bookingOperationsEmail(booking);
  assert.match(operations.text, /customer@example\.com/);
  assert.doesNotMatch(
    operations.text + operations.html,
    /fake-token-for-rendering-only/,
    "operations must not receive the customer bearer credential",
  );

  const previousSlotStart = new Date("2026-10-05T01:00:00.000Z");
  const previousSlotEnd = new Date("2026-10-05T05:00:00.000Z");
  const newSlotStart = new Date("2026-10-06T05:00:00.000Z");
  const newSlotEnd = new Date("2026-10-06T09:00:00.000Z");
  const rescheduleCustomer = rescheduleCustomerEmail({
    booking,
    previousSlotStart,
    previousSlotEnd,
    newSlotStart,
    newSlotEnd,
    manageUrl,
  });
  const rescheduleOperations = rescheduleOperationsEmail({
    booking,
    previousSlotStart,
    previousSlotEnd,
    newSlotStart,
    newSlotEnd,
  });
  assert.match(rescheduleCustomer.text, /Previous visit: Monday/);
  assert.match(rescheduleCustomer.text, /New visit: Tuesday/);
  assert.match(rescheduleCustomer.text, /fake-token-for-rendering-only/);
  assert.doesNotMatch(rescheduleOperations.text, /fake-token/);

  const historicalTestingBooking = {
    ...booking,
    serviceCode: "TESTING",
    packageName: "Testing — no service offered",
  };
  const testingCustomer = rescheduleCustomerEmail({
    booking: historicalTestingBooking,
    previousSlotStart,
    previousSlotEnd,
    newSlotStart,
    newSlotEnd,
    manageUrl,
  });
  const testingOperations = rescheduleOperationsEmail({
    booking: historicalTestingBooking,
    previousSlotStart,
    previousSlotEnd,
    newSlotStart,
    newSlotEnd,
  });
  assert.match(testingCustomer.subject, /^\[TESTING\]/);
  assert.match(testingCustomer.text, /no inspection, maintenance, cleaning/);
  assert.match(testingCustomer.html, /no inspection, maintenance, cleaning/);
  assert.match(testingOperations.subject, /^\[TESTING\]/);
  assert.match(testingOperations.text, /no inspection, maintenance, cleaning/);
  assert.match(testingOperations.html, /no inspection, maintenance, cleaning/);
}

async function main() {
  verifyTemplates();
  verifyGraphRequest();
  await verifyDeliveryIdempotency();
  console.log("Transactional email rendering and idempotency verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
