import { after, before, test } from "node:test";
import assert from "node:assert/strict";

import { and, eq, or } from "drizzle-orm";

import {
  authAccounts,
  authSessions,
  bookmarks,
  comments,
  placeReactions,
  places,
  priceItems,
  users,
  visitActivities,
} from "../../src/db/schema";
import {
  AUTH_SESSION_COOKIE_NAME,
  issueSession,
  revokeUserSessions,
} from "../../src/worker/auth/session";
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

async function sessionCookie(id: string, email: string, role: "admin" | "user") {
  // 쿠키에는 랜덤 토큰만 들어가고, role은 요청마다 DB의 users에서 읽는다.
  const session = await withWorkerDatabaseConnection(workerEnv, () =>
    issueSession(workerEnv, { id, email, nickname: role, role }),
  );

  return `${AUTH_SESSION_COOKIE_NAME}=${session.value}`;
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
    await sessionCookie(userId, `${fixturePrefix}-user@example.test`, "user"),
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
    await sessionCookie(adminId, `${fixturePrefix}-admin@example.test`, "admin"),
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
  const userCookie = await sessionCookie(userId, `${fixturePrefix}-user@example.test`, "user");
  const otherCookie = await sessionCookie(otherUserId, `${fixturePrefix}-other@example.test`, "user");
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
    assert.equal((response.headers.get("set-cookie") ?? "").includes(AUTH_SESSION_COOKIE_NAME), false);
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
  assert.equal((response.headers.get("set-cookie") ?? "").includes(AUTH_SESSION_COOKIE_NAME), false);
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

test("로그아웃하면 같은 쿠키로 더 이상 세션이 유지되지 않는다", async () => {
  const cookie = await sessionCookie(userId, `${fixturePrefix}-user@example.test`, "user");
  const before = await readJson(await request("/api/auth/session", cookie));

  assert.equal((before.user as { id: string }).id, userId);

  const signout = await request("/api/auth/signout", cookie, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ json: "true" }),
  });

  assert.equal(signout.status, 200);
  assert.deepEqual(await readJson(await request("/api/auth/session", cookie)), {});
});

test("세션 쿠키에는 role·이메일이 없고 DB에는 토큰 해시만 저장된다", async () => {
  const cookie = await sessionCookie(adminId, `${fixturePrefix}-admin@example.test`, "admin");
  const token = cookie.split("=")[1] ?? "";

  assert.equal(token.includes("admin"), false);
  assert.equal(token.includes("."), false);

  const rows = await withWorkerDatabaseConnection(workerEnv, () =>
    getWorkerDb(workerEnv)
      .select({ sessionToken: authSessions.sessionToken })
      .from(authSessions)
      .where(eq(authSessions.userId, adminId)),
  );

  assert.ok(rows.length >= 1);
  assert.equal(rows.some((row) => row.sessionToken === token), false);
});

test("만료된 세션과 위조 토큰은 거부되고 강등은 즉시 반영된다", async () => {
  const cookie = await sessionCookie(userId, `${fixturePrefix}-user@example.test`, "user");

  // 위조·미발급 토큰
  assert.deepEqual(
    await readJson(
      await request("/api/auth/session", `${AUTH_SESSION_COOKIE_NAME}=forged-token`),
    ),
    {},
  );

  // 만료: 모든 세션의 expires를 과거로 돌린다
  await withWorkerDatabaseConnection(workerEnv, () =>
    getWorkerDb(workerEnv)
      .update(authSessions)
      .set({ expires: new Date(Date.now() - 1000) })
      .where(eq(authSessions.userId, userId)),
  );
  assert.deepEqual(await readJson(await request("/api/auth/session", cookie)), {});

  // 강등: 새 세션을 발급한 뒤 role을 바꾸면 쿠키 재발급 없이 즉시 반영된다
  const adminCookie = await sessionCookie(adminId, `${fixturePrefix}-admin@example.test`, "admin");
  await withWorkerDatabaseConnection(workerEnv, () =>
    getWorkerDb(workerEnv).update(users).set({ role: "user" }).where(eq(users.id, adminId)),
  );
  const demoted = await readJson(await request("/api/auth/session", adminCookie));

  assert.equal((demoted.user as { role: string }).role, "user");

  await withWorkerDatabaseConnection(workerEnv, () =>
    getWorkerDb(workerEnv).update(users).set({ role: "admin" }).where(eq(users.id, adminId)),
  );
});

test("revokeUserSessions는 사용자의 모든 세션을 끊는다", async () => {
  const first = await sessionCookie(otherUserId, `${fixturePrefix}-other@example.test`, "user");
  const second = await sessionCookie(otherUserId, `${fixturePrefix}-other@example.test`, "user");

  await withWorkerDatabaseConnection(workerEnv, () =>
    revokeUserSessions(workerEnv, otherUserId),
  );

  assert.deepEqual(await readJson(await request("/api/auth/session", first)), {});
  assert.deepEqual(await readJson(await request("/api/auth/session", second)), {});
});

