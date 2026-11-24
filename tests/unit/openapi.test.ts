import assert from "node:assert/strict";
import test from "node:test";

import app from "../../src/worker/index";
import {
  apiOperationDocs,
  buildOpenApiDocument,
  listApiRoutes,
  toOpenApiPath,
} from "../../src/worker/http/openapi";

const env = {
  ASSETS: { fetch: () => new Response("ok") },
  AUTH_SECRET: "unit-test-secret",
  USE_MOCK_DATA: "true",
};

async function readSpec() {
  const response = await app.fetch(new Request("http://127.0.0.1/api/openapi.json"), env);

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);

  return (await response.json()) as ReturnType<typeof buildOpenApiDocument>;
}

type Operation = Record<string, unknown> & { summary: string; "x-undocumented"?: boolean };

function listOperations(spec: Awaited<ReturnType<typeof readSpec>>) {
  return Object.entries(spec.paths).flatMap(([path, operations]) =>
    Object.entries(operations).map(([method, operation]) => ({
      key: `${method.toUpperCase()} ${path}`,
      operation: operation as Operation,
    })),
  );
}

test("Hono 경로의 :param 표기를 OpenAPI {param}으로 바꾼다", () => {
  assert.equal(toOpenApiPath("/api/places/:id/comments/:commentId"), "/api/places/{id}/comments/{commentId}");
  assert.equal(toOpenApiPath("/api/health"), "/api/health");
});

test("미들웨어·와일드카드·지원하지 않는 메서드는 문서 대상에서 빠지고 중복은 합친다", () => {
  const routes = listApiRoutes([
    { method: "ALL", path: "/api/*" },
    { method: "GET", path: "/api/health" },
    { method: "GET", path: "/api/health" },
    { method: "OPTIONS", path: "/api/health" },
    { method: "GET", path: "/assets/app.js" },
    { method: "POST", path: "/api/auth/*" },
  ]);

  assert.deepEqual(routes, [{ method: "GET", path: "/api/health" }]);
});

test("서버에 등록된 모든 /api 라우트가 문서에 있고 빠진 설명이 없다", async () => {
  const spec = await readSpec();
  const operations = listOperations(spec);
  const undocumented = operations.filter(({ operation }) => operation["x-undocumented"]);

  assert.deepEqual(
    undocumented.map(({ key }) => key),
    [],
    "새 라우트를 추가했다면 src/worker/http/openapi.ts의 apiOperationDocs에 설명을 추가한다",
  );
  assert.ok(operations.length >= 30, `route count looks too small: ${operations.length}`);
});

test("메타데이터에만 있고 실제로는 없는 라우트(오래된 문서)가 없다", async () => {
  const registered = new Set(
    listOperations(await readSpec()).map(({ key }) => key.replace(/\{(\w+)\}/g, ":$1")),
  );
  const stale = Object.keys(apiOperationDocs).filter((key) => !registered.has(key));

  assert.deepEqual(stale, [], "삭제된 라우트의 문서를 apiOperationDocs에서 지운다");
});

test("스펙이 OpenAPI 3.1 구조와 필수 필드를 갖춘다", async () => {
  const spec = await readSpec();

  assert.equal(spec.openapi, "3.1.0");
  assert.ok(spec.info.title);
  assert.ok(spec.components.schemas.ErrorEnvelope);

  for (const { key, operation } of listOperations(spec)) {
    assert.ok(operation.summary, `${key} needs a summary`);
    assert.ok(operation.responses, `${key} needs responses`);
  }

  for (const path of Object.keys(spec.paths)) {
    assert.ok(path.startsWith("/api/"), path);
    assert.ok(!path.includes(":"), `${path} should use {param} syntax`);
  }
});

test("경로 파라미터가 parameters로 선언된다", async () => {
  const spec = await readSpec();
  const operation = spec.paths["/api/places/{id}/comments/{commentId}"]?.delete as {
    parameters: Array<{ name: string; in: string; required: boolean }>;
  };

  assert.deepEqual(operation.parameters.map((parameter) => parameter.name), ["id", "commentId"]);
  assert.ok(operation.parameters.every((parameter) => parameter.in === "path" && parameter.required));
});

test("요청 본문은 서버가 검증에 쓰는 zod 스키마에서 생성된다", async () => {
  const spec = await readSpec();
  const body = (spec.paths["/api/places/{id}/prices"]?.post as {
    requestBody: { content: { "application/json": { schema: { type: string; properties: Record<string, unknown> } } } };
  }).requestBody.content["application/json"].schema;

  assert.equal(body.type, "object");
  assert.ok(Object.keys(body.properties).length > 0);

  const signup = (spec.paths["/api/auth/signup"]?.post as {
    requestBody: { content: { "application/json": { schema: { properties: Record<string, unknown> } } } };
  }).requestBody.content["application/json"].schema;

  assert.ok("email" in signup.properties);
});

test("관리자·로그인 전용 라우트는 세션 보안 요구를 표시한다", async () => {
  const spec = await readSpec();
  const admin = spec.paths["/api/admin/stats"]?.get as Operation & { security?: unknown[]; "x-access": string };
  const publicRoute = spec.paths["/api/health"]?.get as Operation & { security?: unknown[] };

  assert.equal(admin["x-access"], "admin");
  assert.deepEqual(admin.security, [{ sessionCookie: [] }]);
  assert.equal(publicRoute.security, undefined);
});

test("/api/docs는 외부 스크립트 없이 모든 엔드포인트를 표로 보여 준다", async () => {
  const response = await app.fetch(new Request("http://127.0.0.1/api/docs"), env);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/);
  assert.ok(!html.includes("<script"));
  assert.ok(html.includes("/api/places/{id}/prices"));
  assert.ok(html.includes("/api/admin/stats"));
});
