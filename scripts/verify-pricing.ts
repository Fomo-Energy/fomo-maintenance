import assert from "node:assert/strict";
import {
  parseCheckoutRequest,
  priceBreakdown,
  priceLineItems,
  quoteForCheckout,
  sgdToCents,
} from "../lib/booking";
import {
  cleaningPriceSgd,
  electricalUpgradePriceSgd,
  essentialPriceSgd,
  formatSgd,
  gstSgdForLineItems,
  quote,
  quoteTotalSgd,
  totalIncludingGstSgd,
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
    quote({
      kwp: expected.kwp,
      installer: "fomo",
      serviceLevel: "electrical_assurance",
      cleaning: false,
      testing: false,
    }).subtotalSgd,
    expected.electrical,
  );
  assert.equal(
    quote({
      kwp: expected.kwp,
      installer: "fomo",
      serviceLevel: "essential",
      cleaning: true,
      testing: false,
    }).subtotalSgd,
    expected.essentialClean,
  );
  assert.equal(
    quote({
      kwp: expected.kwp,
      installer: "fomo",
      serviceLevel: "electrical_assurance",
      cleaning: true,
      testing: false,
    }).subtotalSgd,
    expected.electricalClean,
  );
}

const essentialTenKwp = quote({
  kwp: 10,
  installer: "fomo",
  serviceLevel: "essential",
  cleaning: false,
  testing: false,
});
assert.equal(essentialTenKwp.subtotalSgd, 199);
assert.equal(essentialTenKwp.gstSgd, 17.91);
assert.equal(essentialTenKwp.totalSgd, 216.91);
assert.equal(quoteTotalSgd({ kwp: 10 }), 216.91);
assert.equal(gstSgdForLineItems([199]), 17.91);
assert.equal(totalIncludingGstSgd([199]), 216.91);

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
      testing: false,
    }).serviceCode,
    expected.code,
  );
}

const complete = quote({
  kwp: 20,
  installer: "fomo",
  serviceLevel: "electrical_assurance",
  cleaning: true,
  testing: false,
});
assert.equal(complete.subtotalSgd, 1009);
assert.equal(complete.gstSgd, 90.81);
assert.equal(complete.totalSgd, 1099.81);
assert.equal(
  priceLineItems(complete).reduce((sum, item) => sum + item.amountSgd, 0),
  complete.subtotalSgd,
  "Stripe line items must sum to the server pre-GST subtotal",
);

const validCheckout = {
  kwp: 10,
  installer: "fomo",
  serviceLevel: "essential",
  cleaning: false,
  monitoring: false,
  testing: false,
  name: "Test Owner",
  phone: "+65 8123 4567",
  email: "owner@example.com",
  address: "1 Test Street, Singapore",
  slotStart: "2026-09-02T01:00:00.000Z",
  slotEnd: "2026-09-02T05:00:00.000Z",
};
assert.equal(parseCheckoutRequest(validCheckout).serviceLevel, "essential");
assert.deepEqual(
  quoteForCheckout(parseCheckoutRequest(validCheckout)).scope,
  [
    "Inverter area condition - physical integrity, switching and safety mechanisms",
    "Inverter and DB area electrical checks",
    "Remote pre-check when available",
    "Report generation",
  ],
  "Essential scope must match the approved customer wording",
);
const forgedCheckout = parseCheckoutRequest({
  ...validCheckout,
  totalSgd: 1,
  essentialSgd: 1,
});
assert.equal(
  quoteForCheckout(forgedCheckout).totalSgd,
  216.91,
  "Browser-supplied totals must be ignored and recomputed on the server",
);
const testingCheckout = parseCheckoutRequest({
  ...validCheckout,
  testing: true,
  totalSgd: 0.01,
});
const testingQuote = quoteForCheckout(testingCheckout);
assert.equal(testingQuote.serviceCode, "TESTING");
assert.equal(testingQuote.packageName, "Testing");
assert.equal(testingQuote.subtotalSgd, 0.5);
assert.equal(testingQuote.gstSgd, 0.05);
assert.equal(testingQuote.totalSgd, 0.55);
assert.equal(testingQuote.servicePackageSgd, 0);
assert.equal(formatSgd(testingQuote.totalSgd), "S$0.55");
assert.equal(sgdToCents(testingQuote.totalSgd), 55);
assert.equal(
  priceBreakdown(testingQuote),
  "Testing=0.50; Subtotal=0.50; GST (9%)=0.05; Total incl. GST=0.55",
);
assert.deepEqual(priceLineItems(testingQuote), [
  { name: "Testing — no service offered", amountSgd: 0.5 },
]);
assert.throws(
  () =>
    parseCheckoutRequest({
      ...validCheckout,
      testing: true,
      cleaning: true,
    }),
  /Testing cannot be combined/,
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
      monitoring: true,
    }),
  /not available for online booking/,
  "Continuous monitoring must not be purchasable through a crafted request",
);
assert.equal(
  quote({
    kwp: 10,
    installer: "rto",
    serviceLevel: "essential",
    cleaning: false,
    testing: false,
  }).sellable,
  false,
);

console.log("verify:pricing passed");
