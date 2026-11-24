import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import app from "../../src/worker/index";

const assets = { fetch: () => new Response("ok") };
const env = {
  ASSETS: assets,
  AUTH_SECRET: "integration-test-secret",
  USE_MOCK_DATA: "true",
};
const mapUrl =
  "http://127.0.0.1/api/places/map?minLat=37.4&maxLat=37.7&minLng=126.7&maxLng=127.3&zoom=11";
const CACHED_AT = "x-altteulmap-cached-at";

type StoredEntry = { status: number; headers: Headers; body: string };

class FakeEdgeCache {
  entries = new Map<string, StoredEntry>();

  async match(request: Request) {
    const entry = this.entries.get(request.url);

    return entry
      ? new Response(entry.body, { status: entry.status, headers: new Headers(entry.headers) })
      : undefined;
  }

  async put(request: Request, response: Response) {
    this.entries.set(request.url, {
      status: response.status,
      headers: new Headers(response.headers),
      body: await response.text(),
    });
  }

  ageBy(url: string, milliseconds: number) {
    const entry = this.entries.get(url);

    assert.ok(entry, "cached entry should exist");
    entry.headers.set(CACHED_AT, String(Date.now() - milliseconds));
  }

  cachedAt(url: string) {
    return Number(this.entries.get(url)?.headers.get(CACHED_AT));
  }
}

let cache: FakeEdgeCache;
let pending: Promise<unknown>[];
const globalWithCaches = globalThis as unknown as { caches?: unknown };
let originalCaches: unknown;

function fetchMap(withContext = true) {
  const context = {
    waitUntil(promise: Promise<unknown>) {
      pending.push(promise);
    },
    passThroughOnException() {},
  };

  return withContext
    ? app.fetch(new Request(mapUrl), env, context)
    : app.fetch(new Request(mapUrl), env);
}

beforeEach(() => {
  cache = new FakeEdgeCache();
  pending = [];
  originalCaches = globalWithCaches.caches;
  globalWithCaches.caches = { default: cache };
});

afterEach(() => {
  globalWithCaches.caches = originalCaches;
});

test("첫 요청은 미스로 처리하고 저장 시각과 함께 엣지 캐시에 채운다", async () => {
  const response = await fetchMap();

  assert.equal(response.status, 200);
  assert.notEqual(response.headers.get("x-altteulmap-map-cache"), "edge-hit");
  assert.equal(cache.entries.size, 1);
  assert.ok(cache.cachedAt(mapUrl) > Date.now() - 5_000);
  assert.equal(response.headers.get(CACHED_AT), null);
});

test("신선 기간 안의 두 번째 요청은 edge-hit이고 저장 시각 헤더를 노출하지 않는다", async () => {
  await fetchMap();
  const response = await fetchMap();

  assert.equal(response.headers.get("x-altteulmap-map-cache"), "edge-hit");
  assert.equal(response.headers.get(CACHED_AT), null);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(pending.length, 0);
});

test("신선 기간이 지나면 오래된 응답을 먼저 돌려주고 백그라운드에서 갱신한다", async () => {
  await fetchMap();
  cache.ageBy(mapUrl, 100_000);
  const staleCachedAt = cache.cachedAt(mapUrl);

  const response = await fetchMap();

  assert.equal(response.headers.get("x-altteulmap-map-cache"), "edge-stale");
  assert.equal(response.status, 200);
  assert.equal(pending.length, 1);

  await Promise.all(pending);

  assert.ok(cache.cachedAt(mapUrl) > staleCachedAt, "refresh should replace the cached entry");
  const next = await fetchMap();

  assert.equal(next.headers.get("x-altteulmap-map-cache"), "edge-hit");
});

test("갱신이 진행 중이면 같은 URL의 stale 요청이 갱신을 중복 예약하지 않는다", async () => {
  await fetchMap();
  cache.ageBy(mapUrl, 100_000);

  const first = await fetchMap();
  const second = await fetchMap();

  assert.equal(first.headers.get("x-altteulmap-map-cache"), "edge-stale");
  assert.equal(second.headers.get("x-altteulmap-map-cache"), "edge-stale");
  assert.equal(pending.length, 1);
  await Promise.all(pending);
});

test("신선 + stale 기간을 넘기면 캐시가 없는 것처럼 새로 만들어 채운다", async () => {
  await fetchMap();
  cache.ageBy(mapUrl, 1_000_000);

  const response = await fetchMap();

  assert.notEqual(response.headers.get("x-altteulmap-map-cache"), "edge-stale");
  assert.notEqual(response.headers.get("x-altteulmap-map-cache"), "edge-hit");
  assert.equal(pending.length, 0);
  assert.ok(cache.cachedAt(mapUrl) > Date.now() - 5_000);
});

test("실행 컨텍스트가 없으면 stale 응답을 쓰지 않고 새로 만든다", async () => {
  await fetchMap();
  cache.ageBy(mapUrl, 100_000);

  const response = await fetchMap(false);

  assert.notEqual(response.headers.get("x-altteulmap-map-cache"), "edge-stale");
  assert.equal(response.status, 200);
});
