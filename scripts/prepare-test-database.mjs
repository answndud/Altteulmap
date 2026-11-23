import { spawnSync } from "node:child_process";
import process from "node:process";

import postgres from "postgres";

import { loadEnvFilesWithShellPrecedence } from "./lib/load-env-files.mjs";

loadEnvFilesWithShellPrecedence({
  cwd: process.cwd(),
  filenames: [".env", ".env.local"],
});

// 통합 테스트는 개발 DB가 아니라 전용 DB(altteulmap_test)에서만 돈다.
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/altteulmap_test";
const url = new URL(testDatabaseUrl);
const databaseName = url.pathname.replace(/^\/+/u, "");

if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
  throw new Error(
    `Test database must be local, received ${url.hostname}.`,
  );
}

if (!/^[a-z0-9_]+$/u.test(databaseName) || !databaseName.includes("test")) {
  throw new Error(
    `Refusing to prepare "${databaseName}": test database name must contain "test".`,
  );
}

const adminUrl = new URL(testDatabaseUrl);
adminUrl.pathname = "/postgres";
const admin = postgres(adminUrl.toString(), { max: 1, prepare: false });

try {
  const [existing] =
    await admin`select 1 as found from pg_database where datname = ${databaseName}`;

  if (!existing) {
    await admin.unsafe(`create database "${databaseName}"`);
    process.stdout.write(`[test-db] created ${databaseName}\n`);
  }
} finally {
  await admin.end({ timeout: 1 });
}

const env = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl,
  ALLOW_LOCAL_MIGRATION: "1",
};
delete env.PRODUCTION_DATABASE_URL;

for (const command of ["db:migrate", "db:seed"]) {
  const result = spawnSync("npm", ["run", command], {
    env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

process.stdout.write(`[test-db] ${databaseName} is ready\n`);
