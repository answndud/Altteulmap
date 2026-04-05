import "server-only";

const VISITOR_ID_COOKIE_NAME = "altteulmap_visitor_id";
const VISITOR_ID_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function normalizeVisitorId(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function createVisitorId() {
  return crypto.randomUUID();
}

export function getVisitorIdFromCookieHeader(
  cookieHeader: string | null | undefined,
) {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = part.split("=");

    if (rawName?.trim() !== VISITOR_ID_COOKIE_NAME) {
      continue;
    }

    const rawValue = rawValueParts.join("=").trim();

    if (!rawValue) {
      return null;
    }

    try {
      return normalizeVisitorId(decodeURIComponent(rawValue));
    } catch {
      return normalizeVisitorId(rawValue);
    }
  }

  return null;
}

export function getVisitorIdFromRequest(request: Request) {
  return getVisitorIdFromCookieHeader(request.headers.get("cookie"));
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
