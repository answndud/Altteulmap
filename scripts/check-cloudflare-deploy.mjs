import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { loadEnvFilesWithShellPrecedence } from "./lib/load-env-files.mjs";
import { isHttpsUrl, isLocalhostUrl, isTruthy } from "./lib/url-checks.mjs";

const cwd = process.cwd();
const target = process.argv.includes("--preview") ? "preview" : "production";
const envFiles =
  target === "production"
    ? [".env", ".env.production", ".env.local", ".env.production.local"]
    : [".env", ".env.local"];

loadEnvFilesWithShellPrecedence({
  cwd,
  filenames: envFiles,
});

const requiredVars = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_NAVER_MAP_KEY_ID",
  "AUTH_KAKAO_CLIENT_ID",
  "AUTH_KAKAO_CLIENT_SECRET",
  "AUTH_NAVER_CLIENT_ID",
  "AUTH_NAVER_CLIENT_SECRET",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
];

const optionalVars = [
  "SITE_URL",
  "AUTH_DEMO_PASSWORD",
  "AUTH_ADMIN_PASSWORD",
  "EMAIL_FROM",
  "RESEND_API_KEY",
];

function printLine(message = "") {
  process.stdout.write(`${message}\n`);
}

function printSection(title) {
  printLine();
  printLine(`[${title}]`);
}

function printUrlCheck(name, value, options = {}) {
  const { requireHttps = false } = options;

  if (!isTruthy(value)) {
    printLine(`FAIL ${name} is missing`);
    return false;
  }

  if (target === "production" && isLocalhostUrl(value)) {
    printLine(`FAIL ${name} still points to localhost`);
    return false;
  }

  if ((target === "production" || requireHttps) && !isHttpsUrl(value)) {
    printLine(`${requireHttps ? "FAIL" : "WARN"} ${name} should use https`);
    return !requireHttps;
  }

  printLine(`OK   ${name} format looks valid`);
  return true;
}

function main() {
  printLine(`Checking Cloudflare deploy readiness for ${target} (Vite Worker)`);

  const missingRequired = requiredVars.filter(
    (name) => !isTruthy(process.env[name]),
  );

  printSection("Required env");

  for (const name of requiredVars) {
    printLine(`${missingRequired.includes(name) ? "FAIL" : "OK  "} ${name}`);
  }

  printSection("Optional env");

  for (const name of optionalVars) {
    printLine(`${isTruthy(process.env[name]) ? "OK  " : "WARN"} ${name}`);
  }

  printSection("Runtime checks");

  const useMockData = process.env.USE_MOCK_DATA ?? "";

  if (useMockData === "false") {
    printLine("OK   USE_MOCK_DATA=false");
  } else {
    printLine("FAIL USE_MOCK_DATA must be false before deploy");
  }

  const nextAuthUrl = process.env.NEXTAUTH_URL ?? "";
  const nextAuthUrlOk = printUrlCheck("NEXTAUTH_URL", nextAuthUrl, {
    requireHttps: target === "production",
  });
  const wranglerConfigPath = path.join(cwd, "wrangler.jsonc");

  printLine(
    `${fs.existsSync(wranglerConfigPath) ? "OK  " : "FAIL"} wrangler.jsonc`,
  );

  const distWranglerConfigPath = path.join(
    cwd,
    "dist",
    "altteulmap",
    "wrangler.json",
  );

  printLine(
    `${fs.existsSync(distWranglerConfigPath) ? "OK  " : "WARN"} dist/altteulmap/wrangler.json`,
  );

  printSection("OAuth callback reminders");

  printLine(
    `- Kakao callback: ${nextAuthUrl || "<NEXTAUTH_URL>"}/api/auth/callback/kakao`,
  );
  printLine(
    `- Naver callback: ${nextAuthUrl || "<NEXTAUTH_URL>"}/api/auth/callback/naver`,
  );

  if (missingRequired.length > 0) {
    console.error(
      `\nDeploy check failed. Missing required env: ${missingRequired.join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  if (!nextAuthUrlOk) {
    console.error("\nDeploy check failed. Fix the invalid URL values above.");
    process.exitCode = 1;
    return;
  }

  if (useMockData !== "false") {
    console.error("\nDeploy check failed. Set USE_MOCK_DATA=false before deploy.");
    process.exitCode = 1;
    return;
  }

  printLine();
  printLine("Deploy check passed.");
}

main();
