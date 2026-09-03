import assert from "node:assert/strict";
import { calendarIdMatchingName } from "../lib/calendar";
import {
  graphDeletionWasAlreadyComplete,
  splitScheduleRange,
} from "../lib/microsoft";

assert.equal(
  calendarIdMatchingName(
    [
      { id: "primary", name: "Calendar" },
      { id: "maintenance", name: "Fomo Maintenance" },
    ],
    "Fomo Maintenance",
  ),
  "maintenance",
);

assert.equal(
  calendarIdMatchingName(
    [{ id: "maintenance", name: "FOMO MAINTENANCE" }],
    " fomo maintenance ",
  ),
  "maintenance",
);

assert.throws(
  () =>
    calendarIdMatchingName(
      [{ id: "primary", name: "Calendar" }],
      "Fomo Maintenance",
    ),
  /was not found/,
);

const scheduleStart = new Date("2026-09-02T00:00:00.000Z");
const scheduleEnd = new Date("2026-12-02T00:00:00.000Z");
const scheduleWindows = splitScheduleRange(scheduleStart, scheduleEnd);
assert.equal(scheduleWindows.length, 2);
assert.equal(scheduleWindows[0]?.start.toISOString(), scheduleStart.toISOString());
assert.equal(
  scheduleWindows.at(-1)?.end.toISOString(),
  scheduleEnd.toISOString(),
);
for (const window of scheduleWindows) {
  assert.ok(
    window.end.getTime() - window.start.getTime() <=
      60 * 24 * 60 * 60 * 1_000,
    "Microsoft getSchedule windows must remain below its 62-day limit",
  );
}

assert.throws(
  () =>
    calendarIdMatchingName(
      [
        { id: "one", name: "Fomo Maintenance" },
        { id: "two", name: "Fomo Maintenance" },
      ],
      "Fomo Maintenance",
    ),
  /More than one/,
);

assert.equal(graphDeletionWasAlreadyComplete({ statusCode: 404 }), true);
assert.equal(
  graphDeletionWasAlreadyComplete({ cause: { status: 404 } }),
  true,
  "a retry must treat a nested Graph 404 as confirmed deletion",
);
assert.equal(graphDeletionWasAlreadyComplete({ statusCode: "404" }), true);
assert.equal(graphDeletionWasAlreadyComplete({ statusCode: 503 }), false);

console.log("verify:calendar passed");
