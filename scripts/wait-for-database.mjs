import process from "node:process";

import postgres from "postgres";

import { loadEnvFilesWithShellPrecedence } from "./lib/load-env-files.mjs";

loadEnvFilesWithShellPrecedence({
  cwd: process.cwd(),
  filenames: [".env", ".env.local"],
});

const databaseUrl = process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/altteulmap";
const timeoutMs = Number(process.env.DB_READY_TIMEOUT_MS ?? 30_000);
const intervalMs = Number(process.env.DB_READY_INTERVAL_MS ?? 500);
const deadline = Date.now() + (Number.isFinite(timeoutMs) ? timeoutMs : 30_000);

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function describeDatabaseUrl(rawUrl) {
  const url = new URL(rawUrl);

  return `${url.hostname}:${url.port || "5432"}/${url.pathname.replace(/^\/+/, "")}`;
}

async function checkDatabase() {
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
}

async function main() {
  const target = describeDatabaseUrl(databaseUrl);
  process.stdout.write(`[db-ready] waiting for ${target}\n`);

  while (Date.now() < deadline) {
    try {
      await checkDatabase();
      process.stdout.write(`[db-ready] ready: ${target}\n`);
      return;
    } catch {
      await wait(Math.max(100, Number.isFinite(intervalMs) ? intervalMs : 500));
    }
  }

  throw new Error(
    `[db-ready] timed out after ${timeoutMs}ms for ${target}. Start PostgreSQL with 'npm run db:local:up' and inspect 'docker compose ps'.`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
