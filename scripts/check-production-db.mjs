import process from "node:process";

import postgres from "postgres";

import { loadEnvFilesWithShellPrecedence } from "./lib/load-env-files.mjs";

loadEnvFilesWithShellPrecedence({
  cwd: process.cwd(),
  filenames: [".env", ".env.production", ".env.local", ".env.production.local"],
});

const MODERATION_TYPES = [
  "moderation_suggestion_action",
  "moderation_suggestion_status",
  "moderation_suggestion_subject_type",
];

function printLine(message = "") {
  process.stdout.write(`${message}\n`);
}

function printSection(title) {
  printLine();
  printLine(`[${title}]`);
}

function maskValue(value, visibleStart = 2, visibleEnd = 2) {
  if (!value) {
    return "<empty>";
  }

  if (value.length <= visibleStart + visibleEnd) {
    return `${value[0] ?? ""}***${value.at(-1) ?? ""}`;
  }

  return `${value.slice(0, visibleStart)}***${value.slice(-visibleEnd)}`;
}

function decodeIfNeeded(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseDatabaseUrl(rawUrl) {
  const match = rawUrl.match(
    /^(postgres(?:ql)?):\/\/([^:]+):(.+)@([^:/?#]+)(?::(\d+))?\/([^?#]+)(\?[^#]*)?$/,
  );

  if (!match) {
    throw new Error("DATABASE_URL format could not be parsed");
  }

  const [, scheme, rawUsername, rawPassword, host, rawPort, rawDatabase, search = ""] =
    match;

  return {
    scheme,
    username: decodeIfNeeded(rawUsername),
    password: decodeIfNeeded(rawPassword),
    host,
    port: rawPort ? Number(rawPort) : 5432,
    database: decodeIfNeeded(rawDatabase),
    search,
  };
}

function shouldUseSsl(host) {
  return !["127.0.0.1", "localhost", "::1"].includes(host);
}

function detectReservedCharacters(password) {
  const reserved = [" ", "@", ":", "/", "?", "#", "%", "&", "="];
  return reserved.filter((character) => password.includes(character));
}

function formatMigrationCreatedAt(value) {
  const timestamp =
    typeof value === "number"
      ? value
      : typeof value === "bigint"
        ? Number(value)
        : Number.parseInt(String(value), 10);

  if (!Number.isFinite(timestamp)) {
    return String(value);
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toISOString();
}

function buildClientOptions(connection) {
  return {
    host: connection.host,
    port: connection.port,
    database: connection.database,
    username: connection.username,
    password: connection.password,
    ssl: shouldUseSsl(connection.host) ? "require" : false,
    connect_timeout: 10,
    max: 1,
    prepare: false,
  };
}

async function readMigrationStatus(sql) {
  const drizzleTableRows = await sql`
    select exists (
      select 1
      from information_schema.tables
      where table_schema = 'drizzle'
        and table_name = '__drizzle_migrations'
    ) as exists
  `;

  if (!drizzleTableRows[0]?.exists) {
    return {
      hasDrizzleTable: false,
      latestMigrations: [],
    };
  }

  const latestMigrations = await sql`
    select hash, created_at
    from drizzle.__drizzle_migrations
    order by created_at desc
    limit 5
  `;

  return {
    hasDrizzleTable: true,
    latestMigrations,
  };
}

async function readApplicationTableCounts(sql) {
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

async function main() {
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl) {
    throw new Error("DATABASE_URL is missing");
  }

  const connection = parseDatabaseUrl(rawUrl);
  const reservedCharacters = detectReservedCharacters(connection.password);

  printSection("Connection summary");
  printLine(`host: ${connection.host}`);
  printLine(`port: ${connection.port}`);
  printLine(`database: ${connection.database}`);
  printLine(`username: ${connection.username}`);
  printLine(`password: ${maskValue(connection.password, 1, 1)} (length ${connection.password.length})`);
  printLine(
    reservedCharacters.length > 0
      ? `password has reserved characters: ${reservedCharacters.join(" ")}`
      : "password has no reserved URL characters",
  );
  printLine(
    shouldUseSsl(connection.host)
      ? "ssl: require"
      : "ssl: disabled for local host",
  );

  const sql = postgres(buildClientOptions(connection));

  try {
    const identityRows = await sql`
      select current_user as user, current_database() as db, version() as version
    `;
    const identity = identityRows[0];

    const moderationTableRows = await sql`
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'moderation_suggestions'
      ) as exists
    `;

    const moderationTypeRows = await sql`
      select typname
      from pg_type
      where typnamespace = 'public'::regnamespace
        and typname = any(${MODERATION_TYPES})
      order by typname asc
    `;
    const moderationTableRowsForData = await sql`
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'moderation_suggestions'
      ) as exists
    `;
    const invalidModerationRows = moderationTableRowsForData[0]?.exists
      ? await sql`
          select count(*)::int as invalid_rows
          from moderation_suggestions
          where confidence < 0
            or confidence > 100
            or char_length(summary) not between 1 and 2000
        `
      : [];
    const invalidModerationCount = Number(
      invalidModerationRows[0]?.invalid_rows ?? 0,
    );

    const migrationStatus = await readMigrationStatus(sql);
    const applicationTableCounts = await readApplicationTableCounts(sql);
    const priceTableRows = await sql`
      select
        to_regclass('public.price_reports') as reports,
        to_regclass('public.price_items') as items
    `;
    const hasPriceTables = Boolean(
      priceTableRows[0]?.reports && priceTableRows[0]?.items,
    );
    const invalidPriceRows = hasPriceTables
      ? await sql`
          select
            (select count(*)::int from price_reports where amount <= 0) as invalid_price_reports,
            (select count(*)::int from price_items where amount <= 0) as invalid_price_items
        `
      : [];
    const invalidPrices = invalidPriceRows[0] ?? {
      invalid_price_reports: 0,
      invalid_price_items: 0,
    };

    printSection("Connection result");
    printLine(`status: ok`);
    printLine(`current_user: ${identity.user}`);
    printLine(`current_database: ${identity.db}`);
    printLine(`server: ${identity.version.split(",")[0]}`);

    printSection("Schema status");
    printLine(
      `moderation_suggestions: ${moderationTableRows[0]?.exists ? "present" : "missing"}`,
    );
    printLine(
      `moderation enums: ${moderationTypeRows.length}/${MODERATION_TYPES.length} present`,
    );
    printLine(`invalid moderation suggestions: ${invalidModerationCount}`);
    printLine(
      `drizzle migrations table: ${migrationStatus.hasDrizzleTable ? "present" : "missing"}`,
    );
    printLine(
      `price tables: ${hasPriceTables ? "present" : "missing"}`,
    );
    printLine(
      `invalid price reports/items: ${invalidPrices.invalid_price_reports}/${invalidPrices.invalid_price_items}`,
    );
    printSection("Application row counts (read-only)");
    for (const table of applicationTableCounts) {
      printLine(`${table.table_name}: ${table.row_count}`);
    }

    if (migrationStatus.latestMigrations.length > 0) {
      printLine("latest migrations:");
      for (const migration of migrationStatus.latestMigrations) {
        printLine(
          `- ${maskValue(migration.hash, 6, 4)} @ ${formatMigrationCreatedAt(migration.created_at)}`,
        );
      }
    }

    if (
      moderationTableRows[0]?.exists &&
      moderationTypeRows.length === MODERATION_TYPES.length &&
      invalidModerationCount === 0 &&
      hasPriceTables &&
      Number(invalidPrices.invalid_price_reports) === 0 &&
      Number(invalidPrices.invalid_price_items) === 0
    ) {
      printSection("Conclusion");
      printLine("production DB connection and moderation schema look ready.");
      return;
    }

    printSection("Conclusion");
    printLine(
      "production DB connection works, but schema or price invariants are incomplete. Resolve the reported rows and apply the pending Drizzle migrations before live persistence validation.",
    );
    process.exitCode = 2;
  } catch (error) {
    const message = String(error.message ?? error);

    printSection("Connection result");
    printLine("status: failed");
    printLine(`message: ${message}`);

    printSection("Conclusion");

    if (message.includes("Tenant or user not found")) {
      printLine(
        "current DATABASE_URL is stale or wrong. URL encoding is not the blocker; update the actual production credential source first.",
      );
    } else if (message.includes("ENOTFOUND")) {
      printLine("database host could not be resolved. Check the host or network policy.");
    } else if (message.includes("password authentication failed")) {
      printLine("database user exists, but the password is wrong.");
    } else {
      printLine("database connection failed. Re-check runtime secret values and SSL/network policy.");
    }

    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
