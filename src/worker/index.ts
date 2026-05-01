import { Hono } from "hono";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import {
  categoryGroups,
  categoryOptions,
} from "@/features/categories/catalog";
import { credentialsSignupSchema } from "@/features/auth/schema";
import {
  reportModerationSchema,
  reportSubmissionSchema,
} from "@/features/reports/schema";
import { bookmarkToggleSchema } from "@/features/bookmarks/schema";
import { placeReactionSchema } from "@/features/places/reaction-schema";
import { getFilteredPlaces, getPlaceById } from "@/features/places/queries";
import {
  placeModerationSchema,
  placeSubmissionSchema,
} from "@/features/submission/schema";
import {
  adminPriceItemUpdateSchema,
  placeCommentSchema,
  placePriceReportSchema,
  priceReportModerationSchema,
} from "@/features/places/write-schema";
import {
  getWorkerAdminPlacePriceDetail,
  listWorkerMockReports,
  listWorkerPendingPlaces,
  listWorkerPendingPriceReports,
  listWorkerReports,
  moderateWorkerPlaceSubmission,
  moderateWorkerPriceReport,
  updateWorkerPriceItem,
  updateWorkerReportStatus,
} from "@/worker/admin-repository";
import {
  getWorkerPlaceDetail,
  listWorkerMapPlaces,
  type WorkerPlaceViewer,
} from "@/worker/places-read-repository";
import {
  isWorkerDatabaseEnabled,
  withWorkerDatabaseConnection,
} from "@/worker/db";
import {
  createDatabasePlaceComment,
  createDatabasePlacePriceReport,
  createDatabasePlaceSubmission,
  deleteDatabasePlaceComment,
  setDatabasePlaceReaction,
} from "@/worker/places-write-repository";
import {
  createDatabaseReportSubmission,
} from "@/worker/reports-write-repository";
import {
  applyWorkerWriteHeaders,
  consumeWorkerRateLimit,
  getWorkerPublicWriteActor,
} from "@/worker/public-write-actor";
import {
  recordWorkerVisitActivity,
} from "@/worker/telemetry-repository";
import {
  createWorkerCredentialsUser,
  listWorkerSocialAuthProviders,
  syncWorkerOAuthUser,
  verifyWorkerCredentials,
  type WorkerAuthUserRecord,
} from "@/worker/auth-repository";
import type {
  PlaceComment,
  PlaceReactionType,
  PlaceBounds,
  PlaceSearchScope,
} from "@/features/places/types";

type AssetFetcher = {
  fetch(request: Request): Promise<Response> | Response;
};

type CloudflareBindings = {
  ASSETS: AssetFetcher;
  AUTH_ADMIN_PASSWORD?: string;
  AUTH_DEMO_PASSWORD?: string;
  AUTH_SECRET?: string;
  AUTH_KAKAO_CLIENT_ID?: string;
  AUTH_KAKAO_CLIENT_SECRET?: string;
  AUTH_NAVER_CLIENT_ID?: string;
  AUTH_NAVER_CLIENT_SECRET?: string;
  DATABASE_URL?: string;
  NEXTAUTH_URL?: string;
  SITE_URL?: string;
  USE_MOCK_DATA?: string;
};
type OAuthProviderId = (typeof OAUTH_PROVIDERS)[number];
type OAuthState = {
  callbackUrl: string;
  expires: number;
  nonce: string;
  provider: OAuthProviderId;
};
type OAuthTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
};
type OAuthProfile = {
  email: string | null;
  id: string | null;
  name: string | null;
};

const app = new Hono<{ Bindings: CloudflareBindings }>();
const AUTH_SESSION_COOKIE_NAME = "next-auth.session-token";
const AUTH_CSRF_COOKIE_NAME = "next-auth.csrf-token";
const AUTH_CALLBACK_COOKIE_NAME = "next-auth.callback-url";
const AUTH_OAUTH_STATE_COOKIE_NAME = "next-auth.state";
const AUTH_SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const AUTH_OAUTH_STATE_MAX_AGE = 60 * 10;
const VISITOR_ID_COOKIE_NAME = "altteulmap_visitor_id";
const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};
const PLACE_SHARE_SOURCES = [
  "detail",
  "detail_sheet",
  "list",
  "trending",
] as const;
const OAUTH_PROVIDERS = ["kakao", "naver"] as const;
const visitPayloadSchema = z
  .object({
    path: z.string().trim().min(1).max(160),
    ref: z.enum(["share"]).optional(),
    scope: z.enum(["public", "admin"]).default("public"),
    source: z.enum(PLACE_SHARE_SOURCES).optional(),
  })
  .superRefine((value, context) => {
    if (value.source && value.ref !== "share") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "공유 source는 ref=share와 함께 보내야 합니다.",
        path: ["source"],
      });
    }
  });
const mockCommentStore = new Map<
  string,
  Array<PlaceComment & { ownerVisitorId: string }>
>();
const mockReactionStore = new Map<string, PlaceReactionType>();
const mockBookmarkStore = new Map<string, Set<string>>();

type LocalSession = {
  user: {
    id: string;
    email: string;
    name: string;
    role: WorkerAuthUserRecord["role"];
  };
  expires: string;
};

function parseFiniteNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseMapBounds(searchParams: URLSearchParams): PlaceBounds | null {
  const minLat = parseFiniteNumber(searchParams.get("minLat"));
  const maxLat = parseFiniteNumber(searchParams.get("maxLat"));
  const minLng = parseFiniteNumber(searchParams.get("minLng"));
  const maxLng = parseFiniteNumber(searchParams.get("maxLng"));

  if (minLat === null || maxLat === null || minLng === null || maxLng === null) {
    return null;
  }

  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
  };
}

function getVisitorIdFromCookie(cookieHeader: string | null) {
  return getCookieValue(cookieHeader, VISITOR_ID_COOKIE_NAME);
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

function shouldUseSecureCookie(requestUrl: string) {
  const url = new URL(requestUrl);

  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return false;
  }

  return url.protocol === "https:";
}

