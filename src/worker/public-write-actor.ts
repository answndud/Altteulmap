import {
  applyRateLimitHeaders,
  consumeRateLimit,
  consumeRateLimitPolicy,
  RATE_LIMIT_POLICIES,
  type RateLimitPolicyName,
  type RateLimitResult,
} from "@/lib/rate-limit";
import {
  decodeSignedPayload,
  encodeSignedPayload,
} from "@/worker/auth/session";

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
  visitorCookieValue: string | null;
  key: string;
  /** Cloudflare가 채우는 CF-Connecting-IP. 로컬·테스트에서는 없을 수 있다. */
  ip?: string | null;
};

type VisitorCookiePayload = {
  visitorId: string;
  expiresAt: number;
};

type VisitorActorEnv = {
  AUTH_SECRET?: string;
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

export function getVerifiedVisitorIdFromRequest(
  request: Request,
  env: VisitorActorEnv,
) {
  const value = getCookieValue(request.headers.get("cookie"), VISITOR_ID_COOKIE_NAME);
  const payload = decodeSignedPayload<VisitorCookiePayload>(value, env);

  if (
    !payload ||
    !isUuid(payload.visitorId) ||
    !Number.isFinite(payload.expiresAt) ||
    payload.expiresAt <= Date.now()
  ) {
    return null;
  }

  return payload.visitorId;
}

function createVisitorCookieValue(visitorId: string, env: VisitorActorEnv) {
  return encodeSignedPayload(
    {
      visitorId,
      expiresAt: Date.now() + VISITOR_ID_COOKIE_MAX_AGE * 1000,
    } satisfies VisitorCookiePayload,
    env,
  );
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
    env?: VisitorActorEnv;
  },
): WorkerPublicWriteActor {
  const createVisitorIfMissing = options?.createVisitorIfMissing ?? true;
  const existingVisitorId =
    sessionUser || !options?.env
      ? null
      : getVerifiedVisitorIdFromRequest(request, options.env);
  const visitorId = sessionUser
    ? null
    : (existingVisitorId ??
      (createVisitorIfMissing ? crypto.randomUUID() : null));
  const visitorCookieValue =
    visitorId && options?.env
      ? createVisitorCookieValue(visitorId, options.env)
      : null;
  const user = sessionUser
    ? {
        ...sessionUser,
        id: isUuid(sessionUser.id) ? sessionUser.id : "",
      }
    : null;

  const ip = request.headers.get("CF-Connecting-IP")?.trim() || null;

  return {
    user: user?.id ? user : null,
    visitorId,
    visitorCookieValue,
    // x-forwarded-for는 클라이언트가 위조할 수 있어 키로 쓰지 않는다.
    key: user?.id ?? visitorId ?? ip ?? "guest",
    ip,
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
      value: actor.visitorCookieValue ?? actor.visitorId,
      maxAge: VISITOR_ID_COOKIE_MAX_AGE,
    });
  }

  return response;
}

export function consumeWorkerRateLimit(
  policyName: RateLimitPolicyName,
  actor: WorkerPublicWriteActor,
) {
  const result = consumeRateLimitPolicy(policyName, actor.key);

  // DB 없이 동작하는 isolate 메모리 폴백에서도 쿠키를 버리는 익명 요청을 IP 버킷으로 막는다.
  if (!actor.user && actor.ip) {
    const policy = RATE_LIMIT_POLICIES[policyName];
    const ipResult = consumeRateLimit({
      policyName,
      ...policy,
      limit: policy.limit * 3,
      key: `ip:${actor.ip}`,
    });

    if (!ipResult.ok) {
      return ipResult;
    }
  }

  return result;
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
