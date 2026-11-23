import { after, before, test } from "node:test";
import assert from "node:assert/strict";

import { and, eq } from "drizzle-orm";

import { authAccounts, bookmarks, places, users } from "../../src/db/schema";
import { encodeSession } from "../../src/worker/auth/session";
import app from "../../src/worker/index";
import {
  closeWorkerDatabaseConnection,
  getWorkerDb,
  markWorkerDatabaseUnavailable,
  withWorkerDatabaseConnection,
} from "../../src/worker/db";
import { assertTestDatabaseReady, getTestDatabaseUrl } from "./test-database";

const databaseUrl = getTestDatabaseUrl();
const authSecret = "authorization-integration-secret";
const workerEnv = {
  ASSETS: { fetch: () => new Response("ok") },
  AUTH_SECRET: authSecret,
  DATABASE_URL: databaseUrl,
  USE_MOCK_DATA: "false",
};
const fixturePrefix = `authorization-${crypto.randomUUID()}`;
let adminId: string;
let userId: string;
let otherUserId: string;
let placeId: string;
let placeSlug: string;

function sessionCookie(id: string, email: string, role: "admin" | "user") {
  const session = {
    user: { id, email, name: role, role },
    expires: new Date(Date.now() + 60_000).toISOString(),
  };

  return `next-auth.session-token=${encodeSession(session, { AUTH_SECRET: authSecret })}`;
}

function request(path: string, cookie?: string, init?: RequestInit) {
  return app.fetch(
    new Request(`http://127.0.0.1${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        ...(cookie ? { cookie } : {}),
      },
    }),
    workerEnv,
  );
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

before(async () => {
  await assertTestDatabaseReady();
  await withWorkerDatabaseConnection(workerEnv, async () => {
    const db = getWorkerDb(workerEnv);
    adminId = crypto.randomUUID();
    userId = crypto.randomUUID();
    otherUserId = crypto.randomUUID();
    placeId = crypto.randomUUID();
    placeSlug = `${fixturePrefix}-place`;

    await db.insert(users).values([
      { id: adminId, email: `${fixturePrefix}-admin@example.test`, role: "admin", nickname: "admin" },
      { id: userId, email: `${fixturePrefix}-user@example.test`, role: "user", nickname: "user" },
      { id: otherUserId, email: `${fixturePrefix}-other@example.test`, role: "user", nickname: "other" },
    ]);
    await db.insert(places).values({
      id: placeId,
      slug: placeSlug,
      name: "권한 통합 테스트 장소",
      roadAddress: "서울특별시 테스트구 테스트로 1",
      district: "테스트구",
      latitude: 37.5,
      longitude: 127,
      status: "active",
      primaryCategorySlug: "korean",
    });
  });
});

after(async () => {
  await withWorkerDatabaseConnection(workerEnv, async () => {
    const db = getWorkerDb(workerEnv);
    await db.delete(bookmarks).where(eq(bookmarks.placeId, placeId));
    await db.delete(places).where(eq(places.id, placeId));
    await db.delete(users).where(and(eq(users.id, adminId)));
    await db.delete(users).where(and(eq(users.id, userId)));
    await db.delete(users).where(and(eq(users.id, otherUserId)));
  });
  await closeWorkerDatabaseConnection();
});

test("인증되지 않은 요청은 관리자 API에 접근할 수 없다", async () => {
  const response = await request("/api/admin/places");
  const body = await readJson(response);

  assert.equal(response.status, 401);
  assert.equal(body.ok, false);
});

test("일반 사용자 session은 관리자 role을 대신하지 못한다", async () => {
  const response = await request(
    "/api/admin/places",
    sessionCookie(userId, `${fixturePrefix}-user@example.test`, "user"),
  );
  const body = await readJson(response);

  assert.equal(response.status, 403);
  assert.equal(body.ok, false);
});

test("관리자 session도 DB role이 강등되면 관리자 API가 거부한다", async () => {
  await withWorkerDatabaseConnection(workerEnv, async () => {
    const db = getWorkerDb(workerEnv);
    await db.update(users).set({ role: "user" }).where(eq(users.id, adminId));
  });

  const response = await request(
    "/api/admin/places",
    sessionCookie(adminId, `${fixturePrefix}-admin@example.test`, "admin"),
  );
  const body = await readJson(response);

  assert.equal(response.status, 403);
  assert.equal(body.ok, false);

  await withWorkerDatabaseConnection(workerEnv, async () => {
    const db = getWorkerDb(workerEnv);
    await db.update(users).set({ role: "admin" }).where(eq(users.id, adminId));
  });
});

test("bookmark는 actor별로만 조회·변경된다", async () => {
  const userCookie = sessionCookie(userId, `${fixturePrefix}-user@example.test`, "user");
  const otherCookie = sessionCookie(otherUserId, `${fixturePrefix}-other@example.test`, "user");
  const saveResponse = await request(`/api/bookmarks/${placeSlug}`, userCookie, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bookmarked: true }),
  });

  assert.equal(saveResponse.status, 200);

  const otherListResponse = await request("/api/bookmarks", otherCookie);
  const otherList = await readJson(otherListResponse);
  assert.equal(otherList.count, 0);

  const otherDeleteResponse = await request(`/api/bookmarks/${placeSlug}`, otherCookie, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bookmarked: false }),
  });
  assert.equal(otherDeleteResponse.status, 200);

  const ownerListResponse = await request("/api/bookmarks", userCookie);
  const ownerList = await readJson(ownerListResponse);
  assert.equal(ownerList.count, 1);

  await withWorkerDatabaseConnection(workerEnv, async () => {
    const db = getWorkerDb(workerEnv);
    await db.delete(bookmarks).where(eq(bookmarks.userId, userId));
  });
});

async function loginAsAdmin(password: string, env: Record<string, unknown>) {
  const csrfResponse = await app.fetch(
    new Request("http://127.0.0.1/api/auth/csrf"),
    env,
  );
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };
  const csrfCookie = (csrfResponse.headers.get("set-cookie") ?? "").split(";")[0];

  return app.fetch(
    new Request("http://127.0.0.1/api/auth/callback/credentials", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        cookie: csrfCookie,
        "cf-connecting-ip": `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify({
        csrfToken,
        email: "admin@altteulmap.local",
        password,
        json: "true",
      }),
    }),
    env,
  );
}

