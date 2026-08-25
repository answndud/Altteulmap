import process from "node:process";

import postgres from "postgres";

import { loadEnvFilesWithShellPrecedence } from "./lib/load-env-files.mjs";

loadEnvFilesWithShellPrecedence({
  cwd: process.cwd(),
  filenames: [".env", ".env.local", ".env.production", ".env.production.local"],
});

const rawUrl = process.env.BENCHMARK_DATABASE_URL ?? process.env.DATABASE_URL;
const iterations = Number(process.env.BENCHMARK_ITERATIONS ?? 10);
const warmups = Number(process.env.BENCHMARK_WARMUPS ?? 2);
const queryTimeoutMs = Number(process.env.BENCHMARK_QUERY_TIMEOUT_MS ?? 4_500);
const searchPattern = `%${(process.env.BENCHMARK_QUERY ?? "김밥").trim()}%`;

if (!rawUrl) {
  throw new Error("BENCHMARK_DATABASE_URL or DATABASE_URL is required.");
}

if (!Number.isInteger(iterations) || iterations < 1 || iterations > 100) {
  throw new Error("BENCHMARK_ITERATIONS must be an integer between 1 and 100.");
}

const sql = postgres(rawUrl, {
  max: 1,
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 5,
  max_lifetime: 60,
  connection: {
    application_name: "altteulmap-search-benchmark",
    statement_timeout: queryTimeoutMs,
    lock_timeout: 2_000,
  },
});

const scenarios = [
  {
    name: "map_viewport",
    query: `
      select id, name, latitude, longitude, representative_price_amount
      from places
      where status = 'active'
        and latitude between 37.42 and 37.70
        and longitude between 126.76 and 127.18
      order by latitude asc, longitude asc, id asc
      limit 2001
    `,
    params: [],
  },
  {
    name: "global_search",
    query: `
      select id, name, road_address, representative_price_label
      from places
      where status = 'active'
        and latitude is not null
        and longitude is not null
        and (
          name ilike $1
          or business_name ilike $1
          or road_address ilike $1
          or district ilike $1
          or representative_price_label ilike $1
          or description ilike $1
          or note ilike $1
        )
      order by representative_price_amount asc nulls last, updated_at desc
      limit 2001
    `,
    params: [searchPattern],
  },
  {
    name: "admin_pending_places",
    query: `
      select id, name, status, created_at
      from places
      where status = 'pending_review'
      order by created_at desc, id desc
      limit 101
    `,
    params: [],
  },
  {
    name: "admin_open_reports",
    query: `
      select id, target_type, target_id, status, created_at
      from content_reports
      where status = 'open'
      order by created_at desc, id desc
      limit 101
    `,
    params: [],
  },
];

function percentile(values, rank) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * rank) - 1);
  return Math.round(sorted[index] ?? 0);
}

function collectPlanMetrics(node, metrics = { rowsRead: 0, sharedReadBlocks: 0 }) {
  if (!node || typeof node !== "object") {
    return metrics;
  }

  metrics.rowsRead += Number(node["Actual Rows"] ?? 0) * Number(node["Actual Loops"] ?? 1);
  metrics.sharedReadBlocks += Number(node["Shared Read Blocks"] ?? 0);

  for (const child of node.Plans ?? []) {
    collectPlanMetrics(child, metrics);
  }

  return metrics;
}

async function readDatasetSize() {
  const rows = await sql`
    select
      count(*)::bigint as places,
      count(*) filter (where status = 'active')::bigint as active_places,
      (select count(*)::bigint from content_reports) as content_reports
    from places
  `;

  return Object.fromEntries(
    Object.entries(rows[0] ?? {}).map(([key, value]) => [key, Number(value)]),
  );
}

async function explain(scenario) {
  const result = await sql.unsafe(
    `explain (analyze, buffers, format json) ${scenario.query}`,
    scenario.params,
  );
  const payload = result[0]?.["QUERY PLAN"]?.[0] ?? {};

  return {
    executionTimeMs: Number(payload["Execution Time"] ?? 0),
    planningTimeMs: Number(payload["Planning Time"] ?? 0),
    ...collectPlanMetrics(payload.Plan),
  };
}

async function measure(scenario) {
  const durations = [];
  let payloadBytes = 0;
  let returnedRows = 0;

  for (let index = 0; index < warmups + iterations; index += 1) {
    const started = performance.now();
    const rows = await sql.unsafe(scenario.query, scenario.params);
    const durationMs = performance.now() - started;

    if (index >= warmups) {
      durations.push(durationMs);
      payloadBytes = Buffer.byteLength(JSON.stringify(rows));
      returnedRows = rows.length;
    }
  }

  const plan = await explain(scenario);

  return {
    name: scenario.name,
    returnedRows,
    payloadBytes,
    minMs: Math.round(Math.min(...durations)),
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    p99Ms: percentile(durations, 0.99),
    maxMs: Math.round(Math.max(...durations)),
    plan,
  };
}

async function main() {
  const dataset = await readDatasetSize();
  const results = [];

  for (const scenario of scenarios) {
    results.push(await measure(scenario));
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        result: "ok",
        generatedAt: new Date().toISOString(),
        dataset,
        iterations,
        warmups,
        queryTimeoutMs,
        targets: {
          p95Ms: 500,
          p99Ms: 800,
          maxRowsRead: 10_000,
          maxPayloadBytes: 512 * 1024,
        },
        results,
      },
      null,
      2,
    )}\n`,
  );
}

main()
  .catch((error) => {
    process.stderr.write(`Search benchmark failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 1 }).catch(() => undefined);
  });
