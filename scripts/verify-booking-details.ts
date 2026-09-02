import assert from "node:assert/strict";
import {
  hasSavedBookingDetails,
  parseSavedBookingDetails,
  serializeBookingDetails,
  type SavedBookingDetails,
} from "../lib/booking-details";

const details: SavedBookingDetails = {
  name: "Test Owner",
  phone: "+65 8123 4567",
  email: "owner@example.com",
  address: "1 Test Street, Singapore",
};

assert.deepEqual(parseSavedBookingDetails(serializeBookingDetails(details)), details);
assert.equal(parseSavedBookingDetails(null), null);
assert.equal(parseSavedBookingDetails("not json"), null);
assert.equal(parseSavedBookingDetails("[]"), null);
assert.equal(
  parseSavedBookingDetails(JSON.stringify({ name: "x".repeat(200) }))?.name
    .length,
  120,
  "Restored fields must respect the form's maximum lengths",
);
assert.deepEqual(
  parseSavedBookingDetails(
    JSON.stringify({ name: "Saved Name", phone: 123, extra: "ignored" }),
  ),
  { name: "Saved Name", phone: "", email: "", address: "" },
);
assert.equal(
  hasSavedBookingDetails({ name: "", phone: " ", email: "", address: "" }),
  false,
);

console.log("verify:booking-details passed");
