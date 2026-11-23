import assert from "node:assert/strict";
import { test } from "node:test";

import app from "../../src/worker/index";

const assets = {
  fetch: () =>
    new Response("ok", {
      headers: { "content-type": "text/plain" },
    }),
};

function request(path: string, init?: RequestInit) {
  return app.fetch(
    new Request(`http://127.0.0.1${path}`, init),
    {
      ASSETS: assets,
      AUTH_SECRET: "integration-test-secret",
      USE_MOCK_DATA: "true",
    },
  );
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

function getErrorCode(body: Record<string, unknown>) {
  const error = body.error;

  return error && typeof error === "object" && "code" in error
    ? error.code
    : undefined;
}

test("DB 미설정 지도 조회는 성공으로 오인되지 않는 503을 반환한다", async () => {
  const response = await app.fetch(
    new Request("https://api.example.test/api/places/map"),
    {
      ASSETS: assets,
      AUTH_SECRET: "integration-test-secret",
      USE_MOCK_DATA: "false",
    },
  );
  const body = await readJson(response);

  assert.equal(response.status, 503);
  assert.equal(getErrorCode(body), "DATABASE_UNAVAILABLE");
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.ok(response.headers.get("x-request-id"));
});

test("잘못된 JSON과 본문 초과는 bounded error contract를 반환한다", async () => {
  const malformed = await request("/api/places", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not-json",
  });
  const malformedBody = await readJson(malformed);

  assert.equal(malformed.status, 400);
  assert.equal(malformedBody.ok, false);
  assert.equal(malformedBody.message, "입력값 검증에 실패했습니다.");
  assert.equal(malformed.headers.get("cache-control"), "no-store, max-age=0");
  assert.ok(malformed.headers.get("x-request-id"));

  const oversized = await request("/api/places", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "x".repeat(256 * 1024 + 1),
  });
  const oversizedBody = await readJson(oversized);

  assert.equal(oversized.status, 413);
  assert.equal(getErrorCode(oversizedBody), "REQUEST_BODY_TOO_LARGE");
  assert.equal(oversized.headers.get("cache-control"), "no-store, max-age=0");
  assert.ok(oversized.headers.get("x-request-id"));
});

test("지도 검색어 상한은 비용이 큰 입력을 SQL까지 전달하지 않는다", async () => {
  const response = await request(
    `/api/places/map?scope=global&query=${"가".repeat(121)}`,
  );
  const body = await readJson(response);

  assert.equal(response.status, 400);
  assert.equal(getErrorCode(body), "QUERY_TOO_LONG");
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
});

test("공개 등록 rate limit은 동일 visitor의 반복 요청을 429로 제한한다", async () => {
  const body = JSON.stringify({
    name: "장애경로 테스트 장소",
    categorySlug: "korean",
    roadAddress: "서울특별시 테스트구 테스트로 1",
    district: "테스트구",
    priceItems: [{ label: "테스트 메뉴", amount: 7000 }],
  });
  let cookie: string | null = null;
  let limited: Response | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await request("/api/places", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body,
    });

    cookie ??= response.headers.get("set-cookie")?.split(";", 1)[0] ?? null;
    if (response.status === 429) {
      limited = response;
      break;
    }
  }

  assert.ok(limited);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("x-ratelimit-policy"), "place_submission");
  assert.ok(limited.headers.get("retry-after"));
  assert.equal(limited.headers.get("cache-control"), "no-store, max-age=0");
});

test("쿠키 없이 요청마다 새 visitor가 되어도 같은 IP는 429로 제한된다", async () => {
  const body = JSON.stringify({
    name: "쿠키 없는 반복 요청",
    categorySlug: "korean",
    roadAddress: "서울특별시 테스트구 테스트로 2",
    district: "테스트구",
    priceItems: [{ label: "테스트 메뉴", amount: 7000 }],
  });
  const statuses: number[] = [];

  for (let attempt = 0; attempt < 14; attempt += 1) {
    const response = await request("/api/places", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.200",
      },
      body,
    });

    statuses.push(response.status);
  }

  assert.ok(statuses.includes(429), `statuses: ${statuses.join(",")}`);
});

test("라우트가 직접 만든 에러도 표준 envelope(error.code·requestId)로 응답한다", async () => {
  const invalid = await request("/api/places", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "" }),
  });
  const invalidBody = await readJson(invalid);

  assert.equal(invalid.status, 400);
  assert.equal(getErrorCode(invalidBody), "VALIDATION_FAILED");
  assert.ok(typeof invalidBody.message === "string");
  assert.ok(invalidBody.requestId);
  assert.ok(
    (invalidBody.error as { details?: { fieldErrors?: unknown } }).details?.fieldErrors,
  );

  const unauthenticated = await request("/api/admin/places");
  const unauthenticatedBody = await readJson(unauthenticated);

  assert.equal(unauthenticated.status, 401);
  assert.equal(getErrorCode(unauthenticatedBody), "UNAUTHENTICATED");
  assert.ok(unauthenticatedBody.requestId);
});
