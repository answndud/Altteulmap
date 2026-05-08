import process from "node:process";

import postgres from "postgres";

import { loadEnvFilesWithShellPrecedence } from "./lib/load-env-files.mjs";

loadEnvFilesWithShellPrecedence({
  cwd: process.cwd(),
  filenames: [".env", ".env.local", ".env.production", ".env.production.local"],
});

const rawUrl = process.env.PRODUCTION_DATABASE_URL ?? process.env.DATABASE_URL;
const query = process.env.SEARCH_ANALYZE_QUERY ?? "김밥";
const runAnalyze = process.env.SEARCH_ANALYZE_EXECUTE === "1";
const timeoutSeconds = Number(process.env.SEARCH_ANALYZE_TIMEOUT_SECONDS ?? 10);

if (!rawUrl) {
  throw new Error("PRODUCTION_DATABASE_URL or DATABASE_URL is required.");
}

const searchExpression = `
  coalesce(name, '') || ' ' ||
  coalesce(business_name, '') || ' ' ||
  coalesce(road_address, '') || ' ' ||
  coalesce(district, '') || ' ' ||
  coalesce(representative_price_label, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(note, '')
`;
const explainMode = runAnalyze ? "ANALYZE, BUFFERS, " : "";
const pattern = `%${query.trim()}%`;
const sql = postgres(rawUrl, {
  max: 1,
  prepare: false,
  connect_timeout: timeoutSeconds,
  idle_timeout: 5,
  max_lifetime: 60,
});

function collectPlanNodes(node, nodes = []) {
  if (!node || typeof node !== "object") {
    return nodes;
  }

  nodes.push({
    nodeType: node["Node Type"],
    relationName: node["Relation Name"] ?? null,
    indexName: node["Index Name"] ?? null,
    startupCost: node["Startup Cost"] ?? null,
    totalCost: node["Total Cost"] ?? null,
    planRows: node["Plan Rows"] ?? null,
    actualRows: node["Actual Rows"] ?? null,
    actualTotalTime: node["Actual Total Time"] ?? null,
  });

  for (const child of node.Plans ?? []) {
    collectPlanNodes(child, nodes);
  }

  return nodes;
}

async function main() {
  const [countResult, sampleResult, explainResult, extensionResult] = await Promise.all([
    sql`
      select count(*)::int as count
      from places
      where
        status = 'active'
        and latitude is not null
        and longitude is not null
        and (
          name ilike ${pattern}
          or business_name ilike ${pattern}
          or road_address ilike ${pattern}
          or district ilike ${pattern}
          or representative_price_label ilike ${pattern}
          or description ilike ${pattern}
          or note ilike ${pattern}
        )
    `,
    sql`
      select id, name, road_address, representative_price_label
      from places
      where
        status = 'active'
        and latitude is not null
        and longitude is not null
        and (${sql.unsafe(searchExpression)}) ilike ${pattern}
      order by representative_price_amount asc nulls last, updated_at desc
      limit 5
    `,
    Promise.all([
      sql.unsafe(
        `
          explain (${explainMode}FORMAT JSON)
          select id, name
          from places
          where
            status = 'active'
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
          limit 120
        `,
        [pattern],
      ),
      sql.unsafe(
        `
          explain (${explainMode}FORMAT JSON)
          select id, name
          from places
          where
            status = 'active'
            and latitude is not null
            and longitude is not null
            and (${searchExpression}) ilike $1
          order by representative_price_amount asc nulls last, updated_at desc
          limit 120
        `,
        [pattern],
      ),
    ]),
    sql`
      select exists (
        select 1
        from pg_extension
        where extname = 'pg_trgm'
      ) as installed
    `,
  ]);

  const currentOrPlanPayload = explainResult[0]?.[0]?.["QUERY PLAN"]?.[0] ?? {};
  const expressionPlanPayload = explainResult[1]?.[0]?.["QUERY PLAN"]?.[0] ?? {};
  const currentOrPlan = currentOrPlanPayload.Plan ?? null;
  const expressionPlan = expressionPlanPayload.Plan ?? null;

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        query,
        pattern,
        executedAnalyze: runAnalyze,
        pgTrgmInstalled: Boolean(extensionResult[0]?.installed),
        count: Number(countResult[0]?.count ?? 0),
        samples: sampleResult.map((row) => ({
          id: row.id,
          name: row.name,
          representativePriceLabel: row.representative_price_label,
          roadAddress: row.road_address,
        })),
        plans: {
          currentOrQuery: {
            planningTimeMs: currentOrPlanPayload["Planning Time"] ?? null,
            executionTimeMs: currentOrPlanPayload["Execution Time"] ?? null,
            nodes: collectPlanNodes(currentOrPlan),
          },
          proposedExpressionQuery: {
            planningTimeMs: expressionPlanPayload["Planning Time"] ?? null,
            executionTimeMs: expressionPlanPayload["Execution Time"] ?? null,
            nodes: collectPlanNodes(expressionPlan),
          },
        },
      },
      null,
      2,
    )}\n`,
  );
}

main()
  .catch((error) => {
    process.stderr.write(
      `Global search analysis failed: ${
        error instanceof Error ? error.message : String(error)
      }\n`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 1 }).catch(() => undefined);
  });
