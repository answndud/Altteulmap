import process from "node:process";

import { loadEnvFilesWithShellPrecedence } from "./lib/load-env-files.mjs";
import { assertHttpsUrl } from "./lib/url-checks.mjs";

loadEnvFilesWithShellPrecedence({
  cwd: process.cwd(),
  filenames: [".env", ".env.production", ".env.local", ".env.production.local"],
});

const baseUrl = process.env.SMOKE_PUBLIC_URL ?? process.env.NEXTAUTH_URL ?? "";
const REQUEST_TIMEOUT_MS = 60_000;
const OAUTH_PROVIDER_HOSTS = {
  kakao: "kauth.kakao.com",
  naver: "nid.naver.com",
};

function printLine(message) {
  process.stdout.write(`${message}\n`);
}

function logStep(label, detail) {
  printLine(`- ${label}: ${detail}`);
}

async function request(pathname, options = {}) {
  return fetch(new URL(pathname, baseUrl), {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    redirect: "manual",
  });
}

function extractCookies(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const setCookie = headers.get("set-cookie");
  return setCookie ? [setCookie] : [];
}

function createCookieHeader(cookies) {
  return cookies
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

function parseCookiePair(cookiePair) {
  const separatorIndex = cookiePair.indexOf("=");

  if (separatorIndex === -1) {
    return null;
  }

  return {
    name: cookiePair.slice(0, separatorIndex),
    value: cookiePair.slice(separatorIndex + 1),
  };
}

function parseSetCookie(cookie) {
  const [pair = "", ...attributes] = cookie.split(";").map((part) => part.trim());
  const parsedPair = parseCookiePair(pair);

  if (!parsedPair) {
    return null;
  }

  return {
    ...parsedPair,
    attributes: attributes.map((attribute) => attribute.toLowerCase()),
    rawAttributes: attributes,
  };
}

function findSetCookie(cookies, name) {
  return cookies.map(parseSetCookie).find((cookie) => cookie?.name === name) ?? null;
}

function assertCookieAttributes(cookie, label, { requireSecure = true } = {}) {
  if (!cookie) {
    throw new Error(`${label} cookie was not set`);
  }

  if (!cookie.attributes.includes("httponly")) {
    throw new Error(`${label} cookie is missing HttpOnly`);
  }

  if (!cookie.attributes.includes("samesite=lax")) {
    throw new Error(`${label} cookie is missing SameSite=Lax`);
  }

  if (requireSecure && !cookie.attributes.includes("secure")) {
    throw new Error(`${label} cookie is missing Secure`);
  }
}

function mergeCookieHeader(cookieHeader, setCookies) {
  const jar = new Map();

  for (const pair of cookieHeader.split(";").map((part) => part.trim()).filter(Boolean)) {
    const parsedPair = parseCookiePair(pair);

    if (parsedPair) {
      jar.set(parsedPair.name, parsedPair.value);
    }
  }

  for (const setCookie of setCookies.map(parseSetCookie).filter(Boolean)) {
    const hasExpired =
      setCookie.attributes.includes("max-age=0") ||
      setCookie.attributes.some((attribute) => attribute.startsWith("expires=thu, 01 jan 1970")) ||
      setCookie.value === "";

    if (hasExpired) {
      jar.delete(setCookie.name);
    } else {
      jar.set(setCookie.name, setCookie.value);
    }
  }

  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function expectRedirectToHost(pathname, expectedHost, label) {
  const response = await request(pathname);

  if (response.status !== 302) {
    throw new Error(`${label} returned ${response.status}`);
  }

  const location = response.headers.get("location");

  if (!location) {
    throw new Error(`${label} did not return a location header`);
  }

  const redirectUrl = new URL(location, baseUrl);

  if (redirectUrl.host !== expectedHost) {
    throw new Error(`${label} redirected to ${redirectUrl.host}, expected ${expectedHost}`);
  }

  const cookies = extractCookies(response.headers);
  const state = redirectUrl.searchParams.get("state");
  const stateCookie = findSetCookie(cookies, "next-auth.state");

  if (!state) {
    throw new Error(`${label} did not include oauth state`);
  }

  assertCookieAttributes(stateCookie, `${label} state`);

  if (decodeURIComponent(stateCookie.value) !== state) {
    throw new Error(`${label} state cookie did not match redirect state`);
  }

  return redirectUrl;
}

async function expectTextOk(pathname, matcher, label) {
  const response = await request(pathname);

  if (!response.ok) {
    throw new Error(`${label} returned ${response.status}`);
  }

  const body = await response.text();

  if (!matcher(body)) {
    throw new Error(`${label} response did not match expected content`);
  }

  return body;
}

async function expectJson(pathname, label) {
  const response = await request(pathname);

  if (!response.ok) {
    throw new Error(`${label} returned ${response.status}`);
  }

  return await response.json();
}

function expectDatabaseSource(payload, label) {
  if (payload?.source !== "database" || payload?.mock === true) {
    throw new Error(
      `${label} expected database source but received source=${payload?.source} mock=${payload?.mock}`,
    );
  }
}

function isRemoteDatabaseHealthSource(source) {
  return source === "database" || source === "database-url" || source === "hyperdrive";
}

function expectDeepHealth(payload) {
  if (payload?.status !== "ok" || payload?.ok !== true || payload?.deep !== true) {
    throw new Error(`deep health is not ok: status=${payload?.status} ok=${payload?.ok}`);
  }

  const checks = Array.isArray(payload.checks) ? payload.checks : [];
  const byName = new Map(checks.map((check) => [check?.name, check]));

  for (const checkName of [
    "runtime",
    "public-config",
    "auth-providers",
    "database",
    "static-assets",
  ]) {
    const check = byName.get(checkName);

    if (check?.status !== "ok") {
      throw new Error(`deep health check ${checkName} returned ${check?.status}`);
    }
  }

  const database = byName.get("database");

  if (!isRemoteDatabaseHealthSource(database?.source)) {
    throw new Error(`deep health database source is ${database?.source}`);
  }
}

async function runOptionalCredentialsSmoke() {
  const adminEmail = process.env.SMOKE_ADMIN_EMAIL;
  const adminPassword = process.env.SMOKE_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    logStep("credentials/admin smoke", "skipped; set SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD");
    return;
  }

  const body = new URLSearchParams({
    email: adminEmail,
    password: adminPassword,
    callbackUrl: "/admin",
    json: "true",
  });
  const loginResponse = await request("/api/auth/callback/credentials", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!loginResponse.ok) {
    throw new Error(`admin credentials login returned ${loginResponse.status}`);
  }

  const loginPayload = await loginResponse.json();

  if (loginPayload?.url !== "/admin") {
    throw new Error(`admin credentials login returned unexpected url ${loginPayload?.url}`);
  }

  const cookieHeader = createCookieHeader(extractCookies(loginResponse.headers));
  const sessionCookie = findSetCookie(extractCookies(loginResponse.headers), "next-auth.session-token");

  if (!cookieHeader.includes("next-auth.session-token=")) {
    throw new Error("admin credentials login did not set session cookie");
  }

  assertCookieAttributes(sessionCookie, "admin credentials session");

  const sessionResponse = await request("/api/auth/session", {
    headers: {
      Cookie: cookieHeader,
    },
  });

  if (!sessionResponse.ok) {
    throw new Error(`authenticated session api returned ${sessionResponse.status}`);
  }

  const sessionPayload = await sessionResponse.json();

  if (
    sessionPayload?.user?.email !== adminEmail ||
    sessionPayload?.user?.role !== "admin" ||
    !sessionPayload?.expires ||
    Number.isNaN(Date.parse(sessionPayload.expires))
  ) {
    throw new Error("authenticated session api returned an unexpected session shape");
  }

  const adminResponse = await request("/api/admin/places", {
    headers: {
      Cookie: cookieHeader,
    },
  });

  if (!adminResponse.ok) {
    throw new Error(`authenticated admin api returned ${adminResponse.status}`);
  }

  expectDatabaseSource(await adminResponse.json(), "authenticated admin api");

  const signoutResponse = await request("/api/auth/signout", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader,
    },
    body: new URLSearchParams({
      callbackUrl: "/bookmarks",
      json: "true",
    }),
  });

  if (!signoutResponse.ok) {
    throw new Error(`signout returned ${signoutResponse.status}`);
  }

  const signoutPayload = await signoutResponse.json();

  if (signoutPayload?.url !== "/bookmarks") {
    throw new Error(`signout returned unexpected url ${signoutPayload?.url}`);
  }

  const signoutCookies = extractCookies(signoutResponse.headers);
  const clearedSessionCookie = findSetCookie(signoutCookies, "next-auth.session-token");

  if (
    !clearedSessionCookie ||
    !clearedSessionCookie.attributes.includes("max-age=0")
  ) {
    throw new Error("signout did not clear the session cookie");
  }

  const signedOutCookieHeader = mergeCookieHeader(cookieHeader, signoutCookies);
  const signedOutSessionResponse = await request("/api/auth/session", {
    headers: signedOutCookieHeader
      ? {
          Cookie: signedOutCookieHeader,
        }
      : {},
  });

  if (!signedOutSessionResponse.ok) {
    throw new Error(`signed-out session api returned ${signedOutSessionResponse.status}`);
  }

  const signedOutSessionPayload = await signedOutSessionResponse.json();

  if (Object.keys(signedOutSessionPayload).length !== 0) {
    throw new Error("signed-out session api did not return an empty session");
  }

  logStep("credentials/admin smoke", "ok");
}

