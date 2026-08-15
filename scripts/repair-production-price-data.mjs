import process from "node:process";
import postgres from "postgres";

import { loadEnvFilesWithShellPrecedence } from "./lib/load-env-files.mjs";

loadEnvFilesWithShellPrecedence({
  cwd: process.cwd(),
  filenames: [".env", ".env.local", ".env.production", ".env.production.local"],
});

function getDatabaseUrl() {
  return process.env.PRODUCTION_DATABASE_URL ?? process.env.DATABASE_URL;
}

function assertProductionDatabase(rawUrl) {
  const url = new URL(rawUrl);

  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error(
      "Refusing to repair a local database. Set an explicit production database URL.",
    );
  }
}

async function main() {
  const rawUrl = getDatabaseUrl();

  if (!rawUrl) {
    throw new Error("PRODUCTION_DATABASE_URL or DATABASE_URL is required.");
  }

  assertProductionDatabase(rawUrl);

  const shouldApply = process.argv.includes("--apply");
  const client = postgres(rawUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 5,
    max_lifetime: 60,
  });

  try {
    const [counts] = await client`
      select
        (select count(*)::int from price_reports where amount <= 0) as invalid_reports,
        (select count(*)::int from price_items where amount <= 0) as invalid_items
    `;
    const invalidReports = Number(counts.invalid_reports ?? 0);
    const invalidItems = Number(counts.invalid_items ?? 0);

    console.log(
      JSON.stringify({
        invalidReports,
        invalidItems,
        mode: shouldApply ? "apply" : "dry-run",
      }),
    );

    if (!shouldApply || (invalidReports === 0 && invalidItems === 0)) {
      return;
    }

    await client.begin(async (transaction) => {
      await transaction`delete from price_reports where amount <= 0`;
      await transaction`delete from price_items where amount <= 0`;
    });

    console.log("Removed invalid non-positive price records in one transaction.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
