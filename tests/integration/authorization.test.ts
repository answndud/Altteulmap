import { after, before, test } from "node:test";
import assert from "node:assert/strict";

import { and, eq } from "drizzle-orm";

import { bookmarks, places, users } from "../../src/db/schema";
import { encodeSession } from "../../src/worker/auth/session";
import app from "../../src/worker/index";
import {
  closeWorkerDatabaseConnection,
  getWorkerDb,
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