function getOrCreateVisitorId(request: Request) {
  return getVisitorIdFromCookie(request.headers.get("cookie")) ?? crypto.randomUUID();
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

async function runWorkerDatabaseRoute<T>(
  env: CloudflareBindings,
  load: () => Promise<T>,
) {
  return withWorkerDatabaseConnection(env, load);
}

function getOrigin(request: Request, siteUrl?: string) {
  if (siteUrl) {
    try {
      return new URL(siteUrl).origin;
    } catch {
      // Fall through to the request origin.
    }
  }

  return new URL(request.url).origin;
}

function textResponse(body: string, contentType: string) {
  return new Response(body, {
    headers: {
      "content-type": contentType,
    },
  });
}

function normalizeCallbackUrl(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  const pathname = value.split(/[?#]/, 1)[0];

  if (pathname === "/login" || pathname === "/signup") {
    return "/";
  }

  return value;
}

function toSessionUser(user: WorkerAuthUserRecord): LocalSession["user"] {
  return {
    id: user.id,
    email: user.email,
    name: user.nickname ?? user.email.split("@")[0] ?? user.email,
    role: user.role,
  };
}

function createSession(user: WorkerAuthUserRecord): LocalSession {
  return {
    user: toSessionUser(user),
    expires: new Date(Date.now() + AUTH_SESSION_MAX_AGE * 1000).toISOString(),
  };
}

function getAuthSecret(env: CloudflareBindings) {
  return env.AUTH_SECRET || "vite-local-auth-secret";
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signSessionPayload(payload: string, env: CloudflareBindings) {
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

function isOAuthProviderId(value: string): value is OAuthProviderId {
  return OAUTH_PROVIDERS.includes(value as OAuthProviderId);
}

function encodeSignedPayload(value: unknown, env: CloudflareBindings) {
  const payload = toBase64Url(JSON.stringify(value));
  const signature = signSessionPayload(payload, env);

  return `v1.${payload}.${signature}`;
}

function decodeSignedPayload<T>(
  value: string | null,
  env: CloudflareBindings,
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

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getMockComments(placeId: string, visitorId: string | null) {
  return (mockCommentStore.get(placeId) ?? []).map((comment) => ({
    id: comment.id,
    authorLabel: comment.authorLabel,
    body: comment.body,
    createdAt: comment.createdAt,
    canDelete: Boolean(visitorId && comment.ownerVisitorId === visitorId),
  }));
}

function getReactionActorKey(placeId: string, request: Request) {
  return `${placeId}:${getOrCreateVisitorId(request)}`;
}

function getMockReactionSummary(placeId: string, request: Request) {
  const actorKey = getReactionActorKey(placeId, request);
  let likeCount = 0;
  let dislikeCount = 0;

  for (const [key, reaction] of mockReactionStore) {
    if (!key.startsWith(`${placeId}:`)) {
      continue;
    }

    if (reaction === "like") {
      likeCount += 1;
    } else {
      dislikeCount += 1;
    }
  }

  return {
    actorKey,
    dislikeCount,
    likeCount,
    viewerReaction: mockReactionStore.get(actorKey) ?? null,
  };
}

function getPlaceReactionMessage(reaction: PlaceReactionType | null) {
  if (reaction === "like") {
    return "좋아요를 남겼습니다.";
  }

  if (reaction === "dislike") {
    return "싫어요를 남겼습니다.";
  }

  return "반응을 취소했습니다.";
}

function encodeSession(session: LocalSession, env: CloudflareBindings) {
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

function decodeSession(value: string | null, env: CloudflareBindings) {
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

function getSessionFromRequest(request: Request, env: CloudflareBindings) {
  return decodeSession(
    getCookieValue(request.headers.get("cookie"), AUTH_SESSION_COOKIE_NAME),
    env,
  );
}

function requireAdminSession(request: Request, env: CloudflareBindings) {
  const session = getSessionFromRequest(request, env);

  if (!session) {
    return {
      response: Response.json(
        {
          ok: false,
          message: "로그인이 필요합니다.",
        },
        { status: 401, headers: noStoreHeaders },
      ),
    };
  }

  if (session.user.role !== "admin") {
    return {
      response: Response.json(
        {
          ok: false,
          message: "운영자 권한이 필요합니다.",
        },
        { status: 403, headers: noStoreHeaders },
      ),
    };
  }

  return {
    user: session.user,
  };
}

function createOAuthState(
  provider: OAuthProviderId,
  callbackUrl: string,
  env: CloudflareBindings,
) {
  return encodeSignedPayload(
    {
      callbackUrl,
      expires: Date.now() + AUTH_OAUTH_STATE_MAX_AGE * 1000,
      nonce: crypto.randomUUID(),
      provider,
    } satisfies OAuthState,
    env,
  );
}

function decodeOAuthState(
  rawState: string | null,
  env: CloudflareBindings,
): OAuthState | null {
  const state = decodeSignedPayload<OAuthState>(rawState, env);

  if (
    !state ||
    !isOAuthProviderId(state.provider) ||
    !state.nonce ||
    Date.now() >= state.expires
  ) {
    return null;
  }

  return {
    ...state,
    callbackUrl: normalizeCallbackUrl(state.callbackUrl),
  };
}

function isUuid(value: string | null | undefined) {
  return Boolean(
    value?.match(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    ),
  );
}

function getPlaceViewerFromRequest(
  request: Request,
  env: CloudflareBindings,
): WorkerPlaceViewer {
  const session = getSessionFromRequest(request, env);

  if (session) {
    return {
      role: session.user.role,
      userId: isUuid(session.user.id) ? session.user.id : null,
    };
  }

  const visitorId = getVisitorIdFromCookie(request.headers.get("cookie"));

  if (!visitorId) {
    return null;
  }

  return {
    role: "guest",
    visitorId,
  };
}

function getUserBookmarkSet(session: LocalSession) {
  const existing = mockBookmarkStore.get(session.user.id);

  if (existing) {
    return existing;
  }

  const initialBookmarks =
    session.user.email === "demo@altteulmap.local"
      ? new Set(["school-gimbap"])
      : new Set<string>();

  mockBookmarkStore.set(session.user.id, initialBookmarks);
  return initialBookmarks;
}

function getEnabledOAuthProvider(
  env: CloudflareBindings,
  providerId: string,
) {
  if (!isOAuthProviderId(providerId)) {
    return null;
  }

  const availability = listWorkerSocialAuthProviders(env).find(
    (provider) => provider.id === providerId,
  );

  if (!availability?.enabled) {
    return null;
  }

  return providerId;
}

function getOAuthProviderConfig(
  env: CloudflareBindings,
  provider: OAuthProviderId,
  origin: string,
) {
  if (provider === "kakao") {
    return {
      authorizationUrl: "https://kauth.kakao.com/oauth/authorize",
      clientId: env.AUTH_KAKAO_CLIENT_ID ?? "",
      clientSecret: env.AUTH_KAKAO_CLIENT_SECRET ?? "",
      redirectUri: `${origin}/api/auth/callback/kakao`,
      tokenUrl: "https://kauth.kakao.com/oauth/token",
      userInfoUrl: "https://kapi.kakao.com/v2/user/me",
    };
  }

  return {
    authorizationUrl: "https://nid.naver.com/oauth2.0/authorize",
    clientId: env.AUTH_NAVER_CLIENT_ID ?? "",
    clientSecret: env.AUTH_NAVER_CLIENT_SECRET ?? "",
    redirectUri: `${origin}/api/auth/callback/naver`,
    tokenUrl: "https://nid.naver.com/oauth2.0/token",
    userInfoUrl: "https://openapi.naver.com/v1/nid/me",
  };
}

function redirectToLoginError(
  request: Request,
  env: CloudflareBindings,
  error: string,
  callbackUrl = "/",
) {
  const redirectUrl = new URL(
    "/login",
    getOrigin(request, env.NEXTAUTH_URL ?? env.SITE_URL),
  );

  redirectUrl.searchParams.set("callbackUrl", normalizeCallbackUrl(callbackUrl));
  redirectUrl.searchParams.set("error", error);

  return Response.redirect(redirectUrl.toString(), 302);
}

async function exchangeOAuthToken(
  provider: OAuthProviderId,
  code: string,
  env: CloudflareBindings,
  origin: string,
) {
  const config = getOAuthProviderConfig(env, provider, origin);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
  });

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`OAuth token exchange failed for ${provider}.`);
  }

  return (await response.json()) as OAuthTokenResponse;
}

async function fetchOAuthProfile(
  provider: OAuthProviderId,
  accessToken: string,
  env: CloudflareBindings,
  origin: string,
): Promise<OAuthProfile> {
  const config = getOAuthProviderConfig(env, provider, origin);
  const response = await fetch(config.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`OAuth profile fetch failed for ${provider}.`);
  }

  const profile = (await response.json()) as Record<string, unknown>;

  if (provider === "kakao") {
    const kakaoAccount = profile.kakao_account as
      | Record<string, unknown>
      | undefined;
    const properties = profile.properties as Record<string, unknown> | undefined;

    return {
      email:
        typeof kakaoAccount?.email === "string" ? kakaoAccount.email : null,
      id: typeof profile.id === "number" || typeof profile.id === "string"
        ? String(profile.id)
        : null,
      name:
        typeof properties?.nickname === "string"
          ? properties.nickname
          : typeof kakaoAccount?.profile === "object" &&
              kakaoAccount.profile &&
              typeof (kakaoAccount.profile as { nickname?: unknown }).nickname ===
                "string"
            ? (kakaoAccount.profile as { nickname: string }).nickname
            : null,
    };
  }

  const responseProfile = profile.response as Record<string, unknown> | undefined;

  return {
    email:
      typeof responseProfile?.email === "string" ? responseProfile.email : null,
    id: typeof responseProfile?.id === "string" ? responseProfile.id : null,
    name: typeof responseProfile?.name === "string" ? responseProfile.name : null,
  };
}

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    runtime: "cloudflare-worker",
    app: "altteulmap-vite-migration",
  }),
);

