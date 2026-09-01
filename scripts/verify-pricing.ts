import assert from "node:assert/strict";
import {
  parseCheckoutRequest,
  priceLineItems,
  quoteForCheckout,
} from "../lib/booking";
import {
  cleaningPriceSgd,
  electricalUpgradePriceSgd,
  essentialPriceSgd,
  quote,
  quoteTotalSgd,
  type ServiceLevel,
} from "../lib/pricing";

const matrix = [
  { kwp: 5, essential: 199, electrical: 374, cleaning: 450, essentialClean: 649, electricalClean: 824 },
  { kwp: 10, essential: 199, electrical: 399, cleaning: 450, essentialClean: 649, electricalClean: 849 },
  { kwp: 20, essential: 249, electrical: 499, cleaning: 510, essentialClean: 759, electricalClean: 1009 },
  { kwp: 30, essential: 299, electrical: 599, cleaning: 570, essentialClean: 869, electricalClean: 1169 },
  { kwp: 40, essential: 349, electrical: 699, cleaning: 630, essentialClean: 979, electricalClean: 1329 },
];

for (const expected of matrix) {
  assert.equal(essentialPriceSgd(expected.kwp), expected.essential);
  assert.equal(cleaningPriceSgd(expected.kwp), expected.cleaning);
  assert.equal(
    quoteTotalSgd({
      kwp: expected.kwp,
      serviceLevel: "electrical_assurance",
    }),
    expected.electrical,
  );
  assert.equal(
    quoteTotalSgd({ kwp: expected.kwp, cleaning: true }),
    expected.essentialClean,
  );
  assert.equal(
    quoteTotalSgd({
      kwp: expected.kwp,
      serviceLevel: "electrical_assurance",
      cleaning: true,
    }),
    expected.electricalClean,
  );
}

assert.equal(essentialPriceSgd(10.1), 200, "Essential rounds per line item");
assert.equal(
  electricalUpgradePriceSgd(10.1),
  201,
  "Electrical upgrade rounds independently",
);
assert.equal(cleaningPriceSgd(10.1), 451, "Cleaning rounds independently");

const codeCases: Array<{
  serviceLevel: ServiceLevel;
  cleaning: boolean;
  code: string;
}> = [
  { serviceLevel: "essential", cleaning: false, code: "ESSENTIAL" },
  { serviceLevel: "essential", cleaning: true, code: "ESSENTIAL_CLEAN" },
  {
    serviceLevel: "electrical_assurance",
    cleaning: false,
    code: "ELECTRICAL_ASSURANCE",
  },
  {
    serviceLevel: "electrical_assurance",
    cleaning: true,
    code: "ELECTRICAL_CLEAN",
  },
];
for (const expected of codeCases) {
  assert.equal(
    quote({
      kwp: 10,
      installer: "fomo",
      serviceLevel: expected.serviceLevel,
      cleaning: expected.cleaning,
      monitoring: false,
    }).serviceCode,
    expected.code,
  );
}

const complete = quote({
  kwp: 20,
  installer: "fomo",
  serviceLevel: "electrical_assurance",
  cleaning: true,
  monitoring: true,
});
assert.equal(complete.totalSgd, 1129);
assert.equal(
  priceLineItems(complete).reduce((sum, item) => sum + item.amountSgd, 0),
  complete.totalSgd,
  "Stripe line items must sum to the server quote",
);

const validCheckout = {
  kwp: 10,
  installer: "fomo",
  serviceLevel: "essential",
  cleaning: false,
  monitoring: false,
  name: "Test Owner",
  phone: "+65 8123 4567",
  email: "owner@example.com",
  address: "1 Test Street, Singapore",
  slotStart: "2026-09-02T01:00:00.000Z",
  slotEnd: "2026-09-02T05:00:00.000Z",
};
assert.equal(parseCheckoutRequest(validCheckout).serviceLevel, "essential");
const forgedCheckout = parseCheckoutRequest({
  ...validCheckout,
  totalSgd: 1,
  essentialSgd: 1,
});
assert.equal(
  quoteForCheckout(forgedCheckout).totalSgd,
  199,
  "Browser-supplied totals must be ignored and recomputed on the server",
);
assert.throws(
  () => parseCheckoutRequest({ ...validCheckout, kwp: "10junk" }),
  /Enter a system size/,
  "Malformed numeric strings must not be partially parsed",
);
const normalizedCheckout = parseCheckoutRequest({
  ...validCheckout,
  name: "Test Owner\nACCESS CONFIRMED",
  address: "1 Test Street\r\nROOF ACCESS CONFIRMED",
});
assert.equal(normalizedCheckout.name, "Test Owner ACCESS CONFIRMED");
assert.equal(
  normalizedCheckout.address,
  "1 Test Street ROOF ACCESS CONFIRMED",
  "Calendar-bound customer text must not create forged instruction lines",
);
assert.throws(
  () => parseCheckoutRequest({ ...validCheckout, serviceLevel: "invalid" }),
  /Choose a service level/,
);
assert.throws(
  () =>
    parseCheckoutRequest({
      ...validCheckout,
      email: `${"a".repeat(243)}@example.com`,
    }),
  /Enter an email address/,
  "Stripe-bound email input must be limited to 254 characters",
);
assert.throws(
  () =>
    parseCheckoutRequest({
      ...validCheckout,
      installer: "other",
      monitoring: true,
    }),
  /only available for compatible FOMO-installed systems/,
);
assert.equal(
  quote({
    kwp: 10,
    installer: "rto",
    serviceLevel: "essential",
    cleaning: false,
    monitoring: false,
  }).sellable,
  false,
);

console.log("verify:pricing passed");
