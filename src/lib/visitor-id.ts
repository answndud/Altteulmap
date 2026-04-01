import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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
  response: NextResponse,
  visitorId: string,
  requestUrl?: string,
) {
  response.cookies.set(
    VISITOR_ID_COOKIE_NAME,
    visitorId,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureVisitorCookie(requestUrl),
      path: "/",
      maxAge: VISITOR_ID_COOKIE_MAX_AGE,
    },
  );
}
