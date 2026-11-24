import assert from "node:assert/strict";
import test from "node:test";

import { getEdgeCacheFreshness } from "../../src/worker/http/edge-cache-freshness";

const now = 1_000_000_000_000;

test("저장 후 신선 기간 이내는 fresh다", () => {
  assert.equal(getEdgeCacheFreshness(now - 10_000, now, 60, 180), "fresh");
  assert.equal(getEdgeCacheFreshness(now - 60_000, now, 60, 180), "fresh");
});

test("신선 기간을 넘고 stale 기간 이내는 stale이다", () => {
  assert.equal(getEdgeCacheFreshness(now - 60_001, now, 60, 180), "stale");
  assert.equal(getEdgeCacheFreshness(now - 240_000, now, 60, 180), "stale");
});

test("신선 + stale 기간을 넘으면 expired다", () => {
  assert.equal(getEdgeCacheFreshness(now - 240_001, now, 60, 180), "expired");
  assert.equal(getEdgeCacheFreshness(now - 3_600_000, now, 60, 180), "expired");
});

test("저장 시각이 없거나 잘못되면 fresh로 본다", () => {
  assert.equal(getEdgeCacheFreshness(null, now, 60, 180), "fresh");
  assert.equal(getEdgeCacheFreshness(Number.NaN, now, 60, 180), "fresh");
});

test("시계가 어긋나 저장 시각이 미래여도 fresh로 본다", () => {
  assert.equal(getEdgeCacheFreshness(now + 5_000, now, 60, 180), "fresh");
});

test("stale 기간이 0이면 신선 기간 뒤 바로 expired다", () => {
  assert.equal(getEdgeCacheFreshness(now - 61_000, now, 60, 0), "expired");
});
