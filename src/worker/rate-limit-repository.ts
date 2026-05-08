import { and, eq, lt, sql } from "drizzle-orm";

import { publicWriteRateLimits } from "@/db/schema";
import {
  RATE_LIMIT_POLICIES,
  type RateLimitPolicyName,
  type RateLimitResult,
} from "@/lib/rate-limit";
import {
  getWorkerDb,
  isWorkerDatabaseEnabled,
  type WorkerDatabaseBindings,
} from "@/worker/db";
import type { WorkerPublicWriteActor } from "@/worker/public-write-actor";

function getBucketStartedAt(now: Date, windowMs: number) {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

function toRateLimitResult({
  count,
  policyName,
  resetAt,
}: {
  count: number;
  policyName: RateLimitPolicyName;
  resetAt: Date;
}): RateLimitResult {
  const policy = RATE_LIMIT_POLICIES[policyName];
  const retryAfterMs = Math.max(resetAt.getTime() - Date.now(), 0);
  const remaining = Math.max(policy.limit - count, 0);

  return {
    ok: count <= policy.limit,
    policyName,
    scope: policy.scope,
    limit: policy.limit,
    remaining,
    resetAt: resetAt.getTime(),
    windowMs: policy.windowMs,
    retryAfterMs: count <= policy.limit ? 0 : retryAfterMs,
  };
}

export async function consumeWorkerPersistentRateLimit(
  env: WorkerDatabaseBindings,
  policyName: RateLimitPolicyName,
  actor: WorkerPublicWriteActor,
): Promise<RateLimitResult | null> {
  if (!isWorkerDatabaseEnabled(env)) {
    return null;
  }

  const policy = RATE_LIMIT_POLICIES[policyName];
  const db = getWorkerDb(env);
  const now = new Date();
  const bucketStartedAt = getBucketStartedAt(now, policy.windowMs);
  const expiresAt = new Date(bucketStartedAt.getTime() + policy.windowMs);

  await db
    .delete(publicWriteRateLimits)
    .where(lt(publicWriteRateLimits.expiresAt, now));

  const [row] = await db
    .insert(publicWriteRateLimits)
    .values({
      scope: policy.scope,
      actorKey: actor.key,
      bucketStartedAt,
      count: 1,
      expiresAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        publicWriteRateLimits.scope,
        publicWriteRateLimits.actorKey,
        publicWriteRateLimits.bucketStartedAt,
      ],
      set: {
        count: sql`${publicWriteRateLimits.count} + 1`,
        expiresAt,
        updatedAt: now,
      },
    })
    .returning({
      count: publicWriteRateLimits.count,
      expiresAt: publicWriteRateLimits.expiresAt,
    });

  if (!row) {
    return null;
  }

  return toRateLimitResult({
    count: row.count,
    policyName,
    resetAt: row.expiresAt,
  });
}

export async function resetWorkerPersistentRateLimit(
  env: WorkerDatabaseBindings,
  policyName: RateLimitPolicyName,
  actor: WorkerPublicWriteActor,
) {
  if (!isWorkerDatabaseEnabled(env)) {
    return;
  }

  const policy = RATE_LIMIT_POLICIES[policyName];
  const db = getWorkerDb(env);
  const now = new Date();
  const bucketStartedAt = getBucketStartedAt(now, policy.windowMs);

  await db
    .delete(publicWriteRateLimits)
    .where(
      and(
        eq(publicWriteRateLimits.scope, policy.scope),
        eq(publicWriteRateLimits.actorKey, actor.key),
        eq(publicWriteRateLimits.bucketStartedAt, bucketStartedAt),
      ),
    );
}
