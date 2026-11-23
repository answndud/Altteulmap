import assert from "node:assert/strict";
import { after, test } from "node:test";

import { eq, like, or } from "drizzle-orm";

import { publicWriteRateLimits } from "../../src/db/schema";
import {
  closeWorkerDatabaseConnection,
  getWorkerDb,
  withWorkerDatabaseConnection,
} from "../../src/worker/db";
import type { WorkerPublicWriteActor } from "../../src/worker/abuse/public-write-actor";
import {
  consumeWorkerPersistentRateLimit,
  deleteExpiredRateLimits,
} from "../../src/worker/abuse/rate-limit-repository";
import { assertTestDatabaseReady, getTestDatabaseUrl } from "./test-database";

const workerEnv = {
  DATABASE_URL: getTestDatabaseUrl(),
  USE_MOCK_DATA: "false",
};
const fixtureId = crypto.randomUUID();
const ip = `203.0.113.${fixtureId}`;

function anonymousActor(): WorkerPublicWriteActor {
  // 쿠키를 버리고 요청마다 새 visitor로 위장하는 클라이언트를 흉내 낸다.
  return {
    user: null,
    visitorId: crypto.randomUUID(),
    visitorCookieValue: null,
    key: crypto.randomUUID(),
    ip,
  };
}

after(async () => {
  await withWorkerDatabaseConnection(workerEnv, async () => {
    await getWorkerDb(workerEnv)
      .delete(publicWriteRateLimits)
      .where(
        or(
          like(publicWriteRateLimits.actorKey, `ip:${ip}:%`),
          like(publicWriteRateLimits.actorKey, `expired-${fixtureId}%`),
        ),
      );
  });
  await closeWorkerDatabaseConnection();
});

test("쿠키 없이 새 visitor로 위장해도 같은 IP의 반복 요청은 429로 제한된다", async () => {
  await assertTestDatabaseReady();

  await withWorkerDatabaseConnection(workerEnv, async () => {
    // placeSubmission limit(4) x IP 배수(3) = 12회까지만 허용
    const results = [];

    for (let attempt = 0; attempt < 14; attempt += 1) {
      results.push(
        await consumeWorkerPersistentRateLimit(
          workerEnv,
          "placeSubmission",
          anonymousActor(),
        ),
      );
    }

    assert.equal(results.slice(0, 12).every((result) => result?.ok), true);
    assert.equal(results[12]?.ok, false);
    assert.equal(results[13]?.ok, false);
  });
});

test("로그인된 사용자는 IP 버킷을 소비하지 않는다", async () => {
  await withWorkerDatabaseConnection(workerEnv, async () => {
    const userIp = `198.51.100.${fixtureId}`;
    const actor: WorkerPublicWriteActor = {
      user: { id: crypto.randomUUID(), email: "a@example.test", name: "a", role: "user" },
      visitorId: null,
      visitorCookieValue: null,
      key: crypto.randomUUID(),
      ip: userIp,
    };

    await consumeWorkerPersistentRateLimit(workerEnv, "placeCommentSubmission", actor);
    const rows = await getWorkerDb(workerEnv)
      .select({ key: publicWriteRateLimits.actorKey })
      .from(publicWriteRateLimits)
      .where(like(publicWriteRateLimits.actorKey, `ip:${userIp}:%`));

    assert.equal(rows.length, 0);
  });
});

test("요청 경로는 만료 행을 지우지 않고 cron 정리 함수만 지운다", async () => {
  await withWorkerDatabaseConnection(workerEnv, async () => {
    const db = getWorkerDb(workerEnv);
    const expiredKey = `expired-${fixtureId}`;

    await db.insert(publicWriteRateLimits).values({
      scope: "place_submission",
      actorKey: expiredKey,
      bucketStartedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      count: 1,
      expiresAt: new Date(Date.now() - 60 * 60 * 1000),
      updatedAt: new Date(),
    });

    await consumeWorkerPersistentRateLimit(workerEnv, "placeSubmission", anonymousActor());
    const stillThere = await db
      .select({ key: publicWriteRateLimits.actorKey })
      .from(publicWriteRateLimits)
      .where(eq(publicWriteRateLimits.actorKey, expiredKey));

    assert.equal(stillThere.length, 1);

    const deleted = await deleteExpiredRateLimits(workerEnv);
    const afterCleanup = await db
      .select({ key: publicWriteRateLimits.actorKey })
      .from(publicWriteRateLimits)
      .where(eq(publicWriteRateLimits.actorKey, expiredKey));

    assert.ok(deleted >= 1);
    assert.equal(afterCleanup.length, 0);
  });
});
