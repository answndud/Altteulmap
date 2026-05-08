import "dotenv/config";

import { and, eq, sql as drizzleSql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  adminActions,
  places,
  priceItems,
  priceReports,
} from "@/db/schema";
import { normalizePriceLabel } from "@/features/places/normalization";
import { moderateWorkerPriceReport } from "@/worker/admin-repository";
import {
  type WorkerDatabaseBindings,
  withWorkerDatabaseConnection,
} from "@/worker/db";

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  return databaseUrl;
}

async function main() {
  const databaseUrl = getDatabaseUrl();
  const client = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 5,
  });
  const db = drizzle(client);
  const uniqueSuffix = Date.now().toString();
  const slug = `concurrency-smoke-${uniqueSuffix}`;
  const label = `동시승인테스트${uniqueSuffix.slice(-6)}`;
  const normalizedLabel = normalizePriceLabel(label);
  const env: WorkerDatabaseBindings = {
    DATABASE_URL: databaseUrl,
    USE_MOCK_DATA: "false",
  };

  let placeId: string | null = null;
  let reportId: string | null = null;

  try {
    const [place] = await db
      .insert(places)
      .values({
        slug,
        name: `동시 승인 테스트 ${uniqueSuffix}`,
        roadAddress: "서울특별시 중구 세종대로 110",
        district: "서울 중구",
        latitude: 37.5665,
        longitude: 126.978,
        status: "active",
        primaryCategorySlug: "korean",
      })
      .returning({ id: places.id });
    placeId = place.id;

    const [report] = await db
      .insert(priceReports)
      .values({
        placeId,
        label,
        normalizedLabel,
        amount: 7200,
        unitLabel: "1인분",
        comment: "동시 승인 smoke",
        reportStatus: "pending_review",
      })
      .returning({ id: priceReports.id });
    reportId = report.id;
    const currentReportId = report.id;

    const results = await Promise.all([
      withWorkerDatabaseConnection(env, () =>
        moderateWorkerPriceReport(env, currentReportId, { decision: "approve" }, { id: "" }),
      ),
      withWorkerDatabaseConnection(env, () =>
        moderateWorkerPriceReport(env, currentReportId, { decision: "approve" }, { id: "" }),
      ),
    ]);
    const successCount = results.filter((result) => result.ok).length;
    const alreadyProcessedCount = results.filter(
      (result) => !result.ok && result.message === "이미 처리된 가격 제보입니다.",
    ).length;

    if (successCount !== 1 || alreadyProcessedCount !== 1) {
      throw new Error(
        `Expected exactly one success and one already-processed response, got ${JSON.stringify(
          results,
        )}`,
      );
    }

    const [state] = await db
      .select({
        acceptedReports: drizzleSql<number>`count(*) filter (where ${priceReports.reportStatus} = 'accepted')::int`,
        pendingReports: drizzleSql<number>`count(*) filter (where ${priceReports.reportStatus} = 'pending_review')::int`,
      })
      .from(priceReports)
      .where(eq(priceReports.id, reportId));
    const [itemState] = await db
      .select({
        itemCount: drizzleSql<number>`count(*)::int`,
        maxVerifiedReportCount: drizzleSql<number>`coalesce(max(${priceItems.verifiedReportCount}), 0)::int`,
      })
      .from(priceItems)
      .where(
        and(
          eq(priceItems.placeId, placeId),
          eq(priceItems.normalizedLabel, normalizedLabel),
        ),
      );
    const [actionState] = await db
      .select({ count: drizzleSql<number>`count(*)::int` })
      .from(adminActions)
      .where(
        and(
          eq(adminActions.targetType, "price_report"),
          eq(adminActions.targetId, reportId),
          eq(adminActions.actionType, "approve_price_report"),
        ),
      );

    if (
      Number(state?.acceptedReports ?? 0) !== 1 ||
      Number(state?.pendingReports ?? 0) !== 0 ||
      Number(itemState?.itemCount ?? 0) !== 1 ||
      Number(itemState?.maxVerifiedReportCount ?? 0) !== 1 ||
      Number(actionState?.count ?? 0) !== 1
    ) {
      throw new Error(
        `Unexpected persisted state: ${JSON.stringify({
          report: state,
          item: itemState,
          action: actionState,
        })}`,
      );
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          reportId,
          results: results.map((result) => ({
            ok: result.ok,
            message: result.message,
          })),
          persisted: {
            report: state,
            item: itemState,
            action: actionState,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    if (reportId) {
      await db
        .delete(adminActions)
        .where(
          and(
            eq(adminActions.targetType, "price_report"),
            eq(adminActions.targetId, reportId),
          ),
        );
    }

    if (placeId) {
      await db.delete(places).where(eq(places.id, placeId));
    }

    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
