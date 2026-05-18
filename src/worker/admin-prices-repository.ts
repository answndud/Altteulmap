import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";

import {
  adminActions,
  moderationSuggestions,
  places,
  priceItems,
  priceReports,
} from "@/db/schema";
import { normalizePriceLabel } from "@/features/places/normalization";
import type { AdminPriceItemUpdateInput } from "@/features/places/write-schema";
import type { PendingPriceReport } from "@/shared/admin-contracts";
import {
  formatDate,
  refreshWorkerPlacePricingSummary,
  toAdminActionUserId,
  toAdminPriceItemRecord,
  toModerationSuggestionRecord,
} from "@/worker/admin/admin-price-helpers";
import { getWorkerDb, type WorkerDatabaseBindings } from "@/worker/db";

export { moderateWorkerPriceReport } from "@/worker/admin/admin-price-review-repository";

type DataSource = "database";
type VerificationStatus = "verified" | "unverified";
type AdminUser = {
  id: string;
};

type PendingPriceReportRecord = PendingPriceReport & {
  existingPriceVerificationStatus?: VerificationStatus;
};

export async function listWorkerPendingPriceReports(env: WorkerDatabaseBindings) {
  const db = getWorkerDb(env);
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
    .orderBy(desc(priceReports.createdAt));
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
        placeRow.representativePriceLabel ?? "대표 가격 준비 중",
      verificationStatus:
        placeRow.verifiedPriceItemCount > 0 ? "verified" : "unverified",
      priceItems: itemRows.map(toAdminPriceItemRecord),
    },
    source: "database" as DataSource,
  };
}

export async function updateWorkerPriceItem(
  env: WorkerDatabaseBindings,
  itemId: string,
  input: AdminPriceItemUpdateInput,
  adminUser: AdminUser,
) {
  const db = getWorkerDb(env);

  return await db.transaction(async (tx) => {
    const [existingItem] = await tx
      .select({
        id: priceItems.id,
        placeId: places.id,
        placeSlug: places.slug,
        label: priceItems.label,
        amount: priceItems.amount,
        verifiedReportCount: priceItems.verifiedReportCount,
      })
      .from(priceItems)
      .innerJoin(places, eq(priceItems.placeId, places.id))
      .where(and(eq(priceItems.id, itemId), eq(places.status, "active")))
      .limit(1);

    if (!existingItem) {
      return {
        ok: false,
        message: "가격 항목을 찾지 못했습니다.",
        source: "database" as DataSource,
        item: null,
        placeId: null,
      };
    }

    const normalizedLabel = normalizePriceLabel(input.label);
    const [duplicateItem] = await tx
      .select({ id: priceItems.id })
      .from(priceItems)
      .where(
        and(
          eq(priceItems.placeId, existingItem.placeId),
          eq(priceItems.normalizedLabel, normalizedLabel),
          ne(priceItems.id, existingItem.id),
        ),
      )
      .limit(1);

    if (duplicateItem) {
      return {
        ok: false,
        message: "같은 이름의 가격 항목이 이미 있습니다.",
        source: "database" as DataSource,
        item: null,
        placeId: existingItem.placeSlug,
      };
    }

    const changedAt = new Date();
    const nextIsRepresentative = input.isActive ? input.isRepresentative : false;
    const nextVerifiedReportCount =
      input.verificationStatus === "verified"
        ? Math.max(existingItem.verifiedReportCount, 2)
        : 0;

    if (nextIsRepresentative) {
      await tx
        .update(priceItems)
        .set({
          isRepresentative: false,
          updatedAt: changedAt,
        })
        .where(eq(priceItems.placeId, existingItem.placeId));
    }

    const [updatedItem] = await tx
      .update(priceItems)
      .set({
        label: input.label,
        normalizedLabel,
        amount: input.amount,
        unitLabel: input.unitLabel || null,
        isActive: input.isActive,
        isRepresentative: nextIsRepresentative,
        verificationStatus: input.verificationStatus,
        verifiedReportCount: nextVerifiedReportCount,
        latestReportedAt: changedAt,
        updatedAt: changedAt,
      })
      .where(eq(priceItems.id, itemId))
      .returning({
        id: priceItems.id,
        label: priceItems.label,
        amount: priceItems.amount,
        unitLabel: priceItems.unitLabel,
        verificationStatus: priceItems.verificationStatus,
        verifiedReportCount: priceItems.verifiedReportCount,
        latestReportedAt: priceItems.latestReportedAt,
        isRepresentative: priceItems.isRepresentative,
        isActive: priceItems.isActive,
      });

    await refreshWorkerPlacePricingSummary(tx, existingItem.placeId, changedAt);
    await tx.insert(adminActions).values({
      adminUserId: toAdminActionUserId(adminUser.id),
      actionType: "update_price_item",
      targetType: "price_item",
      targetId: updatedItem.id,
      metadataJson: {
        placeId: existingItem.placeSlug,
        previousLabel: existingItem.label,
        previousAmount: existingItem.amount,
        nextLabel: updatedItem.label,
        nextAmount: updatedItem.amount,
        isActive: updatedItem.isActive,
        isRepresentative: updatedItem.isRepresentative,
        verificationStatus: updatedItem.verificationStatus,
      },
    });

    return {
      ok: true,
      message: updatedItem.isActive
        ? "가격 항목을 업데이트했습니다."
        : "가격 항목을 숨겼습니다.",
      source: "database" as DataSource,
      item: toAdminPriceItemRecord(updatedItem),
      placeId: existingItem.placeSlug,
    };
  });
}
