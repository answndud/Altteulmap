import { spawnSync } from "node:child_process";
import process from "node:process";

import postgres from "postgres";

import { loadEnvFilesWithShellPrecedence } from "./lib/load-env-files.mjs";

loadEnvFilesWithShellPrecedence({
  cwd: process.cwd(),
  filenames: [".env", ".env.production", ".env.local", ".env.production.local"],
});

const APP_TABLES = [
  "admin_actions",
  "auth_accounts",
  "auth_sessions",
  "auth_verification_tokens",
  "bookmarks",
  "categories",
  "comments",
  "content_reports",
  "moderation_suggestions",
  "place_categories",
  "place_reactions",
  "places",
  "price_items",
  "price_reports",
  "users",
  "visit_activity",
];

function printLine(message = "") {
  process.stdout.write(`${message}\n`);
}

function assertProductionDatabaseUrl(rawUrl) {
  if (!rawUrl) {
    throw new Error("DATABASE_URL is missing");
  }

  const url = new URL(rawUrl);

  if (
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1"
  ) {
    throw new Error("Refusing to run production seed against a local database");
  }

  return url;
}

async function readTableCounts(sql) {
  return sql`
    select table_name, row_count
    from (
      select 'admin_actions' as table_name, count(*)::int as row_count from admin_actions
      union all select 'auth_accounts', count(*)::int from auth_accounts
      union all select 'auth_sessions', count(*)::int from auth_sessions
      union all select 'auth_verification_tokens', count(*)::int from auth_verification_tokens
      union all select 'bookmarks', count(*)::int from bookmarks
      union all select 'categories', count(*)::int from categories
      union all select 'comments', count(*)::int from comments
      union all select 'content_reports', count(*)::int from content_reports
      union all select 'moderation_suggestions', count(*)::int from moderation_suggestions
      union all select 'place_categories', count(*)::int from place_categories
      union all select 'place_reactions', count(*)::int from place_reactions
      union all select 'places', count(*)::int from places
      union all select 'price_items', count(*)::int from price_items
      union all select 'price_reports', count(*)::int from price_reports
      union all select 'users', count(*)::int from users
      union all select 'visit_activity', count(*)::int from visit_activity
    ) counts
    order by table_name asc
  `;
}

async function assertDatabaseIsEmpty() {
  const databaseUrl = process.env.DATABASE_URL;
  const url = assertProductionDatabaseUrl(databaseUrl);
  const sql = postgres(databaseUrl, {
    ssl: "require",
    max: 1,
    prepare: false,
    connect_timeout: 10,
  });

  try {
    printLine(`[seed-production] target host: ${url.host}`);
    const tableCounts = await readTableCounts(sql);
    const countByTable = new Map(
      tableCounts.map((row) => [row.table_name, row.row_count]),
    );
    const missingTables = APP_TABLES.filter(
      (tableName) => !countByTable.has(tableName),
    );
    const nonEmptyTables = tableCounts.filter((row) => row.row_count > 0);

    if (missingTables.length > 0) {
      throw new Error(`Missing application tables: ${missingTables.join(", ")}`);
    }

    if (nonEmptyTables.length > 0) {
      const summary = nonEmptyTables
        .map((row) => `${row.table_name}=${row.row_count}`)
        .join(", ");

      throw new Error(
        `Refusing to run destructive production seed because tables are not empty: ${summary}`,
      );
    }

    printLine("[seed-production] application tables are empty; running seed.");
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

async function main() {
  await assertDatabaseIsEmpty();

  const result = spawnSync("npx", ["tsx", "src/db/seed.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      USE_MOCK_DATA: "false",
    },
    stdio: "inherit",
  });

  process.exit(result.status ?? 1);
}

main().catch((error) => {
  console.error(`[seed-production] ${error.message}`);
  process.exitCode = 1;
});
