import "server-only";

import { cookies } from "next/headers";

const VISITOR_ID_COOKIE_NAME = "altteulmap_visitor_id";
const VISITOR_ID_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function normalizeVisitorId(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function createVisitorId() {
  return crypto.randomUUID();
}

export async function getVisitorIdFromCookie() {
  const cookieStore = await cookies();
  return normalizeVisitorId(cookieStore.get(VISITOR_ID_COOKIE_NAME)?.value);
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    httpOnly?: boolean;
    sameSite?: "lax" | "strict" | "none";
    secure?: boolean;
    path?: string;
    maxAge?: number;
  },
) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  if (options.path) {
    parts.push(`Path=${options.path}`);
  }

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite[0].toUpperCase()}${options.sameSite.slice(1)}`);
  }

  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function shouldUseSecureVisitorCookie(requestUrl?: string) {
  if (!requestUrl) {
    return process.env.NODE_ENV === "production";
  }

  const { hostname, protocol } = new URL(requestUrl);

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return false;
  }

  return protocol === "https:";
}

export function setVisitorIdCookie(
  response: Response,
  visitorId: string,
  requestUrl?: string,
) {
  response.headers.append(
    "Set-Cookie",
    serializeCookie(VISITOR_ID_COOKIE_NAME, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureVisitorCookie(requestUrl),
      path: "/",
      maxAge: VISITOR_ID_COOKIE_MAX_AGE,
    }),
  );
}
