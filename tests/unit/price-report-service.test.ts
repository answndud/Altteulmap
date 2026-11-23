import assert from "node:assert/strict";
import { test } from "node:test";

import { DomainError } from "../../src/worker/http/api-error";
import type { WorkerPublicWriteActor } from "../../src/worker/public-write-actor";
import {
  canTransitionPriceReport,
  countDistinctReporters,
  decideVerificationStatus,
  VERIFICATION_REPORTER_THRESHOLD,
} from "../../src/worker/services/price-report-rules";
import {
  createPriceReportService,
  type NewPriceReport,
  type PriceReportStore,
} from "../../src/worker/services/price-report-service";
import { getPriceReportService } from "../../src/worker/services/price-report-stores";

const place = { id: "place-1", slug: "gimbap-house", name: "김밥집" };

/** DB 없이 submissionKey unique 제약을 흉내 내는 in-memory fake. */
function createFakeStore() {
  const reports = new Map<string, NewPriceReport & { id: string }>();
  const store: PriceReportStore = {
    source: "database",
    async findActivePlace(slug) {
      return slug === place.slug ? place : null;
    },
    async createIfAbsent(report) {
      const existing = reports.get(report.submissionKey);

      if (existing) {
        return { id: existing.id };
      }

      const id = `report-${reports.size + 1}`;
      reports.set(report.submissionKey, { ...report, id });

      return { id };
    },
  };

  return { store, reports };
}

function actor(overrides: Partial<WorkerPublicWriteActor> = {}): WorkerPublicWriteActor {
  return {
    user: null,
    visitorId: "visitor-a",
    visitorCookieValue: null,
    key: "visitor-a",
    ...overrides,
  };
}

const input = { label: "김치찌개", amount: 8000, unitLabel: "1인분", comment: "" };

test("제보를 저장하고 장소 정보와 함께 돌려준다", async () => {
  const { store, reports } = createFakeStore();
  const result = await createPriceReportService(store).submit(
    place.slug,
    input,
    actor(),
  );

  assert.equal(result.ok, true);
  assert.equal(result.item.placeId, "gimbap-house");
  assert.equal(result.item.placeName, "김밥집");
  assert.equal(result.item.comment, undefined);
  assert.equal(reports.size, 1);
});

test("없는 장소는 NOT_FOUND DomainError(404)다", async () => {
  const { store, reports } = createFakeStore();

  await assert.rejects(
    createPriceReportService(store).submit("unknown", input, actor()),
    (error: unknown) =>
      error instanceof DomainError &&
      error.code === "NOT_FOUND" &&
      error.status === 404,
  );
  assert.equal(reports.size, 0);
});

test("같은 사람이 같은 제보를 다시 보내도 한 건만 남고 같은 id를 받는다", async () => {
  const { store, reports } = createFakeStore();
  const service = createPriceReportService(store);
  const first = await service.submit(place.slug, input, actor());
  const second = await service.submit(place.slug, input, actor());

  assert.equal(first.item.id, second.item.id);
  assert.equal(reports.size, 1);
});

test("라벨의 공백·대소문자 차이는 같은 제보로 본다", async () => {
  const { store, reports } = createFakeStore();
  const service = createPriceReportService(store);

  await service.submit(place.slug, { ...input, label: "김치찌개" }, actor());
  await service.submit(place.slug, { ...input, label: "  김치찌개 " }, actor());

  assert.equal(reports.size, 1);
});

test("제보자·가격·단위가 다르면 별도 제보다", async () => {
  const { store, reports } = createFakeStore();
  const service = createPriceReportService(store);

  await service.submit(place.slug, input, actor());
  await service.submit(place.slug, input, actor({ visitorId: "visitor-b", key: "visitor-b" }));
  await service.submit(place.slug, { ...input, amount: 8500 }, actor());
  await service.submit(place.slug, { ...input, unitLabel: "2인분" }, actor());

  assert.equal(reports.size, 4);
});

test("로그인 사용자는 visitor가 아니라 user id로 식별된다", async () => {
  const { store, reports } = createFakeStore();
  const service = createPriceReportService(store);
  const user = { id: "u1", email: "a@b.c", name: "a", role: "user" as const };

  await service.submit(place.slug, input, actor({ user, visitorId: null }));
  await service.submit(place.slug, input, actor({ user, visitorId: "other-device" }));

  assert.equal(reports.size, 1);
});

test("빈 단위·코멘트는 null로 저장되고 응답에서는 생략된다", async () => {
  const { store, reports } = createFakeStore();
  const result = await createPriceReportService(store).submit(
    place.slug,
    { label: "라면", amount: 4500, unitLabel: "", comment: "" },
    actor(),
  );
  const saved = [...reports.values()][0];

  assert.equal(saved?.unitLabel, null);
  assert.equal(saved?.comment, null);
  assert.equal(result.item.unitLabel, undefined);
});

test("검증 기준은 서로 다른 제보자 2명이며 경계값을 고정한다", () => {
  assert.equal(VERIFICATION_REPORTER_THRESHOLD, 2);
  assert.equal(decideVerificationStatus(0), "unverified");
  assert.equal(decideVerificationStatus(1), "unverified");
  assert.equal(decideVerificationStatus(2), "verified");
  assert.equal(decideVerificationStatus(5), "verified");
});

test("같은 제보자의 중복 제보는 1명으로 센다", () => {
  assert.equal(
    countDistinctReporters([
      { id: "1", reporterUserId: "u1", reporterVisitorId: null },
      { id: "2", reporterUserId: "u1", reporterVisitorId: "v1" },
      { id: "3", reporterUserId: null, reporterVisitorId: "v2" },
      { id: "4", reporterUserId: null, reporterVisitorId: "v2" },
      { id: "5", reporterUserId: null, reporterVisitorId: null },
    ]),
    3,
  );
});

test("제보 상태 전이는 pending_review에서만 가능하다", () => {
  assert.equal(canTransitionPriceReport("pending_review", "accepted"), true);
  assert.equal(canTransitionPriceReport("pending_review", "rejected"), true);
  assert.equal(canTransitionPriceReport("accepted", "rejected"), false);
  assert.equal(canTransitionPriceReport("rejected", "accepted"), false);
  assert.equal(canTransitionPriceReport("accepted", "accepted"), false);
});

test("저장소 선택: DB·mock이 모두 없으면 DATABASE_UNAVAILABLE을 던진다", () => {
  assert.throws(
    () => getPriceReportService({ USE_MOCK_DATA: "false" }),
    (error: unknown) =>
      error instanceof DomainError && error.code === "DATABASE_UNAVAILABLE",
  );
});

test("저장소 선택: mock 모드는 DB 없이 제보를 처리한다", async () => {
  const service = getPriceReportService({ USE_MOCK_DATA: "true" });

  await assert.rejects(
    service.submit("unknown-place", input, actor()),
    (error: unknown) => error instanceof DomainError && error.code === "NOT_FOUND",
  );
});
