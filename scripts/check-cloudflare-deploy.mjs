import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { loadEnvFilesWithShellPrecedence } from "./lib/load-env-files.mjs";

const cwd = process.cwd();
const target = process.argv.includes("--preview") ? "preview" : "production";
const deploymentMode = process.argv.includes("--admin")
  ? "admin"
  : process.argv.includes("--public")
    ? "public"
    : "full";
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
];

const modeRequiredVars = {
  full: [],
  public: ["ADMIN_APP_URL"],
  admin: ["SITE_URL"],
};

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

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function printLine(message = "") {
  process.stdout.write(`${message}\n`);
}

function printSection(title) {
  printLine();
  printLine(`[${title}]`);
}

function getDeploymentModeLabel(mode) {
  switch (mode) {
    case "public":
      return "public-only worker";
    case "admin":
      return "standalone admin worker";
    default:
      return "full app worker";
  }
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
    printLine(`WARN ${name} should use https`);
    return true;
  }

  printLine(`OK   ${name} format looks valid`);
  return true;
}

function main() {
  printLine(
    `Checking Cloudflare deploy readiness for ${target} (${getDeploymentModeLabel(deploymentMode)})`,
  );

  const deploymentRequiredVars = [
    ...requiredVars,
    ...modeRequiredVars[deploymentMode],
  ];
  const missingRequired = deploymentRequiredVars.filter(
    (name) => !isTruthy(process.env[name]),
  );

  printSection("Required env");

  for (const name of deploymentRequiredVars) {
    printLine(`${missingRequired.includes(name) ? "FAIL" : "OK  "} ${name}`);
  }

  printSection("Optional env");

  const modeOptionalVars =
    deploymentMode === "full" ? ["ADMIN_APP_URL", "SITE_URL"] : [];

  for (const name of [...optionalVars, ...modeOptionalVars]) {
    printLine(`${isTruthy(process.env[name]) ? "OK  " : "WARN"} ${name}`);
  }

  printSection("Runtime checks");

  const useMockData = process.env.USE_MOCK_DATA ?? "";

  if (useMockData === "false") {
    printLine("OK   USE_MOCK_DATA=false");
  } else {
    printLine("WARN USE_MOCK_DATA should be false before deploy");
  }

  const nextAuthUrl = process.env.NEXTAUTH_URL ?? "";
  const adminAppUrl = process.env.ADMIN_APP_URL ?? "";
  const siteUrl = process.env.SITE_URL ?? "";

  const nextAuthUrlOk = printUrlCheck("NEXTAUTH_URL", nextAuthUrl);
  let adminAppUrlOk = true;
  let siteUrlOk = true;

  if (deploymentMode === "public") {
    adminAppUrlOk = printUrlCheck("ADMIN_APP_URL", adminAppUrl, {
      requireHttps: target === "production",
    });

    if (
      isTruthy(adminAppUrl) &&
      isTruthy(nextAuthUrl) &&
      adminAppUrl === nextAuthUrl
    ) {
      printLine("WARN ADMIN_APP_URL is identical to NEXTAUTH_URL");
    }
  }

  if (deploymentMode === "admin") {
    siteUrlOk = printUrlCheck("SITE_URL", siteUrl, {
      requireHttps: target === "production",
    });

    if (isTruthy(siteUrl) && isTruthy(nextAuthUrl) && siteUrl === nextAuthUrl) {
      printLine("WARN SITE_URL is identical to NEXTAUTH_URL");
    }
  }

  const wranglerConfigPath = path.join(
    cwd,
    deploymentMode === "admin" ? "wrangler.admin.jsonc" : "wrangler.jsonc",
  );
  printLine(
    `${fs.existsSync(wranglerConfigPath) ? "OK  " : "FAIL"} ${path.basename(wranglerConfigPath)}`,
  );

  const devVarsPath = path.join(cwd, ".dev.vars");
  printLine(`${fs.existsSync(devVarsPath) ? "OK  " : "WARN"} .dev.vars`);

  printSection("OAuth callback reminders");

  printLine(
    `- Kakao callback: ${nextAuthUrl || "<NEXTAUTH_URL>"}/api/auth/callback/kakao`,
  );
  printLine(
    `- Naver callback: ${nextAuthUrl || "<NEXTAUTH_URL>"}/api/auth/callback/naver`,
  );

  if (deploymentMode === "public") {
    printLine(
      `- Public /admin entrypoint: ${adminAppUrl || "<ADMIN_APP_URL>"}/admin`,
    );
  }

  if (deploymentMode === "admin") {
    printLine(`- Public home link: ${siteUrl || "<SITE_URL>"}/`);
  }

  if (missingRequired.length > 0) {
    console.error(
      `\nDeploy check failed. Missing required env: ${missingRequired.join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  if (!nextAuthUrlOk || !adminAppUrlOk || !siteUrlOk) {
    console.error("\nDeploy check failed. Fix the invalid URL values above.");
    process.exitCode = 1;
    return;
  }

  printLine();
  printLine("Deploy check passed.");
}

main();