test("관리자 지표 API는 권한을 검사하고 실제 방문 기록을 집계한다", async () => {
  const userCookie = await sessionCookie(userId, `${fixturePrefix}-user@example.test`, "user");
  const adminCookie = await sessionCookie(adminId, `${fixturePrefix}-admin@example.test`, "admin");

  assert.equal((await request("/api/admin/stats")).status, 401);
  assert.equal((await request("/api/admin/stats", userCookie)).status, 403);

  type Stats = {
    users: { total: number };
    visits: { hitsToday: number; visitorsToday: number; visitorsLast7Days: number };
    shares: { hitsToday: number; bySource: Array<{ source: string; hits: number }> };
  };
  const read = async () =>
    (await (await request("/api/admin/stats", adminCookie)).json()) as Stats;
  const before = await read();

  assert.ok(before.users.total >= 3);

  const actorA = `${fixturePrefix}-visitor-a`;
  const actorB = `${fixturePrefix}-visitor-b`;
  const now = new Date();

  await withWorkerDatabaseConnection(workerEnv, async () => {
    const db = getWorkerDb(workerEnv);
    const today = new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const row = (actorKey: string, hitCount: number, shared: boolean) => ({
      actorKey,
      visitorId: actorKey.slice(-24),
      routeGroup: shared ? "place" : "map",
      routePath: "/place/stats-test",
      entryRef: shared ? "share" : null,
      entrySource: shared ? "trending" : null,
      visitDate: today,
      bucketStartedAt: new Date(now.getTime() - (shared ? 0 : 3600_000)),
      hitCount,
      firstVisitedAt: now,
      lastVisitedAt: now,
    });

    await db.insert(visitActivities).values([row(actorA, 3, true), row(actorB, 2, false)]);
  });

  try {
    const after = await read();

    assert.equal(after.visits.hitsToday - before.visits.hitsToday, 5);
    assert.equal(after.visits.visitorsToday - before.visits.visitorsToday, 2);
    assert.equal(after.visits.visitorsLast7Days - before.visits.visitorsLast7Days, 2);
    assert.equal(after.shares.hitsToday - before.shares.hitsToday, 3);
    assert.ok(
      (after.shares.bySource.find((item) => item.source === "trending")?.hits ?? 0) >=
        3,
    );
  } finally {
    await withWorkerDatabaseConnection(workerEnv, () =>
      getWorkerDb(workerEnv)
        .delete(visitActivities)
        .where(or(eq(visitActivities.actorKey, actorA), eq(visitActivities.actorKey, actorB))),
    );
  }
});

test("잘못된 OAuth callback은 500이 아니라 로그인 오류로 리다이렉트하고 세션을 만들지 않는다", async () => {
  // Response.redirect()의 불변 헤더에 쿠키를 붙이다 TypeError(500)가 나던 회귀를 막는다.
  const response = await app.fetch(
    new Request(
      "http://127.0.0.1/api/auth/callback/kakao?code=synthetic-invalid-code&state=synthetic-invalid-state",
    ),
    { ...workerEnv, AUTH_KAKAO_CLIENT_ID: "client-id", AUTH_KAKAO_CLIENT_SECRET: "client-secret" },
  );
  const location = new URL(response.headers.get("location") ?? "", "http://127.0.0.1");

  assert.equal(response.status, 302);
  assert.equal(location.pathname, "/login");
  assert.equal(location.searchParams.get("error"), "OAuthCallback");
  assert.equal((response.headers.get("set-cookie") ?? "").includes(AUTH_SESSION_COOKIE_NAME), false);
});

test("장소 상세는 한 번의 쿼리 묶음으로 가격·코멘트·내 반응을 함께 돌려준다", async () => {
  const commentId = crypto.randomUUID();

  await withWorkerDatabaseConnection(workerEnv, async () => {
    const db = getWorkerDb(workerEnv);

    await db.insert(priceItems).values({
      placeId,
      label: "상세 테스트 메뉴",
      normalizedLabel: "상세 테스트 메뉴",
      amount: 7000,
      isActive: true,
      isRepresentative: true,
      verificationStatus: "unverified",
    });
    await db.insert(comments).values({
      id: commentId,
      placeId,
      userId,
      body: "상세 테스트 코멘트",
      status: "visible",
    });
    await db.insert(placeReactions).values({ placeId, userId, reactionType: "like" });
  });

  try {
    const anonymous = await readJson(await request(`/api/places/${placeSlug}`));
    const item = anonymous.item as {
      name: string;
      priceItems: Array<{ label: string }>;
      comments: Array<{ body: string; canDelete: boolean }>;
      viewerReaction: string | null;
    };

    assert.equal(item.name, "권한 통합 테스트 장소");
    assert.deepEqual(item.priceItems.map((priceItem) => priceItem.label), ["상세 테스트 메뉴"]);
    assert.equal(item.comments[0]?.body, "상세 테스트 코멘트");
    assert.equal(item.comments[0]?.canDelete, false);
    assert.equal(item.viewerReaction ?? null, null);

    const mine = await readJson(
      await request(
        `/api/places/${placeSlug}`,
        await sessionCookie(userId, `${fixturePrefix}-user@example.test`, "user"),
      ),
    );
    const mineItem = mine.item as {
      comments: Array<{ canDelete: boolean }>;
      viewerReaction: string | null;
    };

    assert.equal(mineItem.viewerReaction, "like");
    assert.equal(mineItem.comments[0]?.canDelete, true);

    const missing = await request("/api/places/no-such-place-slug");

    assert.equal(missing.status, 404);
  } finally {
    await withWorkerDatabaseConnection(workerEnv, async () => {
      const db = getWorkerDb(workerEnv);

      await db.delete(placeReactions).where(eq(placeReactions.placeId, placeId));
      await db.delete(comments).where(eq(comments.id, commentId));
      await db.delete(priceItems).where(eq(priceItems.placeId, placeId));
    });
  }
});
