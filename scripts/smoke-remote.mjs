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

  if (!cookies.some((cookie) => cookie.startsWith("next-auth.state="))) {
    throw new Error(`${label} did not set next-auth.state cookie`);
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

  if (!cookieHeader.includes("next-auth.session-token=")) {
    throw new Error("admin credentials login did not set session cookie");
  }

  const adminResponse = await request("/api/admin/places", {
    headers: {
      Cookie: cookieHeader,
    },
  });

  if (!adminResponse.ok) {
    throw new Error(`authenticated admin api returned ${adminResponse.status}`);
  }

  logStep("credentials/admin smoke", "ok");
}

async function main() {
  const normalizedBaseUrl = assertHttpsUrl(baseUrl, "SMOKE_PUBLIC_URL/NEXTAUTH_URL");

  printLine(`Running remote smoke against ${normalizedBaseUrl}`);

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

  const mapApiPayload = await expectJson(
    "/api/places/map?scope=global&query=%EA%B9%80%EB%B0%A5",
    "map api",
  );
  const samplePlaceId = mapApiPayload.items?.[0]?.id;

  if (!samplePlaceId) {
    throw new Error("map api did not return a sample place id");
  }

  logStep("map api", `${mapApiPayload.items.length} items`);

  await expectTextOk(`/place/${samplePlaceId}`, (body) => body.includes("알뜰맵"), "place page");
  logStep("place page", samplePlaceId);

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
