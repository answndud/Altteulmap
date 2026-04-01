import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import dotenv from "dotenv";

const cwd = process.cwd();
const target = process.argv.includes("--preview") ? "preview" : "production";

for (const filename of [".env", ".env.local"]) {
  const fullPath = path.join(cwd, filename);

  if (fs.existsSync(fullPath)) {
    dotenv.config({
      path: fullPath,
      override: true,
    });
  }
}

const requiredVars = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_NAVER_MAP_KEY_ID",
  "AUTH_KAKAO_CLIENT_ID",
  "AUTH_KAKAO_CLIENT_SECRET",
  "AUTH_NAVER_CLIENT_ID",
  "AUTH_NAVER_CLIENT_SECRET",
];

const optionalVars = ["EMAIL_FROM", "RESEND_API_KEY"];

function isTruthy(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isLocalhostUrl(value) {
  try {
    const url = new URL(value);

    return (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

function printSection(title) {
  console.log(`\n[${title}]`);
}

function main() {
  console.log(`Checking Cloudflare deploy readiness for ${target}`);

  printSection("Required env");

  const missingRequired = requiredVars.filter(
    (name) => !isTruthy(process.env[name]),
  );

  for (const name of requiredVars) {
    console.log(`${missingRequired.includes(name) ? "FAIL" : "OK  "} ${name}`);
  }

  printSection("Optional env");

  for (const name of optionalVars) {
    console.log(`${isTruthy(process.env[name]) ? "OK  " : "WARN"} ${name}`);
  }

  printSection("Runtime checks");

  const useMockData = process.env.USE_MOCK_DATA ?? "";

  if (useMockData === "false") {
    console.log("OK   USE_MOCK_DATA=false");
  } else {
    console.log("WARN USE_MOCK_DATA should be false before deploy");
  }

  const nextAuthUrl = process.env.NEXTAUTH_URL ?? "";

  if (!isTruthy(nextAuthUrl)) {
    console.log("FAIL NEXTAUTH_URL is missing");
  } else if (target === "production" && isLocalhostUrl(nextAuthUrl)) {
    console.log("FAIL NEXTAUTH_URL still points to localhost");
  } else if (target === "production" && !nextAuthUrl.startsWith("https://")) {
    console.log("WARN NEXTAUTH_URL should use https in production");
  } else {
    console.log("OK   NEXTAUTH_URL format looks valid");
  }

  const wranglerConfigPath = path.join(cwd, "wrangler.jsonc");
  console.log(
    `${fs.existsSync(wranglerConfigPath) ? "OK  " : "FAIL"} wrangler.jsonc`,
  );

  const devVarsPath = path.join(cwd, ".dev.vars");
  console.log(`${fs.existsSync(devVarsPath) ? "OK  " : "WARN"} .dev.vars`);

  printSection("OAuth callback reminders");

  console.log(
    `- Kakao callback: ${nextAuthUrl || "<NEXTAUTH_URL>"}/api/auth/callback/kakao`,
  );
  console.log(
    `- Naver callback: ${nextAuthUrl || "<NEXTAUTH_URL>"}/api/auth/callback/naver`,
  );

  if (missingRequired.length > 0) {
    console.error(
      `\nDeploy check failed. Missing required env: ${missingRequired.join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  if (target === "production" && isLocalhostUrl(nextAuthUrl)) {
    console.error("\nDeploy check failed. NEXTAUTH_URL must not use localhost.");
    process.exitCode = 1;
    return;
  }

  console.log("\nDeploy check passed.");
}

main();
