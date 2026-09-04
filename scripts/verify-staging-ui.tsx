import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PricingCalculator } from "../components/PricingCalculator";
import { StagingEnvironmentBanner } from "../components/StagingEnvironmentBanner";
import { StagingOperationsGuide } from "../components/StagingOperationsGuide";
import { VisitBooking } from "../components/VisitBooking";

const html = renderToStaticMarkup(createElement(StagingOperationsGuide));
const bannerHtml = renderToStaticMarkup(createElement(StagingEnvironmentBanner));
const calculatorHtml = renderToStaticMarkup(createElement(PricingCalculator));
const thirdPartyBookingHtml = renderToStaticMarkup(
  createElement(VisitBooking, {
    kwp: 10,
    installer: "other",
    serviceLevel: "essential",
    cleaning: false,
    totalSgd: 216.91,
  }),
);
const fomoBookingHtml = renderToStaticMarkup(
  createElement(VisitBooking, {
    kwp: 10,
    installer: "fomo",
    serviceLevel: "essential",
    cleaning: false,
    totalSgd: 216.91,
  }),
);

assert.match(bannerHtml, /data-staging-environment-banner/);
assert.match(bannerHtml, /STAGING ENVIRONMENT/);
assert.match(bannerHtml, /sandbox payments/);
assert.match(bannerHtml, /Calendar events and emails are real/);
assert.match(bannerHtml, /href="\/#staging-operations"/);

assert.match(calculatorHtml, /value="other"/);
assert.match(calculatorHtml, /3rd party/);
assert.match(thirdPartyBookingHtml, /Installer name/);
assert.match(thirdPartyBookingHtml, /name="installerName"/);
assert.match(thirdPartyBookingHtml, /maxLength="120"/);
assert.match(thirdPartyBookingHtml, /autoComplete="organization"/);
assert.doesNotMatch(fomoBookingHtml, /name="installerName"/);

assert.match(html, /data-staging-operations-guide/);
assert.match(html, /id="staging-operations"/);
assert.match(html, /scroll-mt-32/);
assert.match(html, /Stripe is sandboxed/);
assert.match(html, /Microsoft calendar and email actions are real/);
assert.match(html, /controlled staging customer inbox/);
assert.match(html, /ops@fomo\.energy/);
assert.match(html, /service@fomo\.energy/);
assert.match(html, /private Manage Booking and upload link/);
assert.match(html, /request an available replacement date and time/);
assert.match(html, /briefly reserves the chosen slot/);
assert.match(html, /For a 3rd-party system, the installer name is carried/);
assert.match(html, /success page, and Manage Booking view/);
assert.match(html, /full refund blocks private customer access immediately/i);
assert.match(html, /once Microsoft confirms deletion/i);
assert.match(html, /partial refund or dispute alert/i);
assert.match(html, /120 requests per minute/);
assert.match(html, /12 attempts per 10 minutes/);
assert.match(html, /roughly 36 minutes/);
assert.match(html, /signed Stripe webhook/);
assert.match(html, /No email is sent currently/);
assert.match(html, /email entered in the booking form/);
assert.match(html, /no staff dashboard or automatic escalation/i);
assert.doesNotMatch(html, /fomoenergysg@gmail\.com/);
assert.doesNotMatch(html, /EMAIL_CUSTOMER_OVERRIDE_TO/);
assert.doesNotMatch(html, /Bearer|access=|client[_ -]?secret/i);

console.log("Staging operations guide verification passed.");
