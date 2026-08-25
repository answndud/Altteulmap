import assert from "node:assert/strict";
import test from "node:test";

import {
  applyRateLimitHeaders,
  consumeRateLimitPolicy,
} from "../../src/lib/rate-limit";
import { getRateLimitFeedbackMessage } from "../../src/lib/rate-limit-feedback";
import {
  createCurrentLoginHref,
  createLoginHref,
  createSignupHref,
  normalizeCallbackUrl as normalizeClientCallbackUrl,
} from "../../src/lib/auth-navigation";
import {
  appendCookie,
  getCookieValue,
  getOrCreateVisitorId,
} from "../../src/worker/http/cookies";
import {
  getOrigin,
  normalizeCallbackUrl as normalizeWorkerCallbackUrl,
} from "../../src/worker/http/urls";
import {
  decodeSignedPayload,
  encodeSignedPayload,
  getSessionFromRequest,
  isValidCsrfToken,
} from "../../src/worker/auth/session";
import {
  isLocalTurnstileBypassAllowed,
} from "../../src/worker/routes/public-write-support";
import {
  applyWorkerWriteHeaders,
  getWorkerPublicWriteActor,
} from "../../src/worker/public-write-actor";
import { getWorkerPlaceReactionRateLimitActor } from "../../src/worker/routes/public-write-support";
import { getPriceReportSubmissionKey } from "../../src/worker/price-report-identity";
import { readRequestBodyWithinLimit } from "../../src/worker/http/request-body";
import { parseModerationSuggestion } from "../../src/worker/admin/moderation-suggestion-validation";
import {
  createOAuthState,
  decodeOAuthState,
  exchangeOAuthToken,
} from "../../src/worker/routes/auth-oauth-support";

test("rate limit policies consume buckets and expose retry headers", () => {
  const key = `unit-${Date.now()}-${Math.random()}`;

  assert.equal(consumeRateLimitPolicy("authSignup", key).ok, true);
  assert.equal(consumeRateLimitPolicy("authSignup", key).ok, true);
  assert.equal(consumeRateLimitPolicy("authSignup", key).ok, true);

  const limited = consumeRateLimitPolicy("authSignup", key);
  const response = applyRateLimitHeaders(new Response(null), limited);

  assert.equal(limited.ok, false);
  assert.equal(response.headers.get("X-RateLimit-Policy"), "auth_signup");
  assert.equal(response.headers.get("Retry-After") !== null, true);
});

test("rate limit feedback prefers Retry-After and strips duplicate suffixes", () => {
  const response = new Response(null, {
    status: 429,
    headers: {
      "Retry-After": "65",
    },
  });

  assert.equal(
    getRateLimitFeedbackMessage({
      response,
      message: "요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
    }),
    "요청이 너무 빠릅니다. 약 1분 5초 후 다시 시도해주세요.",
  );
});

test("place reaction rate limits are isolated per place", () => {
  const actor = getWorkerPublicWriteActor(
    new Request("https://altteulmap.example/"),
    null,
  );
  const firstPlaceActor = getWorkerPlaceReactionRateLimitActor("place-a", actor);
  const secondPlaceActor = getWorkerPlaceReactionRateLimitActor("place-b", actor);

  assert.notEqual(firstPlaceActor.key, secondPlaceActor.key);
  assert.equal(firstPlaceActor.key.endsWith(":place:place-a"), true);
  assert.equal(secondPlaceActor.key.endsWith(":place:place-b"), true);
});

test("client auth navigation keeps only safe callback URLs", () => {
  assert.equal(normalizeClientCallbackUrl("/map?query=김밥"), "/map?query=%EA%B9%80%EB%B0%A5");
  assert.equal(normalizeClientCallbackUrl("//evil.test/path"), "/");
  assert.equal(createLoginHref("/bookmarks"), "/login?callbackUrl=%2Fbookmarks");
  assert.equal(createSignupHref("/login"), "/signup?callbackUrl=%2F");
  assert.equal(createCurrentLoginHref(), "/login?callbackUrl=%2F");

  const originalWindow = globalThis.window;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        pathname: "/map",
        search: "?q=%EA%B9%80%EB%B0%A5&scope=global",
      },
    },
  });

  try {
    assert.equal(
      createCurrentLoginHref(),
      "/login?callbackUrl=%2Fmap%3Fq%3D%25EA%25B9%2580%25EB%25B0%25A5%26scope%3Dglobal",
    );
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  }
});

