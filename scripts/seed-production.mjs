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

function isLoopbackHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

// 운영 DB가 공개 포트 없이 VPS 안에만 있을 때는 SSH 터널(loopback)로 접속한다.
// loopback이어도 운영 대상임을 명시해야 하며, 터널 구간은 SSH가 암호화하므로 DB TLS는 쓰지 않는다.
function isTunneledProduction() {
  return process.env.PRODUCTION_VIA_SSH_TUNNEL === "1";
}

function assertProductionDatabaseUrl(rawUrl) {
  if (!rawUrl) {
    throw new Error("DATABASE_URL is missing");
  }

  const url = new URL(rawUrl);

  if (isLoopbackHost(url.hostname) && !isTunneledProduction()) {
    throw new Error(
      "Refusing to run production seed against a local database. If this is an SSH tunnel to the production VPS, set PRODUCTION_VIA_SSH_TUNNEL=1.",
    );
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
    ssl: isTunneledProduction() ? false : "require",
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
  if (process.env.PRODUCTION_SEED_CONFIRM !== "I_UNDERSTAND_DESTRUCTIVE_SEED") {
    throw new Error(
      "Set PRODUCTION_SEED_CONFIRM=I_UNDERSTAND_DESTRUCTIVE_SEED only after reviewing the empty-database preflight and backup state.",
    );
  }

  await assertDatabaseIsEmpty();

  const result = spawnSync("npx", ["tsx", "src/db/seed.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      USE_MOCK_DATA: "false",
      ALLOW_NONLOCAL_SEED: "1",
      PRODUCTION_SEED_CONFIRM: "I_UNDERSTAND_DESTRUCTIVE_SEED",
    },
    stdio: "inherit",
  });

  process.exit(result.status ?? 1);
}

main().catch((error) => {
  console.error(`[seed-production] ${error.message}`);
  process.exitCode = 1;
});
