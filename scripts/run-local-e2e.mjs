import {
  mkdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";

import { loadEnvFilesWithShellPrecedence } from "./lib/load-env-files.mjs";
import { runCommand } from "./lib/run-command.mjs";

const cwd = process.cwd();
const mode = process.argv[2] ?? "full";

const commandsByMode = {
  smoke: [
    "npm run e2e:prepare",
    "npm run build",
    "npm run test:e2e:smoke:ci",
  ],
  full: [
    "npm run e2e:prepare",
    "npm run build",
    "npm run test:e2e:full:ci",
  ],
  all: [
    "npm run e2e:prepare",
    "npm run build",
    "npm run test:e2e:all:ci",
  ],
  headed: [
    "npm run e2e:prepare",
    "npm run build",
    "playwright test --headed tests/e2e/map.spec.ts tests/e2e/login.spec.ts tests/e2e/map-price-filter.spec.ts tests/e2e/signup.spec.ts tests/e2e/submission-admin.spec.ts",
    "playwright test --headed tests/e2e/bookmarks.spec.ts tests/e2e/comments.spec.ts tests/e2e/price-review.spec.ts tests/e2e/report-admin.spec.ts",
  ],
  ui: [
    "npm run e2e:prepare",
    "USE_MOCK_DATA=true npm run build",
    "playwright test --ui",
  ],
  performance: [
    "npm run e2e:prepare",
    "npm run build",
    "playwright test tests/e2e/performance.spec.ts --project chromium",
  ],
  mock: [
    "npm run e2e:prepare",
    "npm run build",
    "playwright test tests/e2e/accessibility.spec.ts --project chromium",
  ],
};

const commands = commandsByMode[mode];

if (!commands) {
  console.error(`Unsupported local E2E mode: ${mode}`);
  process.exit(1);
}

loadEnvFilesWithShellPrecedence({
  cwd,
  filenames: [".env", ".env.local"],
});

const env = {
  ...process.env,
};

if (mode === "mock") {
  env.USE_MOCK_DATA = "true";
}

env.AUTH_SECRET ??= "altteulmap-local-auth-secret-change-me";
env.NEXTAUTH_URL = "http://127.0.0.1:3107";
env.AUTH_DEMO_PASSWORD ??= "demo1234";
env.AUTH_ADMIN_PASSWORD ??= "admin1234";

const commandsToRun = [...commands];
const generatedDevVarsPath = path.join(cwd, "dist/altteulmap/.dev.vars");
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
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "NAVER_MAP_CLIENT_ID",
  "NAVER_CLIENT_SECRET",
  "TURNSTILE_BYPASS_TOKEN",
  "TURNSTILE_SECRET_KEY",
];

function quoteEnvValue(value) {
  return JSON.stringify(value ?? "");
}

function writeGeneratedDevVars() {
  mkdirSync(path.dirname(generatedDevVarsPath), { recursive: true });
  writeFileSync(
    generatedDevVarsPath,
    `${workerEnvKeys
      .filter((key) => typeof env[key] === "string")
      .map((key) => `${key}=${quoteEnvValue(env[key])}`)
      .join("\n")}\n`,
  );
}

if (mode !== "ui" && env.USE_MOCK_DATA !== "true") {
  commandsToRun.splice(1, 0, "npm run db:local:setup");
  console.log("[e2e] source: Docker PostgreSQL");
} else {
  console.log("[e2e] source: mock data");
}

for (const command of commandsToRun) {
  runCommand(command, { cwd, env });

  if (command.includes("npm run build")) {
    writeGeneratedDevVars();
  }
}
