import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import {
  moderationSuggestions,
  places,
  priceItems,
  priceReports,
} from "@/db/schema";
import type { PendingPriceReport } from "@/shared/admin-contracts";
import {
  formatDate,
  toAdminPriceItemRecord,
  toModerationSuggestionRecord,
} from "@/worker/admin/admin-price-helpers";
import { getWorkerDb, type WorkerDatabaseBindings } from "@/worker/db";
import {
  ADMIN_QUEUE_MAX_PAGE_SIZE,
  ADMIN_QUEUE_PAGE_SIZE,
} from "@/worker/admin/admin-queue-config";

type DataSource = "database";
type VerificationStatus = "verified" | "unverified";

type PendingPriceReportRecord = PendingPriceReport & {
  existingPriceVerificationStatus?: VerificationStatus;
};

export async function listWorkerPendingPriceReports(
  env: WorkerDatabaseBindings,
  { page = 1, limit = ADMIN_QUEUE_PAGE_SIZE } = {},
) {
  const db = getWorkerDb(env);
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.min(
    ADMIN_QUEUE_MAX_PAGE_SIZE,
    Math.max(1, Math.floor(limit)),
  );
  const rows = await db
    .select({
      id: priceReports.id,
      placeId: places.slug,
      placeName: places.name,
      district: places.district,
      label: priceReports.label,
      amount: priceReports.amount,
      unitLabel: priceReports.unitLabel,
      comment: priceReports.comment,
      createdAt: priceReports.createdAt,
      existingPriceLabel: priceItems.label,
      existingPriceAmount: priceItems.amount,
      existingPriceUnitLabel: priceItems.unitLabel,
      existingPriceVerificationStatus: priceItems.verificationStatus,
    })
    .from(priceReports)
    .innerJoin(places, eq(priceReports.placeId, places.id))
    .leftJoin(priceItems, eq(priceReports.priceItemId, priceItems.id))
    .where(
      and(
        eq(priceReports.reportStatus, "pending_review"),
        eq(places.status, "active"),
      ),
    )
    .orderBy(desc(priceReports.createdAt), desc(priceReports.id))
    .limit(safeLimit)
    .offset((safePage - 1) * safeLimit);
  const [countRow] = await db
    .select({ count: count() })
    .from(priceReports)
    .innerJoin(places, eq(priceReports.placeId, places.id))
    .where(
      and(
        eq(priceReports.reportStatus, "pending_review"),
        eq(places.status, "active"),
      ),
    );
  const suggestionRows =
    rows.length > 0
      ? await db
          .select({
            subjectKey: moderationSuggestions.subjectKey,
            suggestedAction: moderationSuggestions.suggestedAction,
            confidence: moderationSuggestions.confidence,
            summary: moderationSuggestions.summary,
            checks: moderationSuggestions.checks,
            flags: moderationSuggestions.flags,
          })
          .from(moderationSuggestions)
          .where(
            and(
              eq(moderationSuggestions.subjectType, "price_report"),
              eq(moderationSuggestions.status, "pending"),
              inArray(
                moderationSuggestions.subjectKey,
                rows.map((row) => row.id),
              ),
            ),
          )
      : [];
  const suggestionsBySubject = new Map(
    suggestionRows.map((row) => [
      row.subjectKey,
      toModerationSuggestionRecord(row),
    ]),
  );

  return {
    items: rows.map((row) => ({
      id: row.id,
      placeId: row.placeId,
      placeName: row.placeName,
      district: row.district,
      label: row.label,
      amount: row.amount,
      unitLabel: row.unitLabel ?? undefined,
      comment: row.comment ?? undefined,
      createdAt: formatDate(row.createdAt),
      existingPriceLabel: row.existingPriceLabel ?? undefined,
      existingPriceAmount: row.existingPriceAmount ?? undefined,
      existingPriceUnitLabel: row.existingPriceUnitLabel ?? undefined,
      existingPriceVerificationStatus:
        row.existingPriceVerificationStatus ?? undefined,
      moderationSuggestion: suggestionsBySubject.get(row.id),
    })) satisfies PendingPriceReportRecord[],
    count: Number(countRow?.count ?? 0),
    page: safePage,
    limit: safeLimit,
    source: "database" as DataSource,
  };
}

export async function getWorkerAdminPlacePriceDetail(
  env: WorkerDatabaseBindings,
  slug: string,
) {
  const db = getWorkerDb(env);
  const [placeRow] = await db
    .select({
      id: places.id,
      slug: places.slug,
      name: places.name,
      district: places.district,
      representativePriceAmount: places.representativePriceAmount,
      representativePriceLabel: places.representativePriceLabel,
      verifiedPriceItemCount: places.verifiedPriceItemCount,
    })
    .from(places)
    .where(and(eq(places.slug, slug), eq(places.status, "active")))
    .limit(1);

  if (!placeRow) {
    return {
      item: null,
      source: "database" as DataSource,
    };
  }

  const itemRows = await db
    .select({
      id: priceItems.id,
      label: priceItems.label,
      amount: priceItems.amount,
      unitLabel: priceItems.unitLabel,
      verificationStatus: priceItems.verificationStatus,
      verifiedReportCount: priceItems.verifiedReportCount,
      latestReportedAt: priceItems.latestReportedAt,
      isRepresentative: priceItems.isRepresentative,
      isActive: priceItems.isActive,
    })
    .from(priceItems)
    .where(eq(priceItems.placeId, placeRow.id))
    .orderBy(
      desc(priceItems.isActive),
      desc(priceItems.isRepresentative),
      asc(priceItems.amount),
      asc(priceItems.label),
    );

  return {
    item: {
      id: placeRow.slug,
      name: placeRow.name,
      district: placeRow.district,
      representativePriceAmount: placeRow.representativePriceAmount ?? 0,
      representativePriceLabel:
        placeRow.representativePriceLabel ?? "가격 정보 준비 중",
      verificationStatus:
        placeRow.verifiedPriceItemCount > 0 ? "verified" : "unverified",
      priceItems: itemRows.map(toAdminPriceItemRecord),
    },
    source: "database" as DataSource,
  };
}