async function main() {
  const normalizedBaseUrl = assertHttpsUrl(baseUrl, "SMOKE_PUBLIC_URL/NEXTAUTH_URL");

  printLine(`Running remote smoke against ${normalizedBaseUrl}`);

  const health = await expectJson("/api/health?deep=1", "deep health");
  expectDeepHealth(health);
  logStep("deep health", "runtime/db/auth/static ok");

  await expectTextOk("/", (body) => body.includes("알뜰맵"), "public /");
  logStep("home", "ok");

  await expectTextOk(
    "/robots.txt",
    (body) => body.includes(`Sitemap: ${normalizedBaseUrl}/sitemap.xml`),
    "public /robots.txt",
  );
  logStep("robots", "ok");

  await expectTextOk(
    "/sitemap.xml",
    (body) => body.includes(normalizedBaseUrl) && body.includes("/place/"),
    "public /sitemap.xml",
  );
  logStep("sitemap", "ok");

  const publicConfig = await expectJson("/api/config/public", "public config");

  if (!publicConfig.naverMapKeyId) {
    throw new Error("public config did not expose a NAVER map key");
  }

  logStep("public config", "naver map key available");

  const mapApiPayload = await expectJson(
    "/api/places/map?scope=global&query=%EA%B9%80%EB%B0%A5",
    "map api",
  );
  expectDatabaseSource(mapApiPayload, "map api");

  const samplePlaceId = mapApiPayload.items?.[0]?.id;

  if (!samplePlaceId) {
    throw new Error("map api did not return a sample place id");
  }

  logStep("map api", `${mapApiPayload.items.length} items`);

  await expectTextOk(`/place/${samplePlaceId}`, (body) => body.includes("알뜰맵"), "place page");
  logStep("place page", samplePlaceId);

  const placeApiPayload = await expectJson(`/api/places/${samplePlaceId}`, "place api");
  expectDatabaseSource(placeApiPayload, "place api");
  logStep("place api", "database source");

  await expectTextOk(
    "/login",
    (body) => body.includes('<div id="root"></div>'),
    "login page",
  );
  logStep("login", "ok");

  await expectTextOk(
    "/admin",
    (body) => body.includes('<div id="root"></div>'),
    "admin page",
  );
  logStep("admin route", "ok");

  const unauthAdminResponse = await request("/api/admin/places");

  if (unauthAdminResponse.status !== 401) {
    throw new Error(`unauthenticated admin api returned ${unauthAdminResponse.status}`);
  }

  logStep("admin api boundary", "401");

  const providers = await expectJson("/api/auth/providers", "auth providers");

  for (const [provider, expectedHost] of Object.entries(OAUTH_PROVIDER_HOSTS)) {
    if (!providers?.[provider]) {
      throw new Error(`auth providers did not include ${provider}`);
    }

    const redirectUrl = await expectRedirectToHost(
      `/api/auth/signin/${provider}?callbackUrl=%2Fbookmarks`,
      expectedHost,
      `${provider} signin`,
    );

    const callbackPath = `/api/auth/callback/${provider}`;

    if (redirectUrl.searchParams.get("redirect_uri") !== `${normalizedBaseUrl}${callbackPath}`) {
      throw new Error(`${provider} signin used unexpected redirect_uri`);
    }

    logStep(`${provider} signin`, "provider redirect ok");
  }

  await runOptionalCredentialsSmoke();

  printLine("Remote smoke checks passed.");
}

main().catch((error) => {
  console.error(`Remote smoke checks failed: ${error.message}`);
  process.exitCode = 1;
});
