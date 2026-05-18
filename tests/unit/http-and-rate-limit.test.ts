import assert from "node:assert/strict";
import test from "node:test";

import {
  applyRateLimitHeaders,
  consumeRateLimitPolicy,
} from "../../src/lib/rate-limit";
import { getRateLimitFeedbackMessage } from "../../src/lib/rate-limit-feedback";
import {
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

test("client auth navigation keeps only safe callback URLs", () => {
  assert.equal(normalizeClientCallbackUrl("/map?query=김밥"), "/map?query=%EA%B9%80%EB%B0%A5");
  assert.equal(normalizeClientCallbackUrl("//evil.test/path"), "/");
  assert.equal(createLoginHref("/bookmarks"), "/login?callbackUrl=%2Fbookmarks");
  assert.equal(createSignupHref("/login"), "/signup?callbackUrl=%2F");
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
