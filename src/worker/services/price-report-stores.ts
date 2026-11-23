import { and, eq } from "drizzle-orm";

import { priceItems, priceReports } from "@/db/schema";
import { getPlaceById } from "@/features/places/queries";
import {
  getWorkerDb,
  isWorkerDatabaseEnabled,
  isWorkerMockDataEnabled,
  withWorkerDatabaseConnection,
  type WorkerDatabaseBindings,
} from "@/worker/db";
import { DomainError } from "@/worker/http/api-error";
import { getActivePlaceIdentityBySlug } from "@/worker/places/places-write-support";
import {
  createPriceReportService,
  type PriceReportStore,
} from "@/worker/services/price-report-service";

function createDatabasePriceReportStore(
  env: WorkerDatabaseBindings,
): PriceReportStore {
  return {
    source: "database",
    findActivePlace: (slug) =>
      withWorkerDatabaseConnection(env, () =>
        getActivePlaceIdentityBySlug(getWorkerDb(env), slug),
      ),
    createIfAbsent: (report) =>
      withWorkerDatabaseConnection(env, async () => {
        const db = getWorkerDb(env);
        const [matchedPriceItem] = await db
          .select({ id: priceItems.id })
          .from(priceItems)
          .where(
            and(
              eq(priceItems.placeId, report.placeId),
              eq(priceItems.normalizedLabel, report.normalizedLabel),
            ),
          )
          .limit(1);
        const [created] = await db
          .insert(priceReports)
          .values({
            placeId: report.placeId,
            priceItemId: matchedPriceItem?.id ?? null,
            reporterUserId: report.actor.user?.id ?? null,
            reporterVisitorId: report.actor.visitorId,
            submissionKey: report.submissionKey,
            label: report.label,
            normalizedLabel: report.normalizedLabel,
            amount: report.amount,
            currency: "KRW",
            unitLabel: report.unitLabel,
            comment: report.comment,
            reportStatus: "pending_review",
            snapshotVerificationStatus: "unverified",
          })
          .onConflictDoNothing({ target: priceReports.submissionKey })
          .returning({ id: priceReports.id });
        const existing =
          created ??
          (
            await db
              .select({ id: priceReports.id })
              .from(priceReports)
              .where(eq(priceReports.submissionKey, report.submissionKey))
              .limit(1)
          )[0];

        if (!existing) {
          throw new DomainError(
            "INTERNAL_ERROR",
            "가격 정보를 저장하지 못했습니다.",
          );
        }

        return existing;
      }),
  };
}

function createMockPriceReportStore(): PriceReportStore {
  return {
    source: "mock",
    async findActivePlace(slug) {
      const place = getPlaceById(slug);

      return place ? { id: place.id, slug: place.id, name: place.name } : null;
    },
    async createIfAbsent() {
      return { id: `vite-price-report-${crypto.randomUUID()}` };
    },
  };
}

/** DB/mock/미설정 분기는 여기 한 곳에서만 고른다. 라우트는 이 분기를 알지 못한다. */
export function getPriceReportService(env: WorkerDatabaseBindings) {
  if (isWorkerDatabaseEnabled(env)) {
    return createPriceReportService(createDatabasePriceReportStore(env));
  }

  if (isWorkerMockDataEnabled(env)) {
    return createPriceReportService(createMockPriceReportStore());
  }

  throw new DomainError(
    "DATABASE_UNAVAILABLE",
    "가격 정보를 저장하지 못했습니다.",
  );
}
