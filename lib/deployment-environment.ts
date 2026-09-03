import "server-only";

type DeploymentEnvironment = Readonly<Record<string, string | undefined>>;

/**
 * Identifies only the long-lived staging branch deployment.
 * Other pull-request previews must not inherit staging-only operator guidance.
 */
export function isStableStagingDeployment(
  environment: DeploymentEnvironment = process.env,
): boolean {
  return (
    environment.VERCEL_ENV === "preview" &&
    environment.VERCEL_GIT_COMMIT_REF === "staging"
  );
}