test("worker URL helpers reject external callback URLs", () => {
  const request = new Request("https://altteulmap.example/map");

  assert.equal(getOrigin(request, "https://custom.example/admin"), "https://custom.example");
  assert.equal(
    normalizeWorkerCallbackUrl("https://altteulmap.example/bookmarks", "https://altteulmap.example"),
    "/bookmarks",
  );
  assert.equal(
    normalizeWorkerCallbackUrl("https://evil.example/bookmarks", "https://altteulmap.example"),
    "/",
  );
});

test("cookie helpers decode values and add secure attributes only for HTTPS", () => {
  assert.equal(getCookieValue("a=1; visitor=%EA%B9%80", "visitor"), "김");
  assert.equal(getOrCreateVisitorId(new Request("http://127.0.0.1/", {
    headers: { cookie: "altteulmap_visitor_id=visitor-1" },
  })), "visitor-1");

  const local = appendCookie(new Response(null), new Request("http://127.0.0.1/"), {
    name: "local",
    value: "1",
  });
  const secure = appendCookie(new Response(null), new Request("https://example.com/"), {
    name: "secure",
    value: "1",
  });

  assert.equal(local.headers.get("Set-Cookie")?.includes("Secure"), false);
  assert.equal(secure.headers.get("Set-Cookie")?.includes("Secure"), true);
});

test("signed auth payloads fail closed when AUTH_SECRET is missing", () => {
  assert.throws(
    () => encodeSignedPayload({ role: "admin" }, {}),
    /AUTH_SECRET is required/,
  );
  assert.equal(
    decodeSignedPayload("v1.invalid.invalid", {}),
    null,
  );
});

test("legacy unsigned session cookies cannot authenticate", () => {
  const unsignedSession = encodeURIComponent(
    JSON.stringify({
      user: {
        id: "00000000-0000-4000-8000-000000000001",
        email: "attacker@example.com",
        name: "attacker",
        role: "admin",
      },
      expires: new Date(Date.now() + 60_000).toISOString(),
    }),
  );
  const request = new Request("https://altteulmap.example/", {
    headers: {
      cookie: `next-auth.session-token=${unsignedSession}`,
    },
  });

  assert.equal(getSessionFromRequest(request, { AUTH_SECRET: "test-secret" }), null);
});

test("credential login requires the CSRF token issued to the browser", () => {
  const request = new Request("https://altteulmap.example/api/auth/callback/credentials", {
    headers: { cookie: "next-auth.csrf-token=csrf-token%7Cvite-mock" },
  });

  assert.equal(isValidCsrfToken(request, "csrf-token"), true);
  assert.equal(isValidCsrfToken(request, "wrong-token"), false);
  assert.equal(isValidCsrfToken(new Request(request), "csrf-token"), true);
});

test("OAuth state is provider-bound, expiring, and tamper-resistant", () => {
  const env = {
    ASSETS: { fetch: async () => new Response() },
    AUTH_SECRET: "unit-oauth-secret",
    AUTH_KAKAO_CLIENT_ID: "kakao-client",
    AUTH_KAKAO_CLIENT_SECRET: "kakao-secret",
  };
  const state = createOAuthState("kakao", "/bookmarks", env);
  const decoded = decodeOAuthState(state, env);

  assert.equal(decoded?.provider, "kakao");
  assert.equal(decoded?.callbackUrl, "/bookmarks");
  assert.equal(decodeOAuthState(`${state}tampered`, env), null);
  assert.equal(
    decodeOAuthState(
      encodeSignedPayload(
        {
          callbackUrl: "/",
          expires: Date.now() - 1,
          nonce: "expired",
          provider: "kakao",
        },
        env,
      ),
      env,
    ),
    null,
  );
});

