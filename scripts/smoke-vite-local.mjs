import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";

import { chromium } from "playwright";

import { loadEnvFilesWithShellPrecedence } from "./lib/load-env-files.mjs";

const cwd = process.cwd();
const port = Number(process.env.VITE_SMOKE_PORT ?? 3130);
const baseUrl = `http://127.0.0.1:${port}`;
const wranglerConfigPath = join(
  cwd,
  "dist/altteulmap/wrangler.json",
);
const generatedDevVarsPath = join(
  cwd,
  "dist/altteulmap/.dev.vars",
);
const workerEnvKeys = [
  "DATABASE_URL",
  "USE_MOCK_DATA",
  "AUTH_SECRET",
  "NEXTAUTH_URL",
  "SITE_URL",
  "AUTH_DEMO_PASSWORD",
  "AUTH_ADMIN_PASSWORD",
  "AUTH_KAKAO_CLIENT_ID",
  "AUTH_KAKAO_CLIENT_SECRET",
  "AUTH_NAVER_CLIENT_ID",
  "AUTH_NAVER_CLIENT_SECRET",
  "NEXT_PUBLIC_NAVER_MAP_KEY_ID",
  "NEXT_PUBLIC_NAVER_MAP_CLIENT_ID",
  "NAVER_MAP_CLIENT_ID",
  "NAVER_CLIENT_SECRET",
];

loadEnvFilesWithShellPrecedence({
  cwd,
  filenames: [".env", ".env.local"],
});

process.env.NEXTAUTH_URL = baseUrl;
process.env.SITE_URL = baseUrl;
process.env.AUTH_SECRET ??= "altteulmap-vite-local-smoke-secret";
process.env.AUTH_DEMO_PASSWORD ??= "demo1234";
process.env.AUTH_ADMIN_PASSWORD ??= "admin1234";

function quoteEnvValue(value) {
  return JSON.stringify(value ?? "");
}

