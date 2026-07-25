import { createHmac, timingSafeEqual } from "node:crypto";

import type { WorkerAuthUserRecord } from "@/worker/auth-repository";
import { getCookieValue } from "@/worker/http/cookies";

export const AUTH_SESSION_COOKIE_NAME = "next-auth.session-token";
export const AUTH_CSRF_COOKIE_NAME = "next-auth.csrf-token";
export const AUTH_CALLBACK_COOKIE_NAME = "next-auth.callback-url";
export const AUTH_OAUTH_STATE_COOKIE_NAME = "next-auth.state";
export const AUTH_SESSION_MAX_AGE = 60 * 60 * 24 * 30;
export const AUTH_OAUTH_STATE_MAX_AGE = 60 * 10;

type AuthSessionEnv = {
  AUTH_SECRET?: string;
};

export type LocalSession = {
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

export function createSession(user: WorkerAuthUserRecord): LocalSession {
  return {
    user: toSessionUser(user),
    expires: new Date(Date.now() + AUTH_SESSION_MAX_AGE * 1000).toISOString(),
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

export function encodeSession(session: LocalSession, env: AuthSessionEnv) {
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

function decodeSession(value: string | null, env: AuthSessionEnv) {
  if (!value) {
    return null;
  }

  try {
    if (value.startsWith("v1.")) {
      const signed = decodeSignedPayload<LocalSession>(value, env);

      return signed ? parseSession(JSON.stringify(signed)) : null;
    }

    return parseSession(value);
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: Request, env: AuthSessionEnv) {
  return decodeSession(
    getCookieValue(request.headers.get("cookie"), AUTH_SESSION_COOKIE_NAME),
    env,
  );
}