app.get("/api/categories", (c) =>
  c.json({
    groups: categoryGroups,
    categories: categoryOptions,
  }),
);

app.get("/api/auth/csrf", (c) => {
  const csrfToken = crypto.randomUUID();
  const response = c.json(
    {
      csrfToken,
    },
    200,
    noStoreHeaders,
  );

  appendCookie(response, c.req.raw, {
    name: AUTH_CSRF_COOKIE_NAME,
    value: `${csrfToken}|vite-mock`,
  });
  appendCookie(response, c.req.raw, {
    name: AUTH_CALLBACK_COOKIE_NAME,
    value: getOrigin(c.req.raw, c.env.NEXTAUTH_URL ?? c.env.SITE_URL),
  });

  return response;
});

app.get("/api/auth/session", (c) => {
  const session = getSessionFromRequest(c.req.raw, c.env);

  if (!session) {
    return c.json({}, 200, noStoreHeaders);
  }

  return c.json(session, 200, noStoreHeaders);
});

app.get("/api/auth/providers", (c) => {
  const origin = getOrigin(c.req.raw, c.env.NEXTAUTH_URL ?? c.env.SITE_URL);
  const providers: Record<string, unknown> = {
    credentials: {
      id: "credentials",
      name: "Credentials",
      type: "credentials",
      signinUrl: `${origin}/api/auth/signin/credentials`,
      callbackUrl: `${origin}/api/auth/callback/credentials`,
    },
  };

  for (const provider of listWorkerSocialAuthProviders(c.env)) {
    if (!provider.enabled) {
      continue;
    }

    providers[provider.id] = {
      id: provider.id,
      name: provider.label,
      type: "oauth",
      signinUrl: `${origin}/api/auth/signin/${provider.id}`,
      callbackUrl: `${origin}/api/auth/callback/${provider.id}`,
    };
  }

  return c.json(providers, 200, noStoreHeaders);
});

app.get("/api/bookmarks", (c) => {
  const session = getSessionFromRequest(c.req.raw, c.env);

  if (!session) {
    return c.json(
      {
        ok: false,
        message: "로그인이 필요합니다.",
      },
      401,
      noStoreHeaders,
    );
  }

  const bookmarkSet = getUserBookmarkSet(session);
  const items = [...bookmarkSet].map((placeId) => ({
    placeId,
    createdAt: formatDate(new Date()),
  }));

  return c.json(
    {
      items,
      count: items.length,
      source: "mock",
      userLabel: session.user.name || session.user.email,
      mock: true,
    },
    200,
    noStoreHeaders,
  );
});

app.put("/api/bookmarks/:id", async (c) => {
  const session = getSessionFromRequest(c.req.raw, c.env);

  if (!session) {
    return c.json(
      {
        ok: false,
        message: "로그인이 필요합니다.",
        requiresAuth: true,
      },
      401,
      noStoreHeaders,
    );
  }

  const body = await c.req.json().catch(() => null);
  const parsed = bookmarkToggleSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        message: "북마크 입력값 검증에 실패했습니다.",
        error: parsed.error.flatten(),
      },
      400,
      noStoreHeaders,
    );
  }

  const placeId = c.req.param("id");
  const place = getPlaceById(placeId);

  if (!place) {
    return c.json(
      {
        ok: false,
        source: "mock",
        bookmarked: false,
        message: "장소를 찾지 못했습니다.",
        placeId,
      },
      404,
      noStoreHeaders,
    );
  }

  const bookmarkSet = getUserBookmarkSet(session);

  if (parsed.data.bookmarked) {
    bookmarkSet.add(placeId);
  } else {
    bookmarkSet.delete(placeId);
  }

  return c.json(
    {
      ok: true,
      source: "mock",
      bookmarked: parsed.data.bookmarked,
      message: parsed.data.bookmarked
        ? "북마크에 저장했습니다."
        : "북마크를 해제했습니다.",
      placeId,
    },
    200,
    noStoreHeaders,
  );
});

app.get("/api/auth/signin/:provider", (c) => {
  const provider = c.req.param("provider");
  const callbackUrl = normalizeCallbackUrl(c.req.query("callbackUrl"));
  const enabledProvider = getEnabledOAuthProvider(c.env, provider);

  if (!enabledProvider) {
    return redirectToLoginError(c.req.raw, c.env, provider, callbackUrl);
  }

  const origin = getOrigin(c.req.raw, c.env.NEXTAUTH_URL ?? c.env.SITE_URL);
  const config = getOAuthProviderConfig(c.env, enabledProvider, origin);
  const state = createOAuthState(enabledProvider, callbackUrl, c.env);
  const authorizationUrl = new URL(config.authorizationUrl);

  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", config.clientId);
  authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizationUrl.searchParams.set("state", state);

  if (enabledProvider === "kakao") {
    authorizationUrl.searchParams.set("scope", "profile_nickname account_email");
  }

  const response = c.redirect(authorizationUrl.toString());

  appendCookie(response, c.req.raw, {
    name: AUTH_OAUTH_STATE_COOKIE_NAME,
    value: state,
    maxAge: AUTH_OAUTH_STATE_MAX_AGE,
  });
  appendCookie(response, c.req.raw, {
    name: AUTH_CALLBACK_COOKIE_NAME,
    value: callbackUrl,
  });

  return response;
});

