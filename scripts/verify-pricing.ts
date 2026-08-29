import assert from "node:assert/strict";
import { baseTariffSgd, quoteTotalSgd } from "../lib/pricing";

assert.equal(baseTariffSgd(10), 400, "10 kWp base should be S$400");
assert.equal(
  quoteTotalSgd({ kwp: 10, advancedPreventive: true }),
  500,
  "10 kWp + Advanced should be S$500",
);
assert.equal(
  quoteTotalSgd({ kwp: 10, advancedPreventive: true, monitoring: true }),
  550,
  "10 kWp + both extras should be S$550",
);
assert.equal(baseTariffSgd(20), 600, "20 kWp base should be S$600");
assert.equal(baseTariffSgd(40), 1000, "40 kWp base should be S$1000");
assert.equal(baseTariffSgd(100), 1300, "100 kWp base should be S$1300");

assert.equal(
  quoteTotalSgd({
    kwp: 10,
    installer: "other",
    monitoring: true,
    advancedPreventive: true,
  }),
  500,
  "Monitoring must not apply for other installers",
);

console.log("verify:pricing passed");
