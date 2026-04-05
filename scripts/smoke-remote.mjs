import process from "node:process";

import { loadEnvFilesWithShellPrecedence } from "./lib/load-env-files.mjs";

loadEnvFilesWithShellPrecedence({
  cwd: process.cwd(),
  filenames: [".env", ".env.production", ".env.local", ".env.production.local"],
});

const publicUrl = process.env.SMOKE_PUBLIC_URL ?? process.env.NEXTAUTH_URL ?? "";
const adminUrl = process.env.SMOKE_ADMIN_URL ?? process.env.ADMIN_APP_URL ?? "";
const REQUEST_TIMEOUT_MS = 60_000;

function printLine(message) {
  process.stdout.write(`${message}\n`);
}

function logStep(label, detail) {
  printLine(`- ${label}: ${detail}`);
}

function normalizeComparableUrl(value) {
  const url = new URL(value);
  const normalizedPath = url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, "");
  return `${url.origin}${normalizedPath}${url.search}`;
}

function assertHttpsUrl(value, label) {
  if (!value) {
    throw new Error(`${label} is missing`);
  }

  const url = new URL(value);

  if (url.protocol !== "https:") {
    throw new Error(`${label} must use https`);
  }

  return url.origin;
}

function extractCanonicalHref(html) {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

async function request(base, pathname, options = {}) {
  return fetch(new URL(pathname, base), {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    redirect: "manual",
  });
}

async function expectTextOk(base, pathname, matcher, label) {
  const response = await request(base, pathname);

  if (!response.ok) {
    throw new Error(`${label} returned ${response.status}`);
  }

  const body = await response.text();

  if (!matcher(body)) {
    throw new Error(`${label} response did not match expected content`);
  }

  return body;
}

async function main() {
  const normalizedPublicUrl = assertHttpsUrl(publicUrl, "SMOKE_PUBLIC_URL/NEXTAUTH_URL");
  const normalizedAdminUrl = adminUrl ? assertHttpsUrl(adminUrl, "SMOKE_ADMIN_URL/ADMIN_APP_URL") : "";

  printLine(`Running remote smoke against ${normalizedPublicUrl}`);
  if (normalizedAdminUrl) {
    logStep("admin url", normalizedAdminUrl);
  }

  const homeHtml = await expectTextOk(
    normalizedPublicUrl,
    "/",
    (body) => body.includes("알뜰맵"),
    "public /",
  );
  const homeCanonical = extractCanonicalHref(homeHtml);

  if (
    !homeCanonical ||
    normalizeComparableUrl(homeCanonical) !==
      normalizeComparableUrl(`${normalizedPublicUrl}/`)
  ) {
    throw new Error("public home canonical did not match public URL");
  }

  logStep("home canonical", homeCanonical);

  const robotsBody = await expectTextOk(
    normalizedPublicUrl,
    "/robots.txt",
    (body) => body.includes(`Sitemap: ${normalizedPublicUrl}/sitemap.xml`),
    "public /robots.txt",
  );
  logStep("robots", /user-agent:/i.test(robotsBody) ? "ok" : "unexpected");

  await expectTextOk(
    normalizedPublicUrl,
    "/sitemap.xml",
    (body) => body.includes(normalizedPublicUrl) && body.includes("/place/"),
    "public /sitemap.xml",
  );
  logStep("sitemap", "ok");

  const mapApiResponse = await request(
    normalizedPublicUrl,
    "/api/places/map?scope=global&query=%EA%B9%80%EB%B0%A5",
  );
  if (!mapApiResponse.ok) {
    throw new Error(`public map api returned ${mapApiResponse.status}`);
  }

  const mapApiPayload = await mapApiResponse.json();
  const samplePlaceId = mapApiPayload.items?.[0]?.id;

  if (!samplePlaceId) {
    throw new Error("public map api did not return a sample place id");
  }

  const samplePlaceUrl = `${normalizedPublicUrl}/place/${samplePlaceId}`;
  const samplePlaceResponse = await fetch(samplePlaceUrl, {
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!samplePlaceResponse.ok) {
    throw new Error(`sample place page returned ${samplePlaceResponse.status}`);
  }

  const samplePlaceHtml = await samplePlaceResponse.text();
  const samplePlaceCanonical = extractCanonicalHref(samplePlaceHtml);

  if (
    !samplePlaceCanonical ||
    normalizeComparableUrl(samplePlaceCanonical) !==
      normalizeComparableUrl(samplePlaceUrl)
  ) {
    throw new Error("sample place canonical did not match place URL");
  }

  logStep("sample place canonical", samplePlaceCanonical);

  await expectTextOk(
    normalizedPublicUrl,
    "/login",
    (body) =>
      body.includes('data-testid="login-form"') && body.includes(">로그인<"),
    "public /login",
  );
  logStep("public login", "ok");

  if (normalizedAdminUrl) {
    const publicAdminResponse = await request(normalizedPublicUrl, "/admin");
    const publicAdminLocation = publicAdminResponse.headers.get("location") ?? "";

    if (
      ![307, 308].includes(publicAdminResponse.status) ||
      normalizeComparableUrl(new URL(publicAdminLocation, normalizedPublicUrl).toString()) !==
        normalizeComparableUrl(`${normalizedAdminUrl}/admin`)
    ) {
      throw new Error("public /admin did not redirect to admin app");
    }

    logStep("public /admin redirect", publicAdminLocation);

    const publicAdminApiResponse = await request(normalizedPublicUrl, "/api/admin/places");
    if (!publicAdminApiResponse.ok) {
      throw new Error(`public /api/admin/places returned ${publicAdminApiResponse.status}`);
    }

    const publicAdminApiPayload = await publicAdminApiResponse.json();
    const expectedAdminPlacesUrl = `${normalizedAdminUrl}/admin/places`;

    if (publicAdminApiPayload.adminUrl !== expectedAdminPlacesUrl) {
      throw new Error("public /api/admin/places did not expose expected adminUrl");
    }

    logStep("public admin api", publicAdminApiPayload.adminUrl);

    const adminRedirectResponse = await request(normalizedAdminUrl, "/admin");
    const adminRedirectLocation = adminRedirectResponse.headers.get("location") ?? "";
    const resolvedAdminRedirect = new URL(adminRedirectLocation, normalizedAdminUrl).toString();

    if (
      ![307, 308].includes(adminRedirectResponse.status) ||
      !resolvedAdminRedirect.includes("/login?callbackUrl=%2Fadmin")
    ) {
      throw new Error("admin /admin did not redirect to login");
    }

    logStep("admin /admin redirect", adminRedirectLocation);

    await expectTextOk(
      normalizedAdminUrl,
      "/login",
      (body) =>
        body.includes('data-testid="login-form"') && body.includes(">로그인<"),
      "admin /login",
    );
    logStep("admin login", "ok");
  } else {
    logStep("admin checks", "skipped (SMOKE_ADMIN_URL/ADMIN_APP_URL not set)");
  }

  printLine("Remote smoke checks passed.");
}

main().catch((error) => {
  console.error(`Remote smoke checks failed: ${error.message}`);
  process.exitCode = 1;
});
