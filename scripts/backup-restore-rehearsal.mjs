import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import process from "node:process";
import { once } from "node:events";

import postgres from "postgres";

import { loadEnvFilesWithShellPrecedence } from "./lib/load-env-files.mjs";

loadEnvFilesWithShellPrecedence({
  cwd: process.cwd(),
  filenames: [".env", ".env.local", ".env.production", ".env.production.local"],
});

const CONFIRMATION = "I_UNDERSTAND_RESTORE_REHEARSAL";
const CORE_TABLES = [
  "users",
  "places",
  "price_items",
  "price_reports",
  "content_reports",
  "admin_actions",
];

function printLine(message = "") {
  process.stdout.write(`${message}\n`);
}

function parseConnection(raw, label) {
  let url;

  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} must be a valid PostgreSQL URL.`);
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error(`${label} must use the PostgreSQL protocol.`);
  }

  return {
    identity: `${url.hostname}:${url.port || "5432"}/${url.pathname.replace(/^\//u, "")}`,
    host: url.hostname,
    port: url.port || "5432",
    database: decodeURIComponent(url.pathname.replace(/^\//u, "")),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: !["localhost", "127.0.0.1", "::1"].includes(url.hostname),
  };
}

function clientOptions(connection) {
  return {
    host: connection.host,
    port: Number(connection.port),
    database: connection.database,
    username: connection.username,
    password: connection.password,
    ssl: connection.ssl ? "require" : false,
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 5,
    max_lifetime: 60,
  };
}

function commandOptions(connection) {
  return {
    env: {
      ...process.env,
      PGPASSWORD: connection.password,
      PGSSLMODE: connection.ssl ? "require" : "disable",
    },
  };
}

async function runCommand(command, args, options) {
  const child = spawn(command, args, {
    ...options,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const [exitCode] = await once(child, "close");

  if (exitCode !== 0) {
    throw new Error(`${command} failed with exit code ${exitCode}: ${stderr.trim().slice(0, 500)}`);
  }
}

async function readSnapshot(connection) {
  const sql = postgres(clientOptions(connection));

  try {
    const rows = await sql`
      select table_name, row_count
      from (
        ${sql.join(
          CORE_TABLES.map(
            (tableName) => sql.unsafe(`select '${tableName}' as table_name, count(*)::bigint as row_count from "${tableName}"`),
          ),
          sql` union all `,
        )}
      ) counts
      order by table_name asc
    `;
    const invariants = await sql`
      select
        (select count(*) from bookmarks) as bookmark_count,
        (select count(*) from place_categories) as place_category_count,
        (select count(*) from price_reports where amount <= 0) as invalid_price_reports,
        (select count(*) from price_items where amount <= 0) as invalid_price_items
    `;

    return {
      tables: Object.fromEntries(rows.map((row) => [row.table_name, Number(row.row_count)])),
      invariants: Object.fromEntries(
        Object.entries(invariants[0] ?? {}).map(([key, value]) => [key, Number(value)]),
      ),
    };
  } finally {
    await sql.end();
  }
}

function assertSnapshot(snapshot, label) {
  for (const [key, value] of Object.entries(snapshot.invariants)) {
    if (key.startsWith("invalid_") && value !== 0) {
      throw new Error(`${label} invariant ${key}=${value}`);
    }
  }
}

async function main() {
  if (process.env.BACKUP_REHEARSAL_CONFIRM !== CONFIRMATION) {
    throw new Error(
      `Refusing backup/restore rehearsal. Set BACKUP_REHEARSAL_CONFIRM=${CONFIRMATION} explicitly.`,
    );
  }

  const sourceRaw = process.env.BACKUP_SOURCE_DATABASE_URL ?? process.env.PRODUCTION_DATABASE_URL;
  const restoreRaw = process.env.BACKUP_RESTORE_DATABASE_URL;
  const artifactDir = process.env.BACKUP_ARTIFACT_DIR ?? "artifacts/backup-rehearsal";

  if (!sourceRaw || !restoreRaw) {
    throw new Error("BACKUP_SOURCE_DATABASE_URL and BACKUP_RESTORE_DATABASE_URL are required.");
  }

  const source = parseConnection(sourceRaw, "BACKUP_SOURCE_DATABASE_URL");
  const restore = parseConnection(restoreRaw, "BACKUP_RESTORE_DATABASE_URL");

  if (source.identity === restore.identity) {
    throw new Error("Refusing rehearsal: source and restore database are identical.");
  }

  await mkdir(artifactDir, { recursive: true });
  const backupFile = `${artifactDir}/backup.dump`;
  const sourceSnapshot = await readSnapshot(source);
  assertSnapshot(sourceSnapshot, "source");

  await runCommand(
    "pg_dump",
    [
      "--format=custom",
      "--no-owner",
      "--no-acl",
      "--file",
      backupFile,
      "--host",
      source.host,
      "--port",
      source.port,
      "--username",
      source.username,
      "--dbname",
      source.database,
    ],
    commandOptions(source),
  );

  const backupStats = await stat(backupFile);
  const backupHash = createHash("sha256").update(await readFile(backupFile)).digest("hex");

  await runCommand(
    "pg_restore",
    [
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-acl",
      "--exit-on-error",
      "--host",
      restore.host,
      "--port",
      restore.port,
      "--username",
      restore.username,
      "--dbname",
      restore.database,
      backupFile,
    ],
    commandOptions(restore),
  );

  const restoredSnapshot = await readSnapshot(restore);
  assertSnapshot(restoredSnapshot, "restore");

  for (const table of CORE_TABLES) {
    if (sourceSnapshot.tables[table] !== restoredSnapshot.tables[table]) {
      throw new Error(
        `Restore row-count mismatch for ${table}: source=${sourceSnapshot.tables[table]} restore=${restoredSnapshot.tables[table]}`,
      );
    }
  }

  const evidence = {
    generatedAt: new Date().toISOString(),
    source: source.identity,
    restore: restore.identity,
    backup: {
      file: backupFile,
      bytes: backupStats.size,
      sha256: backupHash,
    },
    sourceSnapshot,
    restoredSnapshot,
    result: "passed",
  };

  await writeFile(`${artifactDir}/evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  printLine(JSON.stringify({ ...evidence, backup: { ...evidence.backup, file: backupFile } }, null, 2));
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
