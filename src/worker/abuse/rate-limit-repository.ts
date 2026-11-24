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
import type { WorkerPublicWriteActor } from "@/worker/abuse/public-write-actor";

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

type BucketRequest = { actorKey: string; limit: number };

/**
 * 같은 정책의 여러 버킷(방문자 + IP + 추가 키)을 한 문장으로 올린다.
 * 먼 DB에서는 쿼리 하나의 왕복이 약 0.2~0.4초라, 버킷마다 따로 보내면 그만큼 느려진다.
 * 결과는 요청한 순서대로 돌려주며, 행을 못 받은 버킷은 null이다.
 */
async function consumeBuckets(
  db: RateLimitDb,
  policyName: RateLimitPolicyName,
  requests: BucketRequest[],
) {
  const policy = RATE_LIMIT_POLICIES[policyName];
  const now = new Date();
  const bucketStartedAt = getBucketStartedAt(now, policy.windowMs);
  const expiresAt = new Date(bucketStartedAt.getTime() + policy.windowMs);
  // 한 문장에서 같은 행을 두 번 수정할 수 없으므로 같은 키는 한 번만 보낸다.
  const unique = [...new Map(requests.map((request) => [request.actorKey, request])).values()];

  const rows = await db
    .insert(publicWriteRateLimits)
    .values(
      unique.map((request) => ({
        scope: policy.scope,
        actorKey: request.actorKey,
        bucketStartedAt,
        count: 1,
        expiresAt,
        updatedAt: now,
      })),
    )
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
      actorKey: publicWriteRateLimits.actorKey,
      count: publicWriteRateLimits.count,
      expiresAt: publicWriteRateLimits.expiresAt,
    });
  const rowByKey = new Map(rows.map((row) => [row.actorKey, row]));

  return requests.map((request) => {
    const row = rowByKey.get(request.actorKey);

    return row
      ? toRateLimitResult({
          count: row.count,
          limit: request.limit,
          policyName,
          resetAt: row.expiresAt,
        })
      : null;
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
  // 익명 요청은 쿠키를 버리고 새 visitor로 위장할 수 있으므로 IP 버킷을 함께 소비한다.
  // CF-Connecting-IP는 Cloudflare 엣지가 덮어쓰므로 운영에서는 위조할 수 없다.
  const extraKeys = [...(options?.extraKeys ?? [])];

  if (!actor.user && actor.ip) {
    extraKeys.push({
      key: `ip:${actor.ip}:${policyName}`,
      limitMultiplier: IP_LIMIT_MULTIPLIER,
    });
  }

  const [primary, ...extras] = await consumeBuckets(db, policyName, [
    { actorKey: actor.key, limit: policy.limit },
    ...extraKeys.map((extra) => ({
      actorKey: extra.key.slice(0, 160),
      limit: policy.limit * extra.limitMultiplier,
    })),
  ]);

  if (!primary) {
    return null;
  }

  let result = primary;

  for (const extraResult of extras) {
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
