import process from "node:process";

import postgres from "postgres";

import { loadEnvFilesWithShellPrecedence } from "./lib/load-env-files.mjs";

loadEnvFilesWithShellPrecedence({
  cwd: process.cwd(),
  filenames: [".env", ".env.local"],
});

const rawUrl = process.env.DATABASE_URL;

if (!rawUrl) {
  throw new Error("DATABASE_URL is required.");
}

const url = new URL(rawUrl);

if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
  throw new Error(`Database contract checks require a local PostgreSQL database, received ${url.hostname}.`);
}

const sql = postgres(rawUrl, {
  max: 1,
  prepare: false,
  connect_timeout: 5,
  connection: {
    application_name: "altteulmap-contract-check",
    statement_timeout: 4_500,
    lock_timeout: 2_000,
    idle_in_transaction_session_timeout: 5_000,
  },
});

const REQUIRED_TABLES = ["places", "price_items", "price_reports", "bookmarks", "content_reports"];
const REQUIRED_CONSTRAINTS = [
  "places_latitude_range_check",
  "places_longitude_range_check",
  "price_items_amount_positive_check",
  "price_items_verified_count_nonnegative_check",
  "price_reports_amount_positive_check",
  "bookmarks_pk",
  "price_reports_submission_key_unique",
];

function parseMilliseconds(value) {
  const match = String(value).match(/^(\d+(?:\.\d+)?)(ms|s|min|h)$/u);
  const multipliers = { ms: 1, s: 1_000, min: 60_000, h: 3_600_000 };
  return match ? Number(match[1]) * multipliers[match[2]] : null;
}

async function main() {
  const [tables, constraints, indexes, settings, invalidRows] = await Promise.all([
    sql`select table_name from information_schema.tables where table_schema = 'public' and table_name = any(${REQUIRED_TABLES}) order by table_name`,
    sql`select conname from pg_constraint where connamespace = 'public'::regnamespace and conname = any(${REQUIRED_CONSTRAINTS}) order by conname`,
    sql`select indexname from pg_indexes where schemaname = 'public' and indexname = any(${REQUIRED_CONSTRAINTS}) order by indexname`,
    sql`select name, setting, unit from pg_settings where name = any(${["statement_timeout", "lock_timeout", "idle_in_transaction_session_timeout"]})`,
    sql`select (select count(*) from price_items where amount <= 0) as invalid_price_items, (select count(*) from price_reports where amount <= 0) as invalid_price_reports, (select count(*) from places where latitude < -90 or latitude > 90 or longitude < -180 or longitude > 180) as invalid_coordinates`,
  ]);
  const tableNames = new Set(tables.map((row) => row.table_name));
  const constraintNames = new Set(constraints.map((row) => row.conname));
  const indexNames = new Set(indexes.map((row) => row.indexname));
  const missingTables = REQUIRED_TABLES.filter((tableName) => !tableNames.has(tableName));
  const missingConstraints = REQUIRED_CONSTRAINTS.filter((constraintName) => !constraintNames.has(constraintName));
  const missingContracts = missingConstraints.filter((name) => !indexNames.has(name));
  const timeoutValues = Object.fromEntries(settings.map((row) => [row.name, `${row.setting}${row.unit ?? ""}`]));
  const minimumTimeouts = { statement_timeout: 4_500, lock_timeout: 2_000, idle_in_transaction_session_timeout: 5_000 };

  for (const [name, minimum] of Object.entries(minimumTimeouts)) {
    if ((parseMilliseconds(timeoutValues[name]) ?? 0) < minimum) {
      throw new Error(`${name} is not bounded as expected: ${timeoutValues[name] ?? "missing"}`);
    }
  }

  const invalid = invalidRows[0] ?? {};
  if (missingTables.length || missingContracts.length || Object.values(invalid).some(Number)) {
    throw new Error(JSON.stringify({ missingTables, missingContracts, invalid }));
  }

  process.stdout.write(`${JSON.stringify({ result: "passed", tables: [...tableNames].sort(), constraints: [...new Set([...constraintNames, ...indexNames])].sort(), timeouts: timeoutValues, invalid }, null, 2)}\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`Database contract check failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 1 }).catch(() => undefined);
  });
