import assert from "node:assert/strict";
import {
  MAX_CUSTOMER_RESCHEDULES,
  RESCHEDULE_CUTOFF_MS,
  ReschedulePolicyError,
  rescheduleEligibility,
  validateRescheduleRequest,
} from "../lib/portal/reschedule-policy";
import {
  executeCustomerReschedule,
  type RescheduleFlowServices,
} from "../lib/portal/reschedule-flow";
import type { PreparedReschedule } from "../lib/portal/rescheduling";
import { generateCandidateSlots } from "../lib/slots";

const now = new Date("2026-09-02T00:00:00.000Z");
const candidate = generateCandidateSlots(now)[4];
assert.ok(candidate);

const eligible = rescheduleEligibility(
  {
    paymentStatus: "paid",
    calendarStatus: "created",
    graphEventId: "graph-event-1",
    slotStart: new Date(now.getTime() + RESCHEDULE_CUTOFF_MS),
    rescheduleCount: 0,
  },
  now,
);
assert.deepEqual(eligible, {
  allowed: true,
  changesRemaining: MAX_CUSTOMER_RESCHEDULES,
});

assert.equal(
  rescheduleEligibility(
    {
      paymentStatus: "paid",
      calendarStatus: "created",
      graphEventId: "graph-event-1",
      slotStart: new Date(now.getTime() + RESCHEDULE_CUTOFF_MS - 1),
      rescheduleCount: 0,
    },
    now,
  ).allowed,
  false,
  "online changes must close 48 hours before the current visit",
);
assert.equal(
  rescheduleEligibility(
    {
      paymentStatus: "paid",
      calendarStatus: "created",
      graphEventId: "graph-event-1",
      slotStart: new Date(now.getTime() + 10 * RESCHEDULE_CUTOFF_MS),
      rescheduleCount: 2,
    },
    now,
  ).allowed,
  false,
  "a booking must allow no more than two customer changes",
);
assert.equal(
  rescheduleEligibility(
    {
      paymentStatus: "refunded",
      calendarStatus: "created",
      graphEventId: "graph-event-1",
      slotStart: new Date(now.getTime() + 10 * RESCHEDULE_CUTOFF_MS),
      rescheduleCount: 0,
    },
    now,
  ).allowed,
  false,
  "only paid bookings with a confirmed Graph event may be changed",
);

const validated = validateRescheduleRequest({
  requestKey: "30000000-0000-4000-8000-000000000003",
  slotStart: candidate.start,
  slotEnd: candidate.end,
  currentSlotStart: new Date("2026-10-01T01:00:00.000Z"),
  currentSlotEnd: new Date("2026-10-01T05:00:00.000Z"),
  now,
});
assert.equal(validated.slot.start, candidate.start);

assert.throws(
  () =>
    validateRescheduleRequest({
      requestKey: "not-a-uuid",
      slotStart: candidate.start,
      slotEnd: candidate.end,
      currentSlotStart: new Date("2026-10-01T01:00:00.000Z"),
      currentSlotEnd: new Date("2026-10-01T05:00:00.000Z"),
      now,
    }),
  ReschedulePolicyError,
);
assert.throws(
  () =>
    validateRescheduleRequest({
      requestKey: "30000000-0000-4000-8000-000000000004",
      slotStart: candidate.start,
      slotEnd: candidate.end,
      currentSlotStart: new Date(candidate.start),
      currentSlotEnd: new Date(candidate.end),
      now,
    }),
  (error: unknown) =>
    error instanceof ReschedulePolicyError && error.code === "same_slot",
);

function preparedReschedule(resumed = false): PreparedReschedule {
  return {
    resumed,
    booking: {
      id: "10000000-0000-4000-8000-000000000001",
      graphEventId: "graph-event-1",
      recordVersion: 1,
      rescheduleCount: 0,
    },
    request: {
      id: "20000000-0000-4000-8000-000000000002",
      status: "processing",
      requestedSlotStart: new Date(candidate.start),
      requestedSlotEnd: new Date(candidate.end),
    },
  } as PreparedReschedule;
}

function flowServices(
  calls: string[],
  overrides: Partial<RescheduleFlowServices> = {},
): RescheduleFlowServices {
  return {
    async eventTimeMatches() {
      calls.push("matches");
      return false;
    },
    async slotIsAvailable() {
      calls.push("available");
      return true;
    },
    async updateEvent() {
      calls.push("graph");
    },
    async complete() {
      calls.push("database");
      return { rescheduleCount: 1 };
    },
    async fail() {
      calls.push("fail");
    },
    ...overrides,
  };
}

async function verifyFlow() {
const successCalls: string[] = [];
assert.deepEqual(
  await executeCustomerReschedule(
    preparedReschedule(),
    flowServices(successCalls),
  ),
  { status: "complete", rescheduleCount: 1 },
);
assert.deepEqual(
  successCalls,
  ["available", "graph", "database"],
  "Graph must change before the booking database becomes authoritative",
);

const conflictCalls: string[] = [];
assert.deepEqual(
  await executeCustomerReschedule(
    preparedReschedule(),
    flowServices(conflictCalls, {
      async slotIsAvailable() {
        conflictCalls.push("available");
        return false;
      },
    }),
  ),
  { status: "conflict" },
);
assert.deepEqual(conflictCalls, ["available", "fail"]);

const resumeCalls: string[] = [];
assert.deepEqual(
  await executeCustomerReschedule(
    preparedReschedule(true),
    flowServices(resumeCalls, {
      async eventTimeMatches() {
        resumeCalls.push("matches");
        return true;
      },
    }),
  ),
  { status: "complete", rescheduleCount: 1 },
);
assert.deepEqual(
  resumeCalls,
  ["matches", "database"],
  "a retry must finalize an event already moved by Graph without moving it again",
);

const uncertainCalls: string[] = [];
await assert.rejects(
  () =>
    executeCustomerReschedule(
      preparedReschedule(),
      flowServices(uncertainCalls, {
        async updateEvent() {
          uncertainCalls.push("graph");
          throw new Error("uncertain_graph_result");
        },
      }),
    ),
  /uncertain_graph_result/,
);
assert.deepEqual(
  uncertainCalls,
  ["available", "graph"],
  "an uncertain Graph result must retain the request for idempotent retry",
);
}

verifyFlow()
  .then(() => {
    console.log("Customer rescheduling policy verification passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
