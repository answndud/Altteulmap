import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

import dotenv from "dotenv";

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
  headed: [
    "npm run e2e:prepare",
    "npm run build",
    "playwright test --headed tests/e2e/map.spec.ts tests/e2e/signup.spec.ts tests/e2e/submission-admin.spec.ts",
    "USE_MOCK_DATA=true playwright test --headed tests/e2e/map.mobile.spec.ts --project mobile-chromium",
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
};

const commands = commandsByMode[mode];

if (!commands) {
  console.error(`Unsupported local E2E mode: ${mode}`);
  process.exit(1);
}

const env = {
  ...process.env,
};

for (const filename of [".env", ".env.local"]) {
  const filePath = path.join(cwd, filename);

  if (!existsSync(filePath)) {
    continue;
  }

  const parsed = dotenv.parse(readFileSync(filePath));
  Object.assign(env, parsed);
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

if (mode !== "ui" && env.USE_MOCK_DATA !== "true" && env.DATABASE_URL) {
  commandsToRun.splice(1, 0, "npm run db:push", "npm run db:seed");
}

for (const command of commandsToRun) {
  const result = spawnSync(command, {
    cwd,
    env,
    shell: true,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  if (command.includes("npm run build")) {
    writeGeneratedDevVars();
  }
}
