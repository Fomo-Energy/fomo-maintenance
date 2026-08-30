import assert from "node:assert/strict";
import {
  SLOT_HOURS,
  addCalendarDays,
  addCalendarMonths,
  bookingHorizonEnd,
  filterFreeSlots,
  findCandidateSlot,
  formatTimeLabel,
  generateCandidateSlots,
  isoSingapore,
  monthCells,
  singaporeDateKey,
  slotIsFree,
  weekdayUtcIndex,
} from "../lib/slots";

assert.equal(SLOT_HOURS, 4);
assert.equal(formatTimeLabel(9), "09:00–13:00");
assert.equal(formatTimeLabel(13), "13:00–17:00");
assert.equal(addCalendarMonths("2026-09-02", 3), "2026-12-02");
assert.equal(addCalendarMonths("2026-08-31", 3), "2026-11-30");

// Wednesday 2 Sep 2026, 08:00 SGT (00:00 UTC). First slot that day is 09:00–13:00.
const wedMorning = new Date("2026-09-02T00:00:00.000Z");
assert.equal(singaporeDateKey(wedMorning), "2026-09-02");
assert.equal(weekdayUtcIndex("2026-09-02"), 3);
assert.equal(bookingHorizonEnd(wedMorning), "2026-12-02");

const morningSlots = generateCandidateSlots(wedMorning);
assert.equal(morningSlots[0]?.start, isoSingapore("2026-09-02", 9));
assert.equal(morningSlots[0]?.end, isoSingapore("2026-09-02", 13));
assert.equal(morningSlots[0]?.timeLabel, "09:00–13:00");
assert.equal(morningSlots[1]?.start, isoSingapore("2026-09-02", 13));
assert.equal(morningSlots[1]?.end, isoSingapore("2026-09-02", 17));
assert.equal(morningSlots[1]?.timeLabel, "13:00–17:00");

const weekdays = new Set(morningSlots.map((slot) => slot.dateKey));
assert.ok(weekdays.size > 50);
assert.ok(![...weekdays].some((key) => [0, 6].includes(weekdayUtcIndex(key))));
assert.equal([...weekdays].at(-1), "2026-12-02");
assert.ok(!weekdays.has("2026-09-05"));
assert.ok(!weekdays.has("2026-12-03"));
assert.equal(
  morningSlots.filter((slot) => slot.dateKey === "2026-09-02").length,
  2,
);
for (const slot of morningSlots) {
  assert.equal(findCandidateSlot(slot.start, slot.end, wedMorning)?.start, slot.start);
  assert.equal(
    (new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 3_600_000,
    4,
  );
}

const twoHourLegacy = findCandidateSlot(
  isoSingapore("2026-09-02", 9),
  isoSingapore("2026-09-02", 11),
  wedMorning,
);
assert.equal(twoHourLegacy, undefined);

// 11:30 SGT: the 09:00–13:00 window has already started.
const wedLateMorning = new Date("2026-09-02T03:30:00.000Z");
const remaining = generateCandidateSlots(wedLateMorning);
assert.equal(remaining[0]?.start, isoSingapore("2026-09-02", 13));
assert.equal(remaining[0]?.end, isoSingapore("2026-09-02", 17));
assert.ok(!remaining.some((slot) => slot.start === isoSingapore("2026-09-02", 9)));

// Saturday should skip to Monday.
const saturday = new Date("2026-09-05T02:00:00.000Z");
assert.equal(singaporeDateKey(saturday), "2026-09-05");
const fromSaturday = generateCandidateSlots(saturday);
assert.equal(fromSaturday[0]?.dateKey, "2026-09-07");
assert.equal(new Set(fromSaturday.map((slot) => slot.dateKey)).size > 50, true);

const busySlot = findCandidateSlot(
  isoSingapore("2026-09-02", 9),
  isoSingapore("2026-09-02", 13),
  wedMorning,
);
assert.ok(busySlot);
assert.equal(
  slotIsFree(busySlot, [
    {
      start: new Date("2026-09-02T01:00:00.000Z"),
      end: new Date("2026-09-02T05:00:00.000Z"),
    },
  ]),
  false,
);
assert.equal(
  slotIsFree(busySlot, [
    {
      start: new Date("2026-09-02T05:00:00.000Z"),
      end: new Date("2026-09-02T09:00:00.000Z"),
    },
  ]),
  true,
);

const afternoon = findCandidateSlot(
  isoSingapore("2026-09-02", 13),
  isoSingapore("2026-09-02", 17),
  wedMorning,
);
assert.ok(afternoon);
const free = filterFreeSlots([busySlot, afternoon], [
  {
    start: new Date("2026-09-02T01:00:00.000Z"),
    end: new Date("2026-09-02T05:00:00.000Z"),
  },
]);
assert.equal(free.length, 1);
assert.equal(free[0]?.start, isoSingapore("2026-09-02", 13));

assert.equal(addCalendarDays("2026-09-02", 1), "2026-09-03");
assert.equal(findCandidateSlot("nope", "nope", wedMorning), undefined);

const september = monthCells("2026-09");
assert.equal(september[0]?.dateKey, "2026-08-31");
assert.equal(september[0]?.inMonth, false);
assert.equal(september[1]?.dateKey, "2026-09-01");
assert.equal(september[1]?.inMonth, true);
assert.equal(september.length % 7, 0);

console.log("verify:slots passed");
