import process from "node:process";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { loadEnvFilesWithShellPrecedence } from "./lib/load-env-files.mjs";

loadEnvFilesWithShellPrecedence({
  cwd: process.cwd(),
  filenames: [".env", ".env.local", ".env.production", ".env.production.local"],
});

function printLine(message = "") {
  process.stdout.write(`${message}\n`);
}

function getDatabaseUrl() {
  return process.env.PRODUCTION_DATABASE_URL ?? process.env.DATABASE_URL;
}

function parseDatabaseUrl(rawUrl) {
  const url = new URL(rawUrl);

  return {
    rawUrl,
    host: url.hostname,
    port: url.port || "5432",
    database: url.pathname.replace(/^\/+/u, ""),
    username: decodeURIComponent(url.username),
  };
}

function isLocalDatabase(host) {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

async function main() {
  const rawUrl = getDatabaseUrl();

  if (!rawUrl) {
    throw new Error(
      "PRODUCTION_DATABASE_URL or DATABASE_URL is required to run migrations.",
    );
  }

  const connection = parseDatabaseUrl(rawUrl);

  if (
    isLocalDatabase(connection.host) &&
    process.env.ALLOW_LOCAL_MIGRATION !== "1"
  ) {
    throw new Error(
      "Refusing to run production migration against a local database. Set ALLOW_LOCAL_MIGRATION=1 only for local testing.",
    );
  }

  printLine("[migration]");
  printLine(`host: ${connection.host}`);
  printLine(`port: ${connection.port}`);
  printLine(`database: ${connection.database}`);
  printLine(`username: ${connection.username}`);
  printLine("folder: drizzle");

  const client = postgres(connection.rawUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 5,
    max_lifetime: 60,
  });
  const db = drizzle(client);

  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    printLine("status: ok");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
