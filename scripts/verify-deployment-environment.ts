import assert from "node:assert/strict";
import { isStableStagingDeployment } from "../lib/deployment-environment";

assert.equal(
  isStableStagingDeployment({
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "staging",
  }),
  true,
  "the stable staging Preview must be recognized",
);

for (const environment of [
  { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "staging" },
  { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "main" },
  { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feature/test" },
  { VERCEL_ENV: "development", VERCEL_GIT_COMMIT_REF: "staging" },
  { VERCEL_ENV: "Preview", VERCEL_GIT_COMMIT_REF: "staging" },
  { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: " staging " },
  { VERCEL_ENV: undefined, VERCEL_GIT_COMMIT_REF: undefined },
]) {
  assert.equal(
    isStableStagingDeployment(environment),
    false,
    `non-staging environment must remain false: ${JSON.stringify(environment)}`,
  );
}

console.log("Deployment environment verification passed.");
