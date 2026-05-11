import {
  applyRateLimitHeaders,
  consumeRateLimitPolicy,
  type RateLimitPolicyName,
  type RateLimitResult,
} from "@/lib/rate-limit";

const VISITOR_ID_COOKIE_NAME = "altteulmap_visitor_id";
const VISITOR_ID_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type WorkerSessionUser = {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
};

export type WorkerPublicWriteActor = {
  user: WorkerSessionUser | null;
  visitorId: string | null;
  key: string;
};

function isUuid(value: string | null | undefined) {
  return Boolean(
    value?.match(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    ),
  );
}

function shouldUseSecureCookie(requestUrl: string) {
  const url = new URL(requestUrl);

  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return false;
  }

  return url.protocol === "https:";
}

function getCookieValue(cookieHeader: string | null, cookieName: string) {
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

function getVisitorIdFromRequest(request: Request) {
  return getCookieValue(request.headers.get("cookie"), VISITOR_ID_COOKIE_NAME);
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

function appendCookie(
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

export function getWorkerPublicWriteActor(
  request: Request,
  sessionUser: WorkerSessionUser | null,
  options?: {
    createVisitorIfMissing?: boolean;
  },
): WorkerPublicWriteActor {
  const createVisitorIfMissing = options?.createVisitorIfMissing ?? true;
  const existingVisitorId = sessionUser ? null : getVisitorIdFromRequest(request);
  const visitorId = sessionUser
    ? null
    : (existingVisitorId ??
      (createVisitorIfMissing ? crypto.randomUUID() : null));
  const user = sessionUser
    ? {
        ...sessionUser,
        id: isUuid(sessionUser.id) ? sessionUser.id : "",
      }
    : null;

  return {
    user: user?.id ? user : null,
    visitorId,
    key:
      user?.id ??
      visitorId ??
      request.headers.get("x-forwarded-for") ??
      "guest",
  };
}

function appendPublicWriteActorCookie(
  response: Response,
  request: Request,
  actor: WorkerPublicWriteActor,
) {
  if (!actor.user && actor.visitorId) {
    appendCookie(response, request, {
      name: VISITOR_ID_COOKIE_NAME,
      value: actor.visitorId,
      maxAge: VISITOR_ID_COOKIE_MAX_AGE,
    });
  }

  return response;
}

export function consumeWorkerRateLimit(
  policyName: RateLimitPolicyName,
  actor: WorkerPublicWriteActor,
) {
  return consumeRateLimitPolicy(policyName, actor.key);
}

export function applyWorkerWriteHeaders(
  response: Response,
  request: Request,
  actor: WorkerPublicWriteActor,
  rateLimit?: RateLimitResult,
) {
  appendPublicWriteActorCookie(response, request, actor);

  if (rateLimit) {
    return applyRateLimitHeaders(response, rateLimit);
  }

  return response;
}