app.get("/api/auth/callback/:provider", async (c) => {
  const provider = c.req.param("provider");
  const enabledProvider = getEnabledOAuthProvider(c.env, provider);

  if (!enabledProvider) {
    return redirectToLoginError(c.req.raw, c.env, "OAuthSignin");
  }

  const error = c.req.query("error");

  if (error) {
    return redirectToLoginError(c.req.raw, c.env, "OAuthCallback");
  }

  const code = c.req.query("code");
  const state = c.req.query("state");
  const cookieState = getCookieValue(
    c.req.header("cookie") ?? null,
    AUTH_OAUTH_STATE_COOKIE_NAME,
  );
  const decodedState = decodeOAuthState(state ?? null, c.env);
  const decodedCookieState = decodeOAuthState(cookieState, c.env);

  if (
    !code ||
    !decodedState ||
    !decodedCookieState ||
    state !== cookieState ||
    decodedState.provider !== enabledProvider
  ) {
    return redirectToLoginError(c.req.raw, c.env, "OAuthCallback");
  }

  try {
    const origin = getOrigin(c.req.raw, c.env.NEXTAUTH_URL ?? c.env.SITE_URL);
    const token = await exchangeOAuthToken(enabledProvider, code, c.env, origin);

    if (!token.access_token) {
      return redirectToLoginError(
        c.req.raw,
        c.env,
        "OAuthCallback",
        decodedState.callbackUrl,
      );
    }

    const profile = await fetchOAuthProfile(
      enabledProvider,
      token.access_token,
      c.env,
      origin,
    );

    if (!profile.email || !profile.id) {
      return redirectToLoginError(
        c.req.raw,
        c.env,
        "OAuthEmailRequired",
        decodedState.callbackUrl,
      );
    }

    const profileEmail = profile.email;
    const profileId = profile.id;
    const syncedUser = await runWorkerDatabaseRoute(c.env, () =>
      syncWorkerOAuthUser(c.env, {
        provider: enabledProvider,
        providerAccountId: profileId,
        type: "oauth",
        email: profileEmail,
        name: profile.name,
        accessToken: token.access_token ?? null,
        refreshToken: token.refresh_token ?? null,
        expiresAt: token.expires_in
          ? Math.floor(Date.now() / 1000) + token.expires_in
          : null,
        tokenType: token.token_type ?? null,
        scope: token.scope ?? null,
        idToken: token.id_token ?? null,
        sessionState: null,
      }),
    );

    if (!syncedUser) {
      return redirectToLoginError(
        c.req.raw,
        c.env,
        "OAuthAccountSyncFailed",
        decodedState.callbackUrl,
      );
    }

    const session = createSession(syncedUser);
    const response = c.redirect(decodedState.callbackUrl);

    appendCookie(response, c.req.raw, {
      name: AUTH_SESSION_COOKIE_NAME,
      value: encodeSession(session, c.env),
      maxAge: AUTH_SESSION_MAX_AGE,
    });
    appendCookie(response, c.req.raw, {
      name: AUTH_OAUTH_STATE_COOKIE_NAME,
      value: "",
      maxAge: 0,
    });
    appendCookie(response, c.req.raw, {
      name: AUTH_CALLBACK_COOKIE_NAME,
      value: decodedState.callbackUrl,
    });

    return response;
  } catch (callbackError) {
    console.error(`Failed to complete ${enabledProvider} OAuth callback.`, callbackError);
    return redirectToLoginError(
      c.req.raw,
      c.env,
      "OAuthCallback",
      decodedState.callbackUrl,
    );
  }
});

app.post("/api/auth/callback/credentials", async (c) => {
  const contentType = c.req.header("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await c.req.json().catch(() => ({}))
    : Object.fromEntries((await c.req.formData()).entries());
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const callbackUrl = normalizeCallbackUrl(
    typeof body.callbackUrl === "string" ? body.callbackUrl : "/",
  );
  const user = await runWorkerDatabaseRoute(c.env, () =>
    verifyWorkerCredentials(c.env, email, password),
  );

  if (!user) {
    return c.json(
      {
        url: `${getOrigin(c.req.raw, c.env.NEXTAUTH_URL ?? c.env.SITE_URL)}/api/auth/error?error=CredentialsSignin&provider=credentials`,
      },
      401,
      noStoreHeaders,
    );
  }

  const session = createSession(user);
  const response = c.json(
    {
      url: callbackUrl,
    },
    200,
    noStoreHeaders,
  );

  appendCookie(response, c.req.raw, {
    name: AUTH_SESSION_COOKIE_NAME,
    value: encodeSession(session, c.env),
    maxAge: AUTH_SESSION_MAX_AGE,
  });
  appendCookie(response, c.req.raw, {
    name: AUTH_CALLBACK_COOKIE_NAME,
    value: callbackUrl,
  });

  return response;
});

app.post("/api/auth/signup", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = credentialsSignupSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        message: "회원가입 입력값 검증에 실패했습니다.",
        item: null,
        error: parsed.error.flatten(),
      },
      400,
      noStoreHeaders,
    );
  }

  const result = await runWorkerDatabaseRoute(c.env, () =>
    createWorkerCredentialsUser(c.env, parsed.data),
  );
  const status = result.ok
    ? 201
    : result.message.includes("이미 가입된 이메일")
      ? 409
      : result.message.includes("데이터 연결")
        ? 503
        : 500;

  return c.json(result, status, noStoreHeaders);
});

app.get("/api/places/map", async (c) => {
  const searchParams = new URL(c.req.url).searchParams;
  const category = searchParams.get("category");
  const query = searchParams.get("query")?.trim() || null;
  const searchScope: PlaceSearchScope =
    query && searchParams.get("scope") === "global" ? "global" : "viewport";
  const bounds = parseMapBounds(searchParams);
  const zoom = parseFiniteNumber(searchParams.get("zoom"));
  const result = await listWorkerMapPlaces(c.env, {
    category,
    query,
    bounds: searchScope === "viewport" ? bounds : null,
    zoom: searchScope === "viewport" ? zoom : null,
  });

  return c.json(
    {
      items: result.items,
      mapMarkers: result.mapMarkers,
      markerMode: result.markerMode,
      count: result.count,
      returnedCount: result.items.length,
      mapMarkerCount: result.mapMarkers.length,
      truncated: result.items.length < result.count,
      bounds: result.bounds,
      filters: {
        category,
        query,
        searchScope,
        bounds: searchScope === "viewport" ? bounds : null,
        zoom: searchScope === "viewport" ? zoom : null,
      },
      source: result.source,
      mock: result.source === "mock",
    },
    200,
    {
      ...noStoreHeaders,
      "X-Altteulmap-Map-Cache": result.cacheStatus,
    },
  );
});

