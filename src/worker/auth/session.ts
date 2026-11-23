import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { and, eq, gt, lt } from "drizzle-orm";

import { authSessions, users } from "@/db/schema";
import type { WorkerAuthUserRecord } from "@/worker/auth/auth-repository";
import {
  getWorkerDb,
  isWorkerDatabaseEnabled,
  isWorkerMockDataEnabled,
  withExistingOrNewWorkerDatabaseConnection,
  type WorkerDatabaseBindings,
} from "@/worker/db";
import { getCookieValue } from "@/worker/http/cookies";

export const AUTH_SESSION_COOKIE_NAME = "altteulmap.session";
export const AUTH_CSRF_COOKIE_NAME = "altteulmap.csrf";
export const AUTH_CALLBACK_COOKIE_NAME = "altteulmap.callback";
export const AUTH_OAUTH_STATE_COOKIE_NAME = "altteulmap.oauth-state";
// 절대 만료 7일. 연장(sliding)하지 않아 탈취된 토큰의 수명이 길어지지 않는다.
const AUTH_SESSION_MAX_AGE = 60 * 60 * 24 * 7;
export const AUTH_OAUTH_STATE_MAX_AGE = 60 * 10;

type AuthSessionEnv = {
  AUTH_SECRET?: string;
};
type SessionEnv = AuthSessionEnv & WorkerDatabaseBindings;

type LocalSession = {
  user: {
    id: string;
    email: string;
    name: string;
    role: WorkerAuthUserRecord["role"];
  };
  expires: string;
};

function toSessionUser(user: WorkerAuthUserRecord): LocalSession["user"] {
  return {
    id: user.id,
    email: user.email,
    name: user.nickname ?? user.email.split("@")[0] ?? user.email,
    role: user.role,
  };
}

function getAuthSecret(env: AuthSessionEnv) {
  const secret = env.AUTH_SECRET?.trim();

  if (!secret) {
    throw new Error("AUTH_SECRET is required to sign or verify sessions.");
  }

  return secret;
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signSessionPayload(payload: string, env: AuthSessionEnv) {
  return createHmac("sha256", getAuthSecret(env)).update(payload).digest("base64url");
}

function timingSafeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function encodeSignedPayload(value: unknown, env: AuthSessionEnv) {
  const payload = toBase64Url(JSON.stringify(value));
  const signature = signSessionPayload(payload, env);

  return `v1.${payload}.${signature}`;
}

export function decodeSignedPayload<T>(
  value: string | null,
  env: AuthSessionEnv,
): T | null {
  if (!value) {
    return null;
  }

  try {
    const [version, payload, signature] = value.split(".");

    if (version !== "v1" || !payload || !signature) {
      return null;
    }

    const expectedSignature = signSessionPayload(payload, env);

    if (!timingSafeStringEqual(signature, expectedSignature)) {
      return null;
    }

    return JSON.parse(fromBase64Url(payload)) as T;
  } catch {
    return null;
  }
}

// DB 없이 동작하는 mock 모드 전용: role이 쿠키에 들어가므로 운영 경로에서는 쓰지 않는다.
function encodeMockSession(session: LocalSession, env: AuthSessionEnv) {
  return encodeSignedPayload(session, env);
}

function parseSession(value: string) {
  const parsed = JSON.parse(value) as LocalSession;

  if (!parsed.user?.id || !parsed.user.email || !parsed.expires) {
    return null;
  }

  if (Date.parse(parsed.expires) <= Date.now()) {
    return null;
  }

  if (parsed.user.role !== "admin" && parsed.user.role !== "user") {
    return null;
  }

  return parsed;
}

function decodeMockSession(value: string, env: AuthSessionEnv) {
  try {
    if (value.startsWith("v1.")) {
      const signed = decodeSignedPayload<LocalSession>(value, env);

      return signed ? parseSession(JSON.stringify(signed)) : null;
    }

    return null;
  } catch {
    return null;
  }
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function generateSessionToken() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
    "base64url",
  );
}

/**
 * 로그인 성공 시 세션을 발급한다. 운영(DB) 경로는 랜덤 토큰을 쿠키에 담고 DB에는
 * SHA-256 해시만 저장해, DB가 유출돼도 쿠키로 재사용할 수 없고 서버에서 폐기할 수 있다.
 */
