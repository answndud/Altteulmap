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

async function assertExistingPriceDataIsValid(client) {
  const tables = await client`
    SELECT
      to_regclass('public.price_reports') AS reports,
      to_regclass('public.price_items') AS items
  `;

  if (!tables[0]?.reports || !tables[0]?.items) {
    return;
  }

  const invalidRows = await client`
    SELECT
      (SELECT count(*)::int FROM price_reports WHERE amount <= 0) AS invalid_reports,
      (SELECT count(*)::int FROM price_items WHERE amount <= 0) AS invalid_items
  `;
  const invalidReports = invalidRows[0]?.invalid_reports ?? 0;
  const invalidItems = invalidRows[0]?.invalid_items ?? 0;

  if (invalidReports > 0 || invalidItems > 0) {
    throw new Error(
      `Refusing migration: existing price data violates positive amount constraints (price_reports=${invalidReports}, price_items=${invalidItems}). Resolve these rows and run scripts/check-production-db.mjs before retrying.`,
    );
  }
}

async function assertExistingModerationDataIsValid(client) {
  const tables = await client`
    SELECT to_regclass('public.moderation_suggestions') AS suggestions
  `;

  if (!tables[0]?.suggestions) {
    return;
  }

  const invalidRows = await client`
    SELECT count(*)::int AS invalid_rows
    FROM moderation_suggestions
    WHERE confidence < 0
      OR confidence > 100
      OR char_length(summary) NOT BETWEEN 1 AND 2000
  `;
  const invalidRowsCount = invalidRows[0]?.invalid_rows ?? 0;

  if (invalidRowsCount > 0) {
    throw new Error(
      `Refusing migration: ${invalidRowsCount} moderation suggestions violate confidence or summary constraints. Review them before retrying.`,
    );
  }
}

async function assertMigrationHistoryIsConsistent(client) {
  const rows = await client`
    SELECT
      to_regclass('public.places') AS places,
      to_regclass('drizzle.__drizzle_migrations') AS migrations
  `;
  const hasApplicationSchema = Boolean(rows[0]?.places);
  const hasMigrationHistory = Boolean(rows[0]?.migrations);

  if (hasApplicationSchema && !hasMigrationHistory) {
    throw new Error(
      "Refusing migration: application tables exist but drizzle.__drizzle_migrations is missing. Restore migration history or use an explicit schema reconciliation procedure; do not run db:push against production.",
    );
  }
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
    await assertMigrationHistoryIsConsistent(client);
    await assertExistingPriceDataIsValid(client);
    await assertExistingModerationDataIsValid(client);
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