app.get("/api/places/:id", async (c) => {
  const result = await getWorkerPlaceDetail(
    c.env,
    c.req.param("id"),
    getPlaceViewerFromRequest(c.req.raw, c.env),
  );
  const place = result.item;

  if (!place) {
    return c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Place not found",
        },
      },
      404,
      noStoreHeaders,
    );
  }

  return c.json(
    {
      item: {
        ...place,
        comments: [
          ...getMockComments(place.id, getVisitorIdFromCookie(c.req.header("cookie") ?? null)),
          ...place.comments,
        ],
      },
      source: result.source,
      mock: result.source === "mock",
    },
    200,
    noStoreHeaders,
  );
});

app.post("/api/places/:id/prices", async (c) => {
  const placeId = c.req.param("id");
  const place = getPlaceById(placeId);
  const body = await c.req.json().catch(() => null);
  const parsed = placePriceReportSchema.safeParse(body);
  const actor = getWorkerPublicWriteActor(
    c.req.raw,
    getSessionFromRequest(c.req.raw, c.env)?.user ?? null,
  );
  const rateLimit = consumeWorkerRateLimit("placePriceSubmission", actor);

  if (!rateLimit.ok) {
    return applyWorkerWriteHeaders(
      c.json(
        {
          ok: false,
          message: "가격 제보 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
          retryAfterMs: rateLimit.retryAfterMs,
        },
        429,
      ),
      c.req.raw,
      actor,
      rateLimit,
    );
  }

  if (!parsed.success) {
    return applyWorkerWriteHeaders(
      c.json(
        {
          ok: false,
          message: "가격 제보 입력값 검증에 실패했습니다.",
          error: parsed.error.flatten(),
        },
        400,
      ),
      c.req.raw,
      actor,
      rateLimit,
    );
  }

  if (isWorkerDatabaseEnabled(c.env)) {
    const result = await runWorkerDatabaseRoute(c.env, () =>
      createDatabasePlacePriceReport(c.env, placeId, parsed.data, actor),
    );

    return applyWorkerWriteHeaders(
      c.json(result, result.ok ? 200 : 404),
      c.req.raw,
      actor,
      rateLimit,
    );
  }

  if (!place) {
    return applyWorkerWriteHeaders(
      c.json(
        {
          ok: false,
          message: "장소를 찾지 못했습니다.",
          source: "mock",
          mock: true,
          item: null,
        },
        404,
      ),
      c.req.raw,
      actor,
      rateLimit,
    );
  }

  return applyWorkerWriteHeaders(
    c.json({
      ok: true,
      message: "가격 제보가 접수되었습니다. 검토 후 상세 화면에 반영됩니다.",
      source: "mock",
      mock: true,
      item: {
        id: `vite-price-report-${crypto.randomUUID()}`,
        placeId,
        placeName: place.name,
        label: parsed.data.label,
        amount: parsed.data.amount,
        unitLabel: parsed.data.unitLabel || undefined,
        comment: parsed.data.comment || undefined,
      },
    }),
    c.req.raw,
    actor,
    rateLimit,
  );
});

app.post("/api/places/:id/comments", async (c) => {
  const placeId = c.req.param("id");
  const place = getPlaceById(placeId);
  const body = await c.req.json().catch(() => null);
  const parsed = placeCommentSchema.safeParse(body);
  const actor = getWorkerPublicWriteActor(
    c.req.raw,
    getSessionFromRequest(c.req.raw, c.env)?.user ?? null,
  );
  const rateLimit = consumeWorkerRateLimit("placeCommentSubmission", actor);

  if (!rateLimit.ok) {
    return applyWorkerWriteHeaders(
      c.json(
        {
          ok: false,
          message: "코멘트 등록 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
          retryAfterMs: rateLimit.retryAfterMs,
        },
        429,
      ),
      c.req.raw,
      actor,
      rateLimit,
    );
  }

  if (!parsed.success) {
    return applyWorkerWriteHeaders(
      c.json(
        {
          ok: false,
          message: "코멘트 입력값 검증에 실패했습니다.",
          error: parsed.error.flatten(),
        },
        400,
      ),
      c.req.raw,
      actor,
      rateLimit,
    );
  }

  if (isWorkerDatabaseEnabled(c.env)) {
    const result = await runWorkerDatabaseRoute(c.env, () =>
      createDatabasePlaceComment(c.env, placeId, parsed.data, actor),
    );

    return applyWorkerWriteHeaders(
      c.json(result, result.ok ? 200 : 404),
      c.req.raw,
      actor,
      rateLimit,
    );
  }

  if (!place) {
    return applyWorkerWriteHeaders(
      c.json(
        {
          ok: false,
          message: "장소를 찾지 못했습니다.",
          source: "mock",
          mock: true,
          item: null,
        },
        404,
      ),
      c.req.raw,
      actor,
      rateLimit,
    );
  }

  const visitorId = actor.visitorId ?? getOrCreateVisitorId(c.req.raw);
  const item = {
    id: `vite-comment-${crypto.randomUUID()}`,
    authorLabel: "익명",
    body: parsed.data.body,
    createdAt: formatDate(new Date()),
    canDelete: true,
    ownerVisitorId: visitorId,
  };
  const comments = mockCommentStore.get(placeId) ?? [];

  mockCommentStore.set(placeId, [item, ...comments]);

  return applyWorkerWriteHeaders(
    c.json({
      ok: true,
      message: "코멘트를 등록했습니다.",
      source: "mock",
      mock: true,
      item: {
        id: item.id,
        authorLabel: item.authorLabel,
        body: item.body,
        createdAt: item.createdAt,
        canDelete: item.canDelete,
      },
    }),
    c.req.raw,
    actor,
    rateLimit,
  );
});

app.delete("/api/places/:id/comments/:commentId", async (c) => {
  const placeId = c.req.param("id");
  const commentId = c.req.param("commentId");
  const actor = getWorkerPublicWriteActor(
    c.req.raw,
    getSessionFromRequest(c.req.raw, c.env)?.user ?? null,
    {
      createVisitorIfMissing: false,
    },
  );

  if (isWorkerDatabaseEnabled(c.env)) {
    if (!actor.user && !actor.visitorId) {
      return c.json(
        {
          ok: false,
          message: "삭제 권한이 없습니다.",
        },
        403,
      );
    }
  }

  const visitorId = getVisitorIdFromCookie(c.req.header("cookie") ?? null);

  if (isWorkerDatabaseEnabled(c.env)) {
    const result = await runWorkerDatabaseRoute(c.env, () =>
      deleteDatabasePlaceComment(c.env, placeId, commentId, actor),
    );
    const status = result.ok
      ? 200
      : result.message === "삭제 권한이 없습니다."
        ? 403
        : 404;

    return c.json(result, status);
  }

  const comments = mockCommentStore.get(placeId) ?? [];
  const target = comments.find((comment) => comment.id === commentId);

  if (!visitorId || !target || target.ownerVisitorId !== visitorId) {
    return c.json(
      {
        ok: false,
        message: "삭제 권한이 없습니다.",
        source: "mock",
        mock: true,
        deletedCommentId: null,
      },
      403,
    );
  }

  mockCommentStore.set(
    placeId,
    comments.filter((comment) => comment.id !== commentId),
  );

  return c.json({
    ok: true,
    message: "코멘트를 삭제했습니다.",
    source: "mock",
    mock: true,
    deletedCommentId: commentId,
  });
});

