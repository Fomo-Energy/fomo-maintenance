import "server-only";

import { createHmac } from "node:crypto";
import { lt, sql } from "drizzle-orm";
import { apiRateLimits } from "@/db/schema";
import { databaseIsConfigured, getDatabase } from "@/lib/database";
import {
  apiRateLimitingEnabled,
  rateLimitHashSecret,
} from "@/lib/portal/config";

export type RateLimitAction = "availability" | "checkout";

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

function clientAddress(request: Request): string {
  const vercelForwarded = request.headers.get("x-vercel-forwarded-for");
  const forwarded = vercelForwarded || request.headers.get("x-forwarded-for");
  const candidate = forwarded?.split(",", 1)[0]?.trim();
  return (
    candidate ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function identifierDigest(request: Request): string {
  return createHmac("sha256", rateLimitHashSecret())
    .update(clientAddress(request))
    .digest("hex");
}

export async function checkApiRateLimit(
  request: Request,
  policy: {
    action: RateLimitAction;
    limit: number;
    windowSeconds: number;
  },
): Promise<RateLimitResult | null> {
  if (!apiRateLimitingEnabled()) {
    return null;
  }
  if (!databaseIsConfigured()) {
    throw new Error(
      "API_RATE_LIMITING_ENABLED is set but DATABASE_URL is not configured.",
    );
  }

  const nowMs = Date.now();
  const windowMs = policy.windowSeconds * 1_000;
  const windowStartMs = Math.floor(nowMs / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs);
  const expiresAt = new Date(windowStartMs + windowMs * 2);
  const digest = identifierDigest(request);
  const [counter] = await getDatabase()
    .insert(apiRateLimits)
    .values({
      action: policy.action,
      identifierDigest: digest,
      windowStart,
      requestCount: 1,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [
        apiRateLimits.action,
        apiRateLimits.identifierDigest,
        apiRateLimits.windowStart,
      ],
      set: {
        requestCount: sql`${apiRateLimits.requestCount} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ requestCount: apiRateLimits.requestCount });

  if (!counter) {
    throw new Error("The API rate-limit counter could not be updated.");
  }
  if (counter.requestCount === 1) {
    await getDatabase()
      .delete(apiRateLimits)
      .where(lt(apiRateLimits.expiresAt, new Date(nowMs)));
  }
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((windowStartMs + windowMs - nowMs) / 1_000),
  );
  return {
    allowed: counter.requestCount <= policy.limit,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - counter.requestCount),
    retryAfterSeconds,
  };
}
