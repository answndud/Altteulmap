import { after, before, test } from "node:test";
import assert from "node:assert/strict";

import { and, eq, inArray } from "drizzle-orm";

import {
  adminActions,
  places,
  priceItems,
  priceReports,
  users,
} from "../../src/db/schema";
import { moderateWorkerPriceReport } from "../../src/worker/admin/admin-price-review-repository";
import {
  closeWorkerDatabaseConnection,
  getWorkerDb,
  withWorkerDatabaseConnection,
} from "../../src/worker/db";
import {
  assertTestDatabaseReady,
  getTestDatabaseUrl,
} from "./test-database";

const databaseUrl = getTestDatabaseUrl();
const workerEnv = {
  DATABASE_URL: databaseUrl,
  USE_MOCK_DATA: "false",
};
const fixturePrefix = `integration-${crypto.randomUUID()}`;
let fixturePlaceId: string;
let fixtureAdminId: string;
let reportIds: string[];

async function withDatabase<T>(load: () => Promise<T>) {
  return withWorkerDatabaseConnection(workerEnv, load);
}

before(async () => {
  await assertTestDatabaseReady();
  await withDatabase(async () => {
    const db = getWorkerDb(workerEnv);
    fixtureAdminId = crypto.randomUUID();
    fixturePlaceId = crypto.randomUUID();
    reportIds = [crypto.randomUUID(), crypto.randomUUID()];

    await db.insert(users).values({
      id: fixtureAdminId,
      email: `${fixturePrefix}@altteulmap.local`,
      nickname: "통합 테스트 운영자",
      role: "admin",
    });
    await db.insert(places).values({
      id: fixturePlaceId,
      slug: fixturePrefix,
      name: "통합 테스트 장소",
      roadAddress: "서울특별시 테스트구 테스트로 1",
      district: "테스트구",
      latitude: 37.5,
      longitude: 127,
      status: "active",
      primaryCategorySlug: "korean",
    });
    await db.insert(priceReports).values(
      reportIds.map((id, index) => ({
        id,
        placeId: fixturePlaceId,
        reporterUserId: null,
        label: "테스트 메뉴",
        normalizedLabel: "테스트 메뉴",
        amount: 7000,
        currency: "KRW",
        reportStatus: "pending_review" as const,
        snapshotVerificationStatus: "unverified" as const,
        submissionKey: `${fixturePrefix}-${index}`,
      })),
    );
  });
});

after(async () => {
  await withDatabase(async () => {
    const db = getWorkerDb(workerEnv);
    await db.delete(adminActions).where(inArray(adminActions.targetId, reportIds));
    await db.delete(priceReports).where(eq(priceReports.placeId, fixturePlaceId));
    await db.delete(priceItems).where(eq(priceItems.placeId, fixturePlaceId));
    await db.delete(places).where(eq(places.id, fixturePlaceId));
    await db.delete(users).where(eq(users.id, fixtureAdminId));
  });
  await closeWorkerDatabaseConnection();
});

test("가격 승인 transaction은 report, item, summary, audit를 함께 갱신한다", async () => {
  const result = await withDatabase(async () =>
    moderateWorkerPriceReport(
      workerEnv,
      reportIds[0],
      { decision: "approve" },
      { id: fixtureAdminId },
    ),
  );

  assert.equal(result.ok, true);

  await withDatabase(async () => {
    const db = getWorkerDb(workerEnv);
    const [report] = await db
      .select({ status: priceReports.reportStatus, itemId: priceReports.priceItemId })
      .from(priceReports)
      .where(eq(priceReports.id, reportIds[0]));
    const [item] = await db
      .select({ amount: priceItems.amount, placeId: priceItems.placeId })
      .from(priceItems)
      .where(eq(priceItems.id, report.itemId!));
    const [place] = await db
      .select({ amount: places.representativePriceAmount, label: places.representativePriceLabel })
      .from(places)
      .where(eq(places.id, fixturePlaceId));
    const actions = await db
      .select({ id: adminActions.id })
      .from(adminActions)
      .where(eq(adminActions.targetId, reportIds[0]));

    assert.equal(report.status, "accepted");
    assert.equal(item.amount, 7000);
    assert.equal(item.placeId, fixturePlaceId);
    assert.equal(place.amount, 7000);
    assert.equal(place.label, "테스트 메뉴");
    assert.equal(actions.length, 1);
  });
});

test("동시에 같은 가격 report를 승인하면 하나의 상태 전이만 성공한다", async () => {
  const results = await Promise.all(
    [0, 1].map((connectionIndex) =>
      withWorkerDatabaseConnection(workerEnv, () =>
        moderateWorkerPriceReport(
          workerEnv,
          reportIds[1],
          { decision: connectionIndex === 0 ? "approve" : "reject" },
          { id: fixtureAdminId },
        ),
      ),
    ),
  );

  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => !result.ok).length, 1);

  await withDatabase(async () => {
    const db = getWorkerDb(workerEnv);
    const [report] = await db
      .select({ status: priceReports.reportStatus })
      .from(priceReports)
      .where(eq(priceReports.id, reportIds[1]));
    const actions = await db
      .select({ id: adminActions.id })
      .from(adminActions)
      .where(eq(adminActions.targetId, reportIds[1]));
    const items = await db
      .select({ id: priceItems.id })
      .from(priceItems)
      .where(
        and(
          eq(priceItems.placeId, fixturePlaceId),
          eq(priceItems.normalizedLabel, "테스트 메뉴"),
        ),
      );

    assert.ok(["accepted", "rejected"].includes(report.status));
    assert.equal(actions.length, 1);
    assert.ok(items.length <= 1);
  });
});