export async function issueSession(env: SessionEnv, user: WorkerAuthUserRecord) {
  const expires = new Date(Date.now() + AUTH_SESSION_MAX_AGE * 1000);

  if (isWorkerMockDataEnabled(env)) {
    return {
      value: encodeMockSession(
        { user: toSessionUser(user), expires: expires.toISOString() },
        env,
      ),
      maxAge: AUTH_SESSION_MAX_AGE,
    };
  }

  const token = generateSessionToken();

  await withExistingOrNewWorkerDatabaseConnection(env, () =>
    getWorkerDb(env).insert(authSessions).values({
      sessionToken: hashSessionToken(token),
      userId: user.id,
      expires,
    }),
  );

  return { value: token, maxAge: AUTH_SESSION_MAX_AGE };
}

/** 요청 쿠키로 세션을 찾는다. role·이메일은 매번 users에서 읽어 강등이 즉시 반영된다. */
export async function getSessionFromRequest(
  request: Request,
  env: SessionEnv,
): Promise<LocalSession | null> {
  const cookieValue = getCookieValue(
    request.headers.get("cookie"),
    AUTH_SESSION_COOKIE_NAME,
  );

  if (!cookieValue) {
    return null;
  }

  if (isWorkerMockDataEnabled(env)) {
    return decodeMockSession(cookieValue, env);
  }

  if (!isWorkerDatabaseEnabled(env)) {
    return null;
  }

  const [row] = await withExistingOrNewWorkerDatabaseConnection(env, () =>
    getWorkerDb(env)
      .select({
        id: users.id,
        email: users.email,
        nickname: users.nickname,
        role: users.role,
        expires: authSessions.expires,
      })
      .from(authSessions)
      .innerJoin(users, eq(users.id, authSessions.userId))
      .where(
        and(
          eq(authSessions.sessionToken, hashSessionToken(cookieValue)),
          gt(authSessions.expires, new Date()),
        ),
      )
      .limit(1),
  );

  if (!row) {
    return null;
  }

  return {
    user: toSessionUser(row),
    expires: row.expires.toISOString(),
  };
}

/** 로그아웃: 현재 쿠키의 세션 행을 삭제해 토큰을 즉시 무효화한다. */
export async function revokeSession(request: Request, env: SessionEnv) {
  const cookieValue = getCookieValue(
    request.headers.get("cookie"),
    AUTH_SESSION_COOKIE_NAME,
  );

  if (!cookieValue || isWorkerMockDataEnabled(env) || !isWorkerDatabaseEnabled(env)) {
    return;
  }

  await withExistingOrNewWorkerDatabaseConnection(env, () =>
    getWorkerDb(env)
      .delete(authSessions)
      .where(eq(authSessions.sessionToken, hashSessionToken(cookieValue))),
  );
}

/** role 강등·비밀번호 변경처럼 사용자의 모든 기기 세션을 끊어야 할 때 쓴다. */
export async function revokeUserSessions(env: SessionEnv, userId: string) {
  if (isWorkerMockDataEnabled(env) || !isWorkerDatabaseEnabled(env)) {
    return;
  }

  await withExistingOrNewWorkerDatabaseConnection(env, () =>
    getWorkerDb(env).delete(authSessions).where(eq(authSessions.userId, userId)),
  );
}

/** 만료된 세션 행 정리. 요청 경로가 아니라 cron(scheduled)에서만 호출한다. */
export async function deleteExpiredSessions(env: SessionEnv) {
  if (isWorkerMockDataEnabled(env) || !isWorkerDatabaseEnabled(env)) {
    return 0;
  }

  const deleted = await withExistingOrNewWorkerDatabaseConnection(env, () =>
    getWorkerDb(env)
      .delete(authSessions)
      .where(lt(authSessions.expires, new Date()))
      .returning({ userId: authSessions.userId }),
  );

  return deleted.length;
}

export function isValidCsrfToken(request: Request, token: string | null) {
  if (!token) {
    return false;
  }

  const cookieToken = getCookieValue(
    request.headers.get("cookie"),
    AUTH_CSRF_COOKIE_NAME,
  )?.split("|", 1)[0];

  return Boolean(cookieToken && timingSafeStringEqual(cookieToken, token));
}
