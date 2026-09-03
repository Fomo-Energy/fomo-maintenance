import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StagingEnvironmentBanner } from "../components/StagingEnvironmentBanner";
import { StagingOperationsGuide } from "../components/StagingOperationsGuide";

const html = renderToStaticMarkup(createElement(StagingOperationsGuide));
const bannerHtml = renderToStaticMarkup(createElement(StagingEnvironmentBanner));

assert.match(bannerHtml, /data-staging-environment-banner/);
assert.match(bannerHtml, /STAGING ENVIRONMENT/);
assert.match(bannerHtml, /sandbox payments/);
assert.match(bannerHtml, /Calendar events and emails are real/);
assert.match(bannerHtml, /href="\/#staging-operations"/);

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
assert.match(html, /signed Stripe webhook/);
assert.match(html, /No email is sent currently/);
assert.match(html, /email entered in the booking form/);
assert.match(html, /no staff dashboard or automatic escalation/i);
assert.doesNotMatch(html, /fomoenergysg@gmail\.com/);
assert.doesNotMatch(html, /EMAIL_CUSTOMER_OVERRIDE_TO/);
assert.doesNotMatch(html, /Bearer|access=|client[_ -]?secret/i);

console.log("Staging operations guide verification passed.");
