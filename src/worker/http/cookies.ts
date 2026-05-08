const VISITOR_ID_COOKIE_NAME = "altteulmap_visitor_id";

export function getCookieValue(cookieHeader: string | null, cookieName: string) {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = part.split("=");

    if (rawName?.trim() !== cookieName) {
      continue;
    }

    const rawValue = rawValueParts.join("=").trim();

    if (!rawValue) {
      return null;
    }

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return null;
}

function shouldUseSecureCookie(requestUrl: string) {
  const url = new URL(requestUrl);

  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return false;
  }

  return url.protocol === "https:";
}

function buildCookieParts({
  name,
  value,
  maxAge,
  requestUrl,
}: {
  name: string;
  value: string;
  maxAge?: number;
  requestUrl: string;
}) {
  const cookieParts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (typeof maxAge === "number") {
    cookieParts.splice(1, 0, `Max-Age=${maxAge}`);
  }

  if (shouldUseSecureCookie(requestUrl)) {
    cookieParts.push("Secure");
  }

  return cookieParts;
}

export function appendCookie(
  response: Response,
  request: Request,
  cookie: {
    name: string;
    value: string;
    maxAge?: number;
  },
) {
  response.headers.append(
    "Set-Cookie",
    buildCookieParts({
      ...cookie,
      requestUrl: request.url,
    }).join("; "),
  );

  return response;
}

export function getVisitorIdFromCookie(cookieHeader: string | null) {
  return getCookieValue(cookieHeader, VISITOR_ID_COOKIE_NAME);
}

export function getOrCreateVisitorId(request: Request) {
  return getVisitorIdFromCookie(request.headers.get("cookie")) ?? crypto.randomUUID();
}
