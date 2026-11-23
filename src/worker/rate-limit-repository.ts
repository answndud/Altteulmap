import { lt, sql } from "drizzle-orm";

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
  limit,
  policyName,
  resetAt,
}: {
  count: number;
  limit: number;
  policyName: RateLimitPolicyName;
  resetAt: Date;
}): RateLimitResult {
  const policy = RATE_LIMIT_POLICIES[policyName];
  const retryAfterMs = Math.max(resetAt.getTime() - Date.now(), 0);
  const remaining = Math.max(limit - count, 0);

  return {
    ok: count <= limit,
    policyName,
    scope: policy.scope,
    limit,
    remaining,
    resetAt: resetAt.getTime(),
    windowMs: policy.windowMs,
    retryAfterMs: count <= limit ? 0 : retryAfterMs,
  };
}

/** IP 단위 상한은 공용 IP(학교·회사 NAT)를 고려해 개인 한도의 3배로 둔다. */
const IP_LIMIT_MULTIPLIER = 3;
/** 같은 계정을 여러 IP에서 노리는 로그인 시도는 계정 단위로 별도 제한한다. */
export const ACCOUNT_LIMIT_MULTIPLIER = 3;

type RateLimitDb = ReturnType<typeof getWorkerDb>;

async function consumeBucket(
  db: RateLimitDb,
  policyName: RateLimitPolicyName,
  actorKey: string,
  limit: number,
) {
  const policy = RATE_LIMIT_POLICIES[policyName];
  const now = new Date();
  const bucketStartedAt = getBucketStartedAt(now, policy.windowMs);
  const expiresAt = new Date(bucketStartedAt.getTime() + policy.windowMs);

  const [row] = await db
    .insert(publicWriteRateLimits)
    .values({
      scope: policy.scope,
      actorKey,
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
    limit,
    policyName,
    resetAt: row.expiresAt,
  });
}

function pickStricter(left: RateLimitResult, right: RateLimitResult | null) {
  if (!right) {
    return left;
  }

  if (left.ok !== right.ok) {
    return left.ok ? right : left;
  }

  return right.remaining < left.remaining ? right : left;
}

export async function consumeWorkerPersistentRateLimit(
  env: WorkerDatabaseBindings,
  policyName: RateLimitPolicyName,
  actor: WorkerPublicWriteActor,
  options?: { extraKeys?: Array<{ key: string; limitMultiplier: number }> },
): Promise<RateLimitResult | null> {
  if (!isWorkerDatabaseEnabled(env)) {
    return null;
  }

  const policy = RATE_LIMIT_POLICIES[policyName];
  const db = getWorkerDb(env);
  let result = await consumeBucket(db, policyName, actor.key, policy.limit);

  if (!result) {
    return null;
  }

  // 익명 요청은 쿠키를 버리고 새 visitor로 위장할 수 있으므로 IP 버킷을 함께 소비한다.
  // CF-Connecting-IP는 Cloudflare 엣지가 덮어쓰므로 운영에서는 위조할 수 없다.
  const extraKeys = [...(options?.extraKeys ?? [])];

  if (!actor.user && actor.ip) {
    extraKeys.push({
      key: `ip:${actor.ip}:${policyName}`,
      limitMultiplier: IP_LIMIT_MULTIPLIER,
    });
  }

  for (const extra of extraKeys) {
    const extraResult = await consumeBucket(
      db,
      policyName,
      extra.key.slice(0, 160),
      policy.limit * extra.limitMultiplier,
    );

    result = pickStricter(result, extraResult);
  }

  return result;
}

/** 만료된 버킷을 지운다. 요청 핫패스가 아니라 cron(scheduled)에서만 호출한다. */
export async function deleteExpiredRateLimits(env: WorkerDatabaseBindings) {
  if (!isWorkerDatabaseEnabled(env)) {
    return 0;
  }

  const deleted = await getWorkerDb(env)
    .delete(publicWriteRateLimits)
    .where(lt(publicWriteRateLimits.expiresAt, new Date()))
    .returning({ scope: publicWriteRateLimits.scope });

  return deleted.length;
}