app.put("/api/places/:id/reaction", async (c) => {
  const placeId = c.req.param("id");
  const place = getPlaceById(placeId);
  const body = await c.req.json().catch(() => null);
  const parsed = placeReactionSchema.safeParse(body);
  const actor = getWorkerPublicWriteActor(
    c.req.raw,
    getSessionFromRequest(c.req.raw, c.env)?.user ?? null,
  );
  const rateLimit = consumeWorkerRateLimit("placeReaction", actor);

  if (!rateLimit.ok) {
    return applyWorkerWriteHeaders(
      c.json(
        {
          ok: false,
          message: "반응 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
          retryAfterMs: rateLimit.retryAfterMs,
        },
        429,
      ),
      c.req.raw,
      actor,
      rateLimit,
    );
  }

  if (!parsed.success) {
    return applyWorkerWriteHeaders(
      c.json(
        {
          ok: false,
          message: "반응 입력값 검증에 실패했습니다.",
          error: parsed.error.flatten(),
        },
        400,
      ),
      c.req.raw,
      actor,
      rateLimit,
    );
  }

  if (isWorkerDatabaseEnabled(c.env)) {
    const result = await runWorkerDatabaseRoute(c.env, () =>
      setDatabasePlaceReaction(c.env, placeId, parsed.data.reaction, actor),
    );

    return applyWorkerWriteHeaders(
      c.json(result, result.ok ? 200 : 404),
      c.req.raw,
      actor,
      rateLimit,
    );
  }

  if (!place) {
    return applyWorkerWriteHeaders(
      c.json(
        {
          ok: false,
          source: "mock",
          reaction: null,
          likeCount: 0,
          dislikeCount: 0,
          message: "장소를 찾지 못했습니다.",
          placeId,
        },
        404,
      ),
      c.req.raw,
      actor,
      rateLimit,
    );
  }

  const { actorKey } = getMockReactionSummary(placeId, c.req.raw);

  if (parsed.data.reaction) {
    mockReactionStore.set(actorKey, parsed.data.reaction);
  } else {
    mockReactionStore.delete(actorKey);
  }

  const summary = getMockReactionSummary(placeId, c.req.raw);

  return applyWorkerWriteHeaders(
    c.json({
      ok: true,
      source: "mock",
      reaction: summary.viewerReaction,
      likeCount: place.likeCount + summary.likeCount,
      dislikeCount: place.dislikeCount + summary.dislikeCount,
      message: getPlaceReactionMessage(summary.viewerReaction),
      placeId,
    }),
    c.req.raw,
    actor,
    rateLimit,
  );
});

app.post("/api/places", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = placeSubmissionSchema.safeParse(body);
  const actor = getWorkerPublicWriteActor(
    c.req.raw,
    getSessionFromRequest(c.req.raw, c.env)?.user ?? null,
  );
  const rateLimit = consumeWorkerRateLimit("placeSubmission", actor);

  if (!rateLimit.ok) {
    return applyWorkerWriteHeaders(
      c.json(
        {
          ok: false,
          message: "장소 등록 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
          retryAfterMs: rateLimit.retryAfterMs,
        },
        429,
      ),
      c.req.raw,
      actor,
      rateLimit,
    );
  }

  if (!parsed.success) {
    return applyWorkerWriteHeaders(
      c.json(
        {
          ok: false,
          message: "입력값 검증에 실패했습니다.",
          error: parsed.error.flatten(),
        },
        400,
      ),
      c.req.raw,
      actor,
      rateLimit,
    );
  }

  if (isWorkerDatabaseEnabled(c.env)) {
    const result = await runWorkerDatabaseRoute(c.env, () =>
      createDatabasePlaceSubmission(c.env, parsed.data, actor),
    );

    return applyWorkerWriteHeaders(
      c.json(result),
      c.req.raw,
      actor,
      rateLimit,
    );
  }

  return applyWorkerWriteHeaders(
    c.json({
      ok: true,
      message: "장소 등록 요청이 접수되었습니다. 검토 후 공개 목록에 반영됩니다.",
      mock: true,
      source: "mock",
      preview: {
        id: `vite-submission-${crypto.randomUUID()}`,
        name: parsed.data.name,
        categorySlug: parsed.data.categorySlug,
        roadAddress: parsed.data.roadAddress,
        district: parsed.data.district,
        priceItems: parsed.data.priceItems,
      },
    }),
    c.req.raw,
    actor,
    rateLimit,
  );
});

app.post("/api/reports", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = reportSubmissionSchema.safeParse(body);
  const actor = getWorkerPublicWriteActor(
    c.req.raw,
    getSessionFromRequest(c.req.raw, c.env)?.user ?? null,
  );
  const rateLimit = consumeWorkerRateLimit("contentReportSubmission", actor);

  if (!rateLimit.ok) {
    return applyWorkerWriteHeaders(
      c.json(
        {
          ok: false,
          message: "신고 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
          retryAfterMs: rateLimit.retryAfterMs,
        },
        429,
      ),
      c.req.raw,
      actor,
      rateLimit,
    );
  }

  if (!parsed.success) {
    return applyWorkerWriteHeaders(
      c.json(
        {
          ok: false,
          message: "신고 입력값 검증에 실패했습니다.",
          error: parsed.error.flatten(),
        },
        400,
      ),
      c.req.raw,
      actor,
      rateLimit,
    );
  }

  if (isWorkerDatabaseEnabled(c.env)) {
    const result = await runWorkerDatabaseRoute(c.env, () =>
      createDatabaseReportSubmission(c.env, parsed.data, actor),
    );

    return applyWorkerWriteHeaders(
      c.json(result),
      c.req.raw,
      actor,
      rateLimit,
    );
  }

  return applyWorkerWriteHeaders(
    c.json({
      ok: true,
      message: "신고가 접수되었습니다. 운영 검토 큐에서 바로 확인할 수 있습니다.",
      mock: true,
      source: "mock",
      preview: {
        id: `vite-report-${crypto.randomUUID()}`,
        placeId: parsed.data.placeId,
        placeName: parsed.data.placeName,
        reasonType: parsed.data.reasonType,
        detail: parsed.data.detail,
      },
    }),
    c.req.raw,
    actor,
    rateLimit,
  );
});