test("OAuth token exchange rejects malformed provider responses", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ access_token: 42 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  try {
    await assert.rejects(
      exchangeOAuthToken(
        "kakao",
        "one-time-code",
        {
          ASSETS: { fetch: async () => new Response() },
          AUTH_KAKAO_CLIENT_ID: "client",
          AUTH_KAKAO_CLIENT_SECRET: "secret",
        },
        "https://example.com",
      ),
      /malformed/u,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("moderation suggestions fail closed when output shape is invalid", () => {
  assert.equal(
    parseModerationSuggestion({
      suggestedAction: "approve",
      confidence: 101,
      summary: "bad confidence",
      checks: [],
      flags: [],
    }),
    null,
  );
  assert.deepEqual(
    parseModerationSuggestion({
      suggestedAction: "review",
      confidence: 80,
      summary: "정상 제안",
      checks: ["address_match"],
      flags: [],
    }),
    {
      suggestedAction: "review",
      confidence: 80,
      summary: "정상 제안",
      checks: ["address_match"],
      flags: [],
    },
  );
});

test("Turnstile bypass is restricted to local hostnames", () => {
  assert.equal(
    isLocalTurnstileBypassAllowed(
      new Request("http://127.0.0.1/api/places"),
      {
        ASSETS: { fetch: async () => new Response() },
        USE_MOCK_DATA: "true",
      },
    ),
    true,
  );
  assert.equal(
    isLocalTurnstileBypassAllowed(
      new Request("https://production.example/api/places"),
      {
        ASSETS: { fetch: async () => new Response() },
        USE_MOCK_DATA: "true",
      },
    ),
    false,
  );
});

test("visitor actor cookies are signed and rotation cannot claim an existing actor", () => {
  const env = { AUTH_SECRET: "unit-visitor-secret" };
  const firstRequest = new Request("https://example.com/api/places", {
    headers: { cookie: "" },
  });
  const firstActor = getWorkerPublicWriteActor(firstRequest, null, { env });
  const firstResponse = applyWorkerWriteHeaders(
    new Response(null),
    firstRequest,
    firstActor,
  );
  const setCookie = firstResponse.headers.get("set-cookie");

  assert.ok(setCookie);
  const cookieHeader = setCookie.split(";", 1)[0];
  const secondActor = getWorkerPublicWriteActor(
    new Request("https://example.com/api/places", {
      headers: { cookie: cookieHeader },
    }),
    null,
    { env },
  );
  const rotatedActor = getWorkerPublicWriteActor(
    new Request("https://example.com/api/places", {
      headers: { cookie: `altteulmap_visitor_id=${crypto.randomUUID()}` },
    }),
    null,
    { env },
  );

  assert.equal(secondActor.visitorId, firstActor.visitorId);
  assert.notEqual(rotatedActor.visitorId, firstActor.visitorId);
});

test("price report submission keys are actor- and content-specific", () => {
  const env = { AUTH_SECRET: "unit-price-secret" };
  const actor = getWorkerPublicWriteActor(
    new Request("https://example.com"),
    null,
    { env },
  );
  const sameSubmission = getPriceReportSubmissionKey(
    "place-1",
    actor,
    "김치찌개",
    7000,
    null,
  );
  const repeatedSubmission = getPriceReportSubmissionKey(
    "place-1",
    actor,
    "김치찌개",
    7000,
    null,
  );
  const changedAmount = getPriceReportSubmissionKey(
    "place-1",
    actor,
    "김치찌개",
    8000,
    null,
  );

  assert.equal(sameSubmission, repeatedSubmission);
  assert.notEqual(sameSubmission, changedAmount);
});

test("request body limits cover chunked bodies without trusting Content-Length", async () => {
  const requestInit = {
    method: "POST",
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("first-"));
        controller.enqueue(new TextEncoder().encode("second"));
        controller.close();
      },
    }),
    duplex: "half",
  } as RequestInit & { duplex: "half" };
  const request = new Request("https://example.com/api/places", requestInit);
  const accepted = await readRequestBodyWithinLimit(request, 20);

  assert.equal(accepted.ok, true);
  if (accepted.ok) {
    assert.equal(new TextDecoder().decode(accepted.body), "first-second");
  }

  const oversizedRequestInit = {
    method: "POST",
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(12));
        controller.enqueue(new Uint8Array(12));
        controller.close();
      },
    }),
    duplex: "half",
  } as RequestInit & { duplex: "half" };
  const oversized = new Request(
    "https://example.com/api/places",
    oversizedRequestInit,
  );

  assert.deepEqual(
    await readRequestBodyWithinLimit(oversized, 20),
    { ok: false, reason: "too-large" },
  );
});
