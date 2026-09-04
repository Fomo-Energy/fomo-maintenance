import assert from "node:assert/strict";
import nextConfig from "../next.config";

async function main() {
  assert.equal(typeof nextConfig.headers, "function");
  const rules = await nextConfig.headers!();
  const globalRule = rules.find((rule) => rule.source === "/:path*");
  assert.ok(globalRule, "every route must receive the baseline security headers");

  const headers = new Map(
    globalRule.headers.map((header) => [header.key.toLowerCase(), header.value]),
  );
  const csp = headers.get("content-security-policy") || "";
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /https:\/\/\*\.stripe\.com/);
  assert.match(csp, /https:\/\/\*\.blob\.vercel-storage\.com/);
  assert.match(
    csp,
    /https:\/\/vercel\.com/,
    "client Blob uploads require the Vercel Blob API origin in connect-src",
  );
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("x-frame-options"), "DENY");
  assert.equal(
    headers.get("permissions-policy"),
    "camera=(), microphone=(), geolocation=()",
  );

  const manageRule = rules.find((rule) => rule.source === "/manage/:path*");
  assert.ok(manageRule, "manage pages must retain their private response policy");
  const manageHeaders = new Map(
    manageRule.headers.map((header) => [header.key.toLowerCase(), header.value]),
  );
  assert.equal(manageHeaders.get("cache-control"), "private, no-store");
  assert.equal(manageHeaders.get("referrer-policy"), "no-referrer");

  console.log("Security header verification passed.");
}

void main();