app.get("/api/admin/places", async (c) => {
  const admin = requireAdminSession(c.req.raw, c.env);

  if (admin.response) {
    return admin.response;
  }

  if (!isWorkerDatabaseEnabled(c.env)) {
    return c.json(
      {
        items: [],
        count: 0,
        source: "mock",
        mock: true,
      },
      200,
      noStoreHeaders,
    );
  }

  try {
    const result = await runWorkerDatabaseRoute(c.env, () =>
      listWorkerPendingPlaces(c.env),
    );

    return c.json(
      {
        items: result.items,
        count: result.items.length,
        source: result.source,
        mock: false,
      },
      200,
      noStoreHeaders,
    );
  } catch (error) {
    console.error("Failed to load worker admin pending places.", error);

    return c.json(
      {
        ok: false,
        message: "장소 검토 목록을 불러오지 못했습니다.",
      },
      500,
      noStoreHeaders,
    );
  }
});

app.get("/api/admin/places/:id", async (c) => {
  const admin = requireAdminSession(c.req.raw, c.env);

  if (admin.response) {
    return admin.response;
  }

  if (!isWorkerDatabaseEnabled(c.env)) {
    return c.json(
      {
        item: null,
        source: "mock",
        mock: true,
      },
      404,
      noStoreHeaders,
    );
  }

  try {
    const result = await runWorkerDatabaseRoute(c.env, () =>
      listWorkerPendingPlaces(c.env),
    );
    const item = result.items.find((place) => place.id === c.req.param("id")) ?? null;

    return c.json(
      {
        item,
        source: result.source,
        mock: false,
      },
      item ? 200 : 404,
      noStoreHeaders,
    );
  } catch (error) {
    console.error("Failed to load worker admin pending place.", error);

    return c.json(
      {
        ok: false,
        message: "장소 검토 대상을 불러오지 못했습니다.",
      },
      500,
      noStoreHeaders,
    );
  }
});

app.patch("/api/admin/places/:id", async (c) => {
  const admin = requireAdminSession(c.req.raw, c.env);

  if (admin.response) {
    return admin.response;
  }

  const body = await c.req.json().catch(() => null);
  const parsed = placeModerationSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        message: "장소 검토 입력값 검증에 실패했습니다.",
        error: parsed.error.flatten(),
      },
      400,
      noStoreHeaders,
    );
  }

  if (!isWorkerDatabaseEnabled(c.env)) {
    return c.json(
      {
        ok: true,
        message: "목업 모드에서는 장소 검토 결과가 실제 저장되지 않습니다.",
        source: "mock",
        item: null,
      },
      200,
      noStoreHeaders,
    );
  }

  try {
    const result = await runWorkerDatabaseRoute(c.env, () =>
      moderateWorkerPlaceSubmission(
        c.env,
        c.req.param("id"),
        parsed.data,
        admin.user,
      ),
    );

    return c.json(result, result.ok ? 200 : 404, noStoreHeaders);
  } catch (error) {
    console.error("Failed to moderate worker place submission.", error);

    return c.json(
      {
        ok: false,
        message: "장소 검토 처리에 실패했습니다.",
        source: "database",
        item: null,
      },
      500,
      noStoreHeaders,
    );
  }
});

app.get("/api/admin/prices", async (c) => {
  const admin = requireAdminSession(c.req.raw, c.env);

  if (admin.response) {
    return admin.response;
  }

  if (!isWorkerDatabaseEnabled(c.env)) {
    return c.json(
      {
        items: [],
        count: 0,
        source: "mock",
        mock: true,
      },
      200,
      noStoreHeaders,
    );
  }

  try {
    const result = await runWorkerDatabaseRoute(c.env, () =>
      listWorkerPendingPriceReports(c.env),
    );

    return c.json(
      {
        items: result.items,
        count: result.items.length,
        source: result.source,
        mock: false,
      },
      200,
      noStoreHeaders,
    );
  } catch (error) {
    console.error("Failed to load worker admin pending prices.", error);

    return c.json(
      {
        ok: false,
        message: "가격 제보 검토 목록을 불러오지 못했습니다.",
      },
      500,
      noStoreHeaders,
    );
  }
});

app.patch("/api/admin/prices/:id", async (c) => {
  const admin = requireAdminSession(c.req.raw, c.env);

  if (admin.response) {
    return admin.response;
  }

  const body = await c.req.json().catch(() => null);
  const parsed = priceReportModerationSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        message: "가격 제보 검토 입력값 검증에 실패했습니다.",
        error: parsed.error.flatten(),
      },
      400,
      noStoreHeaders,
    );
  }

  if (!isWorkerDatabaseEnabled(c.env)) {
    return c.json(
      {
        ok: true,
        message: "목업 모드에서는 가격 제보 검토 결과가 실제 저장되지 않습니다.",
        source: "mock",
        item: null,
      },
      200,
      noStoreHeaders,
    );
  }

  try {
    const result = await runWorkerDatabaseRoute(c.env, () =>
      moderateWorkerPriceReport(c.env, c.req.param("id"), parsed.data, admin.user),
    );

    return c.json(result, result.ok ? 200 : 404, noStoreHeaders);
  } catch (error) {
    console.error("Failed to moderate worker price report.", error);

    return c.json(
      {
        ok: false,
        message: "가격 제보 검토 처리에 실패했습니다.",
        source: "database",
        item: null,
      },
      500,
      noStoreHeaders,
    );
  }
});

app.get("/api/admin/prices/places/:id", async (c) => {
  const admin = requireAdminSession(c.req.raw, c.env);

  if (admin.response) {
    return admin.response;
  }

  if (!isWorkerDatabaseEnabled(c.env)) {
    const place = getPlaceById(c.req.param("id"));

    return c.json(
      {
        item: place
          ? {
              id: place.id,
              name: place.name,
              district: place.district,
              representativePriceAmount: place.representativePriceAmount,
              representativePriceLabel: place.representativePriceLabel,
              verificationStatus: place.verificationStatus,
              priceItems: place.priceItems.map((item) => ({
                ...item,
                verifiedReportCount:
                  item.verificationStatus === "verified" ? 2 : 0,
                isRepresentative: item.label === place.representativePriceLabel,
                isActive: true,
              })),
            }
          : null,
        source: "mock",
      },
      place ? 200 : 404,
      noStoreHeaders,
    );
  }

  try {
    const result = await runWorkerDatabaseRoute(c.env, () =>
      getWorkerAdminPlacePriceDetail(c.env, c.req.param("id")),
    );

    return c.json(result, result.item ? 200 : 404, noStoreHeaders);
  } catch (error) {
    console.error("Failed to load worker admin place price detail.", error);

    return c.json(
      {
        ok: false,
        message: "장소 가격 정보를 불러오지 못했습니다.",
      },
      500,
      noStoreHeaders,
    );
  }
});

