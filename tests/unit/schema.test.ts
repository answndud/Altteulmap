import assert from "node:assert/strict";
import test from "node:test";

import {
  placeModerationSchema,
  placeSubmissionSchema,
} from "../../src/features/submission/schema";
import {
  adminPriceItemUpdateSchema,
  placeCommentSchema,
  placePriceReportSchema,
} from "../../src/features/places/write-schema";

test("place submission schema trims fields and rejects duplicate price labels", () => {
  const valid = placeSubmissionSchema.parse({
    name: "  알뜰식당  ",
    categorySlug: "korean",
    roadAddress: "서울특별시 중구 세종대로 110",
    district: "서울 중구",
    priceItems: [{ label: " 김밥 ", amount: "3500", unitLabel: "1줄" }],
  });

  assert.equal(valid.name, "알뜰식당");
  assert.equal(valid.priceItems[0]?.amount, 3500);

  const duplicate = placeSubmissionSchema.safeParse({
    ...valid,
    priceItems: [
      { label: "김밥", amount: 3500 },
      { label: " 김밥 ", amount: 3500 },
    ],
  });

  assert.equal(duplicate.success, false);
});

test("place moderation schema requires coordinates only for approval", () => {
  assert.equal(
    placeModerationSchema.safeParse({ decision: "reject" }).success,
    true,
  );
  assert.equal(
    placeModerationSchema.safeParse({ decision: "approve" }).success,
    false,
  );
  assert.equal(
    placeModerationSchema.safeParse({
      decision: "approve",
      latitude: "37.5665",
      longitude: "126.978",
    }).success,
    true,
  );
});

test("public write schemas coerce prices and preserve validation limits", () => {
  assert.equal(placeCommentSchema.safeParse({ body: "한 줄" }).success, true);
  assert.equal(placeCommentSchema.safeParse({ body: "x" }).success, false);

  const priceReport = placePriceReportSchema.parse({
    label: "제육",
    amount: "7000",
    comment: "점심",
  });

  assert.equal(priceReport.amount, 7000);
  assert.equal(
    adminPriceItemUpdateSchema.safeParse({
      label: "제육",
      amount: 7000,
      verificationStatus: "verified",
      isRepresentative: true,
      isActive: true,
    }).success,
    true,
  );
});
