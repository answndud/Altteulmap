import process from "node:process";

import { loadEnvFilesWithShellPrecedence } from "./lib/load-env-files.mjs";
import { assertHttpsUrl } from "./lib/url-checks.mjs";

loadEnvFilesWithShellPrecedence({
  cwd: process.cwd(),
  filenames: [".env", ".env.production", ".env.local", ".env.production.local"],
});

const baseUrl = process.env.SMOKE_PUBLIC_URL ?? process.env.NEXTAUTH_URL ?? "";
const REQUEST_TIMEOUT_MS = 60_000;

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
    (body) =>
      body.includes('data-testid="login-form"') && body.includes(">로그인<"),
    "login page",
  );
  logStep("login", "ok");

  await expectTextOk(
    "/admin",
    (body) => body.includes("알뜰맵") || body.includes("관리자"),
    "admin page",
  );
  logStep("admin route", "ok");

  const unauthAdminResponse = await request("/api/admin/places");

  if (unauthAdminResponse.status !== 401) {
    throw new Error(`unauthenticated admin api returned ${unauthAdminResponse.status}`);
  }

  logStep("admin api boundary", "401");
  printLine("Remote smoke checks passed.");
}

main().catch((error) => {
  console.error(`Remote smoke checks failed: ${error.message}`);
  process.exitCode = 1;
});
