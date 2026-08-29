import assert from "node:assert/strict";
import {
  addCalendarDays,
  filterFreeSlots,
  findCandidateSlot,
  generateCandidateSlots,
  isoSingapore,
  singaporeDateKey,
  slotIsFree,
  weekdayUtcIndex,
} from "../lib/slots";

// Wednesday 2 Sep 2026, 08:00 SGT (00:00 UTC). First slot that day is 09:00.
const wedMorning = new Date("2026-09-02T00:00:00.000Z");
assert.equal(singaporeDateKey(wedMorning), "2026-09-02");
assert.equal(weekdayUtcIndex("2026-09-02"), 3);

const morningSlots = generateCandidateSlots(wedMorning);
assert.equal(morningSlots[0]?.start, isoSingapore("2026-09-02", 9));
assert.equal(morningSlots[0]?.end, isoSingapore("2026-09-02", 11));
assert.equal(morningSlots[0]?.timeLabel, "09:00–11:00");

const weekdays = new Set(morningSlots.map((slot) => slot.dateKey));
assert.equal(weekdays.size, 14);
assert.ok(![...weekdays].some((key) => [0, 6].includes(weekdayUtcIndex(key))));
assert.equal([...weekdays].at(-1), "2026-09-21");
assert.equal(morningSlots.length, 14 * 4);

// 11:30 SGT: 09:00 and 11:00 slots have started.
const wedLateMorning = new Date("2026-09-02T03:30:00.000Z");
const remaining = generateCandidateSlots(wedLateMorning);
assert.equal(remaining[0]?.start, isoSingapore("2026-09-02", 13));
assert.equal(remaining.length, 14 * 4 - 2);

// Saturday should skip to Monday.
const saturday = new Date("2026-09-05T02:00:00.000Z");
assert.equal(singaporeDateKey(saturday), "2026-09-05");
const fromSaturday = generateCandidateSlots(saturday);
assert.equal(fromSaturday[0]?.dateKey, "2026-09-07");
assert.equal(new Set(fromSaturday.map((slot) => slot.dateKey)).size, 14);

const busySlot = findCandidateSlot(
  isoSingapore("2026-09-02", 9),
  isoSingapore("2026-09-02", 11),
  wedMorning,
);
assert.ok(busySlot);
assert.equal(
  slotIsFree(busySlot, [
    {
      start: new Date("2026-09-02T01:00:00.000Z"),
      end: new Date("2026-09-02T03:00:00.000Z"),
    },
  ]),
  false,
);
assert.equal(
  slotIsFree(busySlot, [
    {
      start: new Date("2026-09-02T03:00:00.000Z"),
      end: new Date("2026-09-02T05:00:00.000Z"),
    },
  ]),
  true,
);

const free = filterFreeSlots(morningSlots.slice(0, 4), [
  {
    start: new Date("2026-09-02T01:00:00.000Z"),
    end: new Date("2026-09-02T03:00:00.000Z"),
  },
]);
assert.equal(free.length, 3);
assert.ok(!free.some((slot) => slot.start === isoSingapore("2026-09-02", 9)));

assert.equal(addCalendarDays("2026-09-02", 1), "2026-09-03");
assert.equal(
  findCandidateSlot("nope", "nope", wedMorning),
  undefined,
);

console.log("verify:slots passed");
