import process from "node:process";

import postgres from "postgres";

import { loadEnvFilesWithShellPrecedence } from "../../scripts/lib/load-env-files.mjs";

loadEnvFilesWithShellPrecedence({
  cwd: process.cwd(),
  filenames: [".env", ".env.local"],
});

export function getTestDatabaseUrl() {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/altteulmap";
  const url = new URL(databaseUrl);

  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error(
      `Integration tests require a local PostgreSQL database, received ${url.hostname}. Set TEST_DATABASE_URL to a Docker database URL.`,
    );
  }

  return databaseUrl;
}

export async function assertTestDatabaseReady() {
  const databaseUrl = getTestDatabaseUrl();
  const client = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 2,
    idle_timeout: 2,
  });

  try {
    await client`select 1`;
  } finally {
    await client.end({ timeout: 1 }).catch(() => undefined);
  }

  return databaseUrl;
}