function writeGeneratedDevVars() {
  mkdirSync(dirname(generatedDevVarsPath), { recursive: true });
  writeFileSync(
    generatedDevVarsPath,
    `${workerEnvKeys
      .filter((key) => typeof process.env[key] === "string")
      .map((key) => `${key}=${quoteEnvValue(process.env[key])}`)
      .join("\n")}\n`,
  );
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForWorker() {
  const deadline = Date.now() + 20_000;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);

      if (response.ok) {
        return;
      }

      lastError = new Error(`/api/health returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(300);
  }

  throw lastError ?? new Error("Worker did not start in time.");
}

function addCookie(jar, headers) {
  for (const cookie of headers.getSetCookie()) {
    const [pair] = cookie.split(";");
    const [name, ...valueParts] = pair.split("=");

    jar.set(name, decodeURIComponent(valueParts.join("=")));
  }
}

function toCookieHeader(jar) {
  return [...jar.entries()]
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join("; ");
}

async function request(pathname, options = {}, jar = new Map()) {
  const headers = new Headers(options.headers ?? {});

  if (jar.size > 0) {
    headers.set("cookie", toCookieHeader(jar));
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers,
    redirect: "manual",
  });

  addCookie(jar, response.headers);

  return response;
}

async function requestJson(pathname, options = {}, jar = new Map()) {
  const response = await request(pathname, options, jar);
  const body = await response.json().catch(() => null);

  return {
    body,
    response,
  };
}

async function login(email, password) {
  const jar = new Map();

  await request("/api/auth/csrf", {}, jar);

  const { response } = await requestJson(
    "/api/auth/callback/credentials",
    {
      body: JSON.stringify({
        callbackUrl: "/admin",
        email,
        json: "true",
        password,
      }),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
    },
    jar,
  );

  if (response.status !== 200) {
    throw new Error(`Login failed for ${email}: ${response.status}`);
  }

  return jar;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertSecurityHeaders(response, label) {
  const contentSecurityPolicy = response.headers.get("content-security-policy") ?? "";

  assert(
    contentSecurityPolicy.includes("default-src 'self'"),
    `${label} CSP default-src missing`,
  );
  assert(
    contentSecurityPolicy.includes("frame-ancestors 'none'"),
    `${label} CSP frame-ancestors missing`,
  );
  assert(
    contentSecurityPolicy.includes("https://oapi.map.naver.com"),
    `${label} CSP NAVER Maps allowlist missing`,
  );
  assert(
    response.headers.get("x-content-type-options") === "nosniff",
    `${label} X-Content-Type-Options missing`,
  );
  assert(
    response.headers.get("x-frame-options") === "DENY",
    `${label} X-Frame-Options missing`,
  );
  assert(
    response.headers.get("referrer-policy") === "strict-origin-when-cross-origin",
    `${label} Referrer-Policy missing`,
  );
  assert(
    response.headers
      .get("permissions-policy")
      ?.includes("geolocation=(self)") === true,
    `${label} Permissions-Policy missing geolocation baseline`,
  );
}

async function smokeApi() {
  const deepHealth = await requestJson("/api/health?deep=1");

  assert(deepHealth.response.status === 200, "deep health failed");
  assert(deepHealth.body.ok === true, "deep health returned non-ok status");
  assert(
    deepHealth.body.checks?.some(
      (check) => check.name === "database" && check.status === "ok",
    ),
    "deep health did not confirm database",
  );
  assert(
    deepHealth.body.checks?.some(
      (check) => check.name === "static-assets" && check.status === "ok",
    ),
    "deep health did not confirm static assets",
  );

  const home = await request("/");
  assert(home.status === 200, "home page failed");
  assertSecurityHeaders(home, "home page");

  const categories = await requestJson("/api/categories");

  assert(categories.response.status === 200, "categories API failed");
  assertSecurityHeaders(categories.response, "categories API");
  assert(Array.isArray(categories.body.groups), "categories.groups missing");
  assert(
    Array.isArray(categories.body.categories),
    "categories.categories missing",
  );

  const publicConfig = await requestJson("/api/config/public");

  assert(publicConfig.response.status === 200, "public config API failed");
  assertSecurityHeaders(publicConfig.response, "public config API");
  assert(
    Boolean(publicConfig.body.naverMapKeyId),
    "public config did not expose a NAVER map key",
  );

  const map = await requestJson("/api/places/map?scope=global");

  assert(map.response.status === 200, "map API failed");
  assert(Array.isArray(map.body.items), "map.items missing");
  assert(map.body.items.length > 0, "map API returned no places");

  const firstPlace = map.body.items[0];
  const detail = await requestJson(`/api/places/${firstPlace.id}`);

  assert(detail.response.status === 200, "place detail API failed");
  assert(detail.body.item?.id === firstPlace.id, "place detail id mismatch");

  const telemetry = await requestJson("/api/telemetry/visit", {
    body: JSON.stringify({
      path: "/",
      scope: "public",
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  assert(telemetry.response.status === 200, "telemetry API failed");
  assert(telemetry.body.ok === true, "telemetry response shape changed");

  return firstPlace;
}

async function smokeAuthAndAdminApi() {
  const unauth = await requestJson("/api/admin/places");

  assert(unauth.response.status === 401, "admin API unauth status changed");

  const userJar = await login(
    "demo@altteulmap.local",
    process.env.AUTH_DEMO_PASSWORD,
  );
  const forbidden = await requestJson("/api/admin/places", {}, userJar);

  assert(forbidden.response.status === 403, "admin API forbidden status changed");

  const adminJar = await login(
    "admin@altteulmap.local",
    process.env.AUTH_ADMIN_PASSWORD,
  );
  const [places, prices, reports] = await Promise.all([
    requestJson("/api/admin/places", {}, adminJar),
    requestJson("/api/admin/prices", {}, adminJar),
    requestJson("/api/admin/reports", {}, adminJar),
  ]);

  assert(places.response.status === 200, "admin places API failed");
  assert(prices.response.status === 200, "admin prices API failed");
  assert(reports.response.status === 200, "admin reports API failed");

  return adminJar;
}

async function smokeAdminUi(firstPlace, adminJar) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  try {
    await context.addCookies(
      [...adminJar.entries()].map(([name, value]) => ({
        name,
        url: baseUrl,
        value,
      })),
    );

    const page = await context.newPage();

    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
    await page.getByText("알뜰맵").first().waitFor({ timeout: 5_000 });
    await page.goto(`${baseUrl}/admin`, { waitUntil: "networkidle" });
    await page
      .getByRole("heading", { name: "운영 대시보드" })
      .waitFor({ timeout: 5_000 });
    await page.goto(`${baseUrl}/admin/places`, { waitUntil: "networkidle" });
    await page
      .getByRole("heading", { name: "신규 장소 승인 큐" })
      .waitFor({ timeout: 5_000 });
    await page.goto(`${baseUrl}/admin/prices`, { waitUntil: "networkidle" });
    await page
      .getByRole("heading", { name: "가격 제보 검토 큐" })
      .waitFor({ timeout: 5_000 });
    await page.goto(`${baseUrl}/admin/reports`, { waitUntil: "networkidle" });
    await page
      .getByRole("heading", { name: "신고 검토 큐" })
      .waitFor({ timeout: 5_000 });
    await page.goto(`${baseUrl}/admin/prices/places/${firstPlace.id}`, {
      waitUntil: "networkidle",
    });
    await page
      .getByRole("heading", { name: "장소 가격 관리" })
      .waitFor({ timeout: 5_000 });
    await page
      .getByRole("button", { name: "저장" })
      .first()
      .waitFor({ timeout: 5_000 });
  } finally {
    await browser.close();
  }
}

async function runSmoke() {
  writeGeneratedDevVars();

  const child = spawn(
    "npx",
    [
      "wrangler",
      "dev",
      "--config",
      wranglerConfigPath,
      "--local",
      "--port",
      String(port),
    ],
    {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const logs = [];

  child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  child.stderr.on("data", (chunk) => logs.push(chunk.toString()));

  try {
    await waitForWorker();

    const firstPlace = await smokeApi();
    const adminJar = await smokeAuthAndAdminApi();

    await smokeAdminUi(firstPlace, adminJar);

    console.log(
      JSON.stringify(
        {
          baseUrl,
          ok: true,
          place: firstPlace.id,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(logs.slice(-20).join(""));
    throw error;
  } finally {
    child.kill("SIGTERM");
  }
}

runSmoke().catch((error) => {
  console.error(`Vite local smoke failed: ${error.message}`);
  process.exitCode = 1;
});