app.patch("/api/admin/price-items/:id", async (c) => {
  const admin = requireAdminSession(c.req.raw, c.env);

  if (admin.response) {
    return admin.response;
  }

  const body = await c.req.json().catch(() => null);
  const parsed = adminPriceItemUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        message: "가격 항목 수정 입력값 검증에 실패했습니다.",
        error: parsed.error.flatten(),
      },
      400,
      noStoreHeaders,
    );
  }

  if (!isWorkerDatabaseEnabled(c.env)) {
    return c.json(
      {
        ok: true,
        message: parsed.data.isActive
          ? "목업 가격 항목을 업데이트했습니다."
          : "목업 가격 항목을 숨겼습니다.",
        source: "mock",
        item: {
          id: c.req.param("id"),
          label: parsed.data.label,
          amount: parsed.data.amount,
          unitLabel: parsed.data.unitLabel || undefined,
          verificationStatus: parsed.data.verificationStatus,
          verifiedReportCount:
            parsed.data.verificationStatus === "verified" ? 2 : 0,
          reportedAt: new Date().toISOString().slice(0, 10),
          isRepresentative: parsed.data.isRepresentative,
          isActive: parsed.data.isActive,
        },
        placeId: null,
      },
      200,
      noStoreHeaders,
    );
  }

  try {
    const result = await runWorkerDatabaseRoute(c.env, () =>
      updateWorkerPriceItem(c.env, c.req.param("id"), parsed.data, admin.user),
    );
    const status = result.ok
      ? 200
      : result.message === "같은 이름의 가격 항목이 이미 있습니다."
        ? 400
        : 404;

    return c.json(result, status, noStoreHeaders);
  } catch (error) {
    console.error("Failed to update worker price item.", error);

    return c.json(
      {
        ok: false,
        message: "가격 항목 업데이트에 실패했습니다.",
        source: "database",
        item: null,
        placeId: null,
      },
      500,
      noStoreHeaders,
    );
  }
});

app.get("/api/admin/reports", async (c) => {
  const admin = requireAdminSession(c.req.raw, c.env);

  if (admin.response) {
    return admin.response;
  }

  if (!isWorkerDatabaseEnabled(c.env)) {
    const result = listWorkerMockReports();

    return c.json(
      {
        items: result.items,
        count: result.items.length,
        source: result.source,
        mock: true,
      },
      200,
      noStoreHeaders,
    );
  }

  try {
    const result = await runWorkerDatabaseRoute(c.env, () =>
      listWorkerReports(c.env),
    );

    return c.json(
      {
        items: result.items,
        count: result.items.length,
        source: result.source,
        mock: false,
      },
      200,
      noStoreHeaders,
    );
  } catch (error) {
    console.error("Failed to load worker admin reports.", error);

    return c.json(
      {
        ok: false,
        message: "신고 목록을 불러오지 못했습니다.",
      },
      500,
      noStoreHeaders,
    );
  }
});

app.patch("/api/admin/reports/:id", async (c) => {
  const admin = requireAdminSession(c.req.raw, c.env);

  if (admin.response) {
    return admin.response;
  }

  const body = await c.req.json().catch(() => null);
  const parsed = reportModerationSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        message: "신고 상태 검증에 실패했습니다.",
        error: parsed.error.flatten(),
      },
      400,
      noStoreHeaders,
    );
  }

  if (!isWorkerDatabaseEnabled(c.env)) {
    return c.json(
      {
        ok: true,
        message: "목업 모드에서는 신고 상태가 실제 저장되지 않습니다.",
        source: "mock",
        item: null,
      },
      200,
      noStoreHeaders,
    );
  }

  try {
    const result = await runWorkerDatabaseRoute(c.env, () =>
      updateWorkerReportStatus(c.env, c.req.param("id"), parsed.data, admin.user),
    );

    return c.json(result, result.ok ? 200 : 404, noStoreHeaders);
  } catch (error) {
    console.error("Failed to update worker report status.", error);

    return c.json(
      {
        ok: false,
        message: "신고 상태 업데이트에 실패했습니다.",
        source: "database",
        item: null,
      },
      500,
      noStoreHeaders,
    );
  }
});

app.post("/api/telemetry/visit", async (c) => {
  const actor = getWorkerPublicWriteActor(
    c.req.raw,
    getSessionFromRequest(c.req.raw, c.env)?.user ?? null,
  );
  let payload: unknown;

  try {
    payload = await c.req.json();
  } catch {
    return applyWorkerWriteHeaders(
      c.json(
        {
          ok: false,
          message: "방문 이벤트 입력값을 읽지 못했습니다.",
        },
        400,
        noStoreHeaders,
      ),
      c.req.raw,
      actor,
    );
  }

  const parsed = visitPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    return applyWorkerWriteHeaders(
      c.json(
        {
          ok: false,
          message: "방문 이벤트 입력값 검증에 실패했습니다.",
          error: parsed.error.flatten(),
        },
        400,
        noStoreHeaders,
      ),
      c.req.raw,
      actor,
    );
  }

  try {
    const result = await runWorkerDatabaseRoute(c.env, () =>
      recordWorkerVisitActivity(c.env, {
        actorKey: actor.key,
        entryRef: parsed.data.ref ?? null,
        entrySource: parsed.data.source ?? null,
        path: parsed.data.path,
        scope: parsed.data.scope,
        userId: actor.user?.id ?? null,
        visitorId: actor.visitorId,
      }),
    );

    return applyWorkerWriteHeaders(
      c.json(
        {
          ok: true,
          tracked: result.tracked,
          source: result.source,
        },
        200,
        noStoreHeaders,
      ),
      c.req.raw,
      actor,
    );
  } catch (error) {
    console.error("Failed to record worker visit activity.", error);

    return applyWorkerWriteHeaders(
      c.json(
        {
          ok: false,
          message: "방문 이벤트를 기록하지 못했습니다.",
        },
        500,
        noStoreHeaders,
      ),
      c.req.raw,
      actor,
    );
  }
});

app.get("/robots.txt", (c) => {
  const origin = getOrigin(c.req.raw, c.env.SITE_URL);

  return textResponse(
    [
      "User-agent: *",
      "Allow: /",
      `Sitemap: ${origin}/sitemap.xml`,
      "",
    ].join("\n"),
    "text/plain; charset=utf-8",
  );
});

app.get("/manifest.webmanifest", () =>
  new Response(
    JSON.stringify({
      name: "알뜰맵",
      short_name: "알뜰맵",
      description: "가격이 보이는 동네 지도",
      start_url: "/",
      display: "standalone",
      background_color: "#f4f1ec",
      theme_color: "#b55a2b",
      lang: "ko",
    }),
    {
      headers: {
        "content-type": "application/manifest+json; charset=utf-8",
      },
    },
  ),
);

app.get("/sitemap.xml", (c) => {
  const origin = getOrigin(c.req.raw, c.env.SITE_URL);
  const now = new Date().toISOString();
  const staticPaths = ["/", "/submit", "/report", "/login", "/signup"];
  const placePaths = getFilteredPlaces()
    .slice(0, 120)
    .map((place) => `/place/${place.id}`);
  const paths = [...staticPaths, ...placePaths];
  const urls = paths
    .map(
      (path) => `
  <url>
    <loc>${origin}${path}</loc>
    <lastmod>${now}</lastmod>
  </url>`,
    )
    .join("");

  return textResponse(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>
`,
    "application/xml; charset=utf-8",
  );
});

app.all("/api/*", (c) =>
  c.json(
    {
      error: "Vite Worker API migration placeholder",
      path: c.req.path,
    },
    501,
  ),
);

app.notFound((c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
