import assert from "node:assert/strict";
import { test } from "node:test";

import { DomainError } from "../../src/worker/http/api-error";
import type { WorkerPublicWriteActor } from "../../src/worker/public-write-actor";
import { selectBackend } from "../../src/worker/services/backend";
import { canDeleteComment } from "../../src/worker/services/comment-rules";
import { getCommentService } from "../../src/worker/services/comment-service";
import { getReportService } from "../../src/worker/services/report-service";
import { getSubmissionService } from "../../src/worker/services/submission-service";

const owner = { userId: "user-1", visitorId: "visitor-1" };

test("코멘트 삭제: 운영자는 누구의 글이든 지울 수 있다", () => {
  assert.equal(
    canDeleteComment({ userId: "admin", role: "admin", visitorId: null }, owner),
    true,
  );
});

test("코멘트 삭제: 작성자는 user id 또는 visitor id가 일치할 때만 지운다", () => {
  assert.equal(
    canDeleteComment({ userId: "user-1", role: "user", visitorId: null }, owner),
    true,
  );
  assert.equal(
    canDeleteComment({ userId: null, role: null, visitorId: "visitor-1" }, owner),
    true,
  );
  assert.equal(
    canDeleteComment({ userId: "user-2", role: "user", visitorId: "visitor-2" }, owner),
    false,
  );
});

test("코멘트 삭제: 소유자 정보가 비어 있으면 빈 값끼리 일치로 보지 않는다", () => {
  assert.equal(
    canDeleteComment(
      { userId: null, role: null, visitorId: null },
      { userId: null, visitorId: null },
    ),
    false,
  );
});

test("저장소 선택: 설정이 없으면 DATABASE_UNAVAILABLE", () => {
  assert.throws(
    () =>
      selectBackend({ USE_MOCK_DATA: "false" }, { database: () => 1, mock: () => 2 }, "x"),
    (error: unknown) =>
      error instanceof DomainError && error.code === "DATABASE_UNAVAILABLE",
  );
  assert.equal(
    selectBackend({ USE_MOCK_DATA: "true" }, { database: () => 1, mock: () => 2 }, "x"),
    2,
  );
});

const mockEnv = { USE_MOCK_DATA: "true" };
const visitor: WorkerPublicWriteActor = {
  user: null,
  visitorId: "visitor-a",
  visitorCookieValue: null,
  key: "visitor-a",
};

test("mock 코멘트: 신원 없는 삭제는 FORBIDDEN, 작성자 visitor만 삭제할 수 있다", async () => {
  const service = getCommentService(mockEnv);
  const placeId = "mock-place-for-comment-test";

  // mock 장소가 없으면 NOT_FOUND
  await assert.rejects(
    service.create(placeId, { body: "맛있어요" }, visitor),
    (error: unknown) => error instanceof DomainError && error.code === "NOT_FOUND",
  );

  await assert.rejects(
    service.delete(placeId, "c1", { ...visitor, visitorId: null }),
    (error: unknown) => error instanceof DomainError && error.code === "FORBIDDEN",
  );
});

test("mock 신고·장소 등록은 DB 없이 접수 응답을 만든다", async () => {
  const report = await getReportService(mockEnv).submit(
    {
      placeId: "p1",
      placeName: "김밥집",
      reasonType: "price_error",
      detail: "가격이 달라요",
    },
    visitor,
  );

  assert.equal(report.mock, true);
  assert.equal(report.preview.placeId, "p1");

  const submission = await getSubmissionService(mockEnv).submit(
    {
      name: "새 식당",
      categorySlug: "korean",
      roadAddress: "서울특별시 테스트구 테스트로 1",
      district: "테스트구",
      priceItems: [{ label: "백반", amount: 8000 }],
    },
    visitor,
  );

  assert.equal(submission.source, "mock");
  assert.equal(submission.preview.priceItems.length, 1);
});

test("신고·장소 등록·코멘트 서비스는 설정이 없으면 모두 DATABASE_UNAVAILABLE", () => {
  for (const make of [getReportService, getSubmissionService, getCommentService]) {
    assert.throws(
      () => make({ USE_MOCK_DATA: "false" }),
      (error: unknown) =>
        error instanceof DomainError && error.code === "DATABASE_UNAVAILABLE",
    );
  }
});
