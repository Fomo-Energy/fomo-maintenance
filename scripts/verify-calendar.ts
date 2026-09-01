import assert from "node:assert/strict";
import { calendarIdMatchingName } from "../lib/calendar";

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

console.log("verify:calendar passed");
