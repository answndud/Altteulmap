import process from "node:process";

import postgres from "postgres";

import { loadEnvFilesWithShellPrecedence } from "./lib/load-env-files.mjs";

loadEnvFilesWithShellPrecedence({
  cwd: process.cwd(),
  filenames: [".env", ".env.local", ".env.production", ".env.production.local"],
});

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const url = new URL(databaseUrl);
const sql = postgres(databaseUrl, {
  ssl: ["127.0.0.1", "localhost", "::1"].includes(url.hostname)
    ? false
    : "require",
  max: 1,
  prepare: false,
  connect_timeout: 10,
});

try {
  const candidates = await sql`
    SELECT
      l.id AS left_id,
      l.slug AS left_slug,
      l.name AS left_name,
      l.road_address AS left_address,
      l.source_provider AS left_source,
      r.id AS right_id,
      r.slug AS right_slug,
      r.name AS right_name,
      r.road_address AS right_address,
      r.source_provider AS right_source,
      CASE
        WHEN lower(regexp_replace(l.name, '\\s+', '', 'g')) = lower(regexp_replace(r.name, '\\s+', '', 'g'))
          THEN 'name'
        WHEN l.road_address = r.road_address
          THEN 'address'
        ELSE 'nearby'
      END AS match_reason
    FROM places AS l
    JOIN places AS r
      ON l.id < r.id
      AND l.status = 'active'
      AND r.status = 'active'
      AND (
        lower(regexp_replace(l.name, '\\s+', '', 'g')) = lower(regexp_replace(r.name, '\\s+', '', 'g'))
        OR l.road_address = r.road_address
        OR (
          l.latitude IS NOT NULL
          AND l.longitude IS NOT NULL
          AND r.latitude IS NOT NULL
          AND r.longitude IS NOT NULL
          AND abs(l.latitude - r.latitude) < 0.001
          AND abs(l.longitude - r.longitude) < 0.001
          AND lower(regexp_replace(l.name, '\\s+', '', 'g')) LIKE lower(regexp_replace(r.name, '\\s+', '', 'g'))
        )
      )
    ORDER BY match_reason, l.created_at DESC
    LIMIT 100
  `;

  process.stdout.write(
    `${JSON.stringify(
      {
        source: "database",
        count: candidates.length,
        candidates,
        nextAction: "Review candidates before any merge mutation; this command is read-only.",
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await sql.end({ timeout: 5 });
}
