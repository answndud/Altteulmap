import assert from "node:assert/strict";
import { test } from "node:test";

import { parsePlaceNote } from "../../src/features/places/note";

test("공공데이터 note를 출처·수집일·전화로 나눈다", () => {
  assert.deepEqual(
    parsePlaceNote("출처: 행정안전부 착한가격업소 / 수집일: 2026-04-05 / 전화: 02-871-7070"),
    {
      source: "행정안전부 착한가격업소",
      collectedAt: "2026-04-05",
      phone: "02-871-7070",
      rest: null,
    },
  );
});

test("일부 항목만 있거나 순서가 달라도 처리한다", () => {
  const parsed = parsePlaceNote("전화: 010-1234-5678 / 출처: 직접 제보");

  assert.equal(parsed.phone, "010-1234-5678");
  assert.equal(parsed.source, "직접 제보");
  assert.equal(parsed.collectedAt, null);
});

test("알 수 없는 조각은 rest에 남기고 값이 비면 무시한다", () => {
  const parsed = parsePlaceNote("점심 특가 / 출처: / 주차 가능");

  assert.equal(parsed.source, null);
  assert.equal(parsed.rest, "점심 특가 / 주차 가능");
});

test("빈 값과 null은 모두 비어 있는 결과다", () => {
  for (const value of [null, undefined, "", "  "]) {
    assert.deepEqual(parsePlaceNote(value), {
      source: null,
      collectedAt: null,
      phone: null,
      rest: null,
    });
  }
});