test("DB circuit breaker가 열려도 공개된 기본 비밀번호로 관리자 세션이 발급되지 않는다", async () => {
  const globals = globalThis as { __altteulmapWorkerDbUnavailableUntil?: number };

  markWorkerDatabaseUnavailable();
  try {
    const response = await loginAsAdmin("admin1234", workerEnv);

    assert.equal(response.status, 503);
    assert.equal((response.headers.get("set-cookie") ?? "").includes("session-token"), false);
  } finally {
    globals.__altteulmapWorkerDbUnavailableUntil = 0;
  }
});

test("DB 모드에서는 env 평문 비밀번호로 로그인할 수 없다", async () => {
  const response = await loginAsAdmin("env-only-secret", {
    ...workerEnv,
    AUTH_ADMIN_PASSWORD: "env-only-secret",
  });

  assert.equal(response.status, 401);
  assert.equal((response.headers.get("set-cookie") ?? "").includes("session-token"), false);
});

test("같은 이메일의 동시 회원가입은 500 없이 201 하나와 409만 반환한다", async () => {
  const email = `${fixturePrefix}-signup@example.test`;
  const signup = (suffix: number) =>
    request("/api/auth/signup", undefined, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": `203.0.113.${suffix}`,
      },
      body: JSON.stringify({ email, nickname: "동시가입", password: "password-1234" }),
    });

  try {
    const responses = await Promise.all([signup(11), signup(12), signup(13)]);
    const statuses = responses.map((response) => response.status).sort();

    assert.deepEqual(statuses, [201, 409, 409]);
  } finally {
    await withWorkerDatabaseConnection(workerEnv, async () => {
      const db = getWorkerDb(workerEnv);
      await db.delete(authAccounts).where(eq(authAccounts.providerAccountId, email));
      await db.delete(users).where(eq(users.email, email));
    });
  }
});

test("교차 출처 변경 요청은 403으로 거부된다", async () => {
  const response = await request("/api/bookmarks", undefined, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://evil.example",
    },
    body: "{}",
  });
  const body = await readJson(response);

  assert.equal(response.status, 403);
  assert.deepEqual((body.error as { code: string }).code, "CROSS_SITE_REQUEST");
});

test("health 응답은 내부 에러 문자열을 노출하지 않는다", async () => {
  const response = await app.fetch(new Request("http://127.0.0.1/api/health?deep=1"), {
    ...workerEnv,
    DATABASE_URL: "postgresql://nobody:wrong@127.0.0.1:1/none",
  });
  const text = await response.text();

  assert.equal(text.includes("ECONNREFUSED"), false);
  assert.equal(text.includes("127.0.0.1:1"), false);
});
