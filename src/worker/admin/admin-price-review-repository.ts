import { and, eq, sql } from "drizzle-orm";

import { adminActions, places, priceItems, priceReports } from "@/db/schema";
import type { PriceReportModerationInput } from "@/features/places/write-schema";
import {
  formatDate,
  lockWorkerPriceReportModerationGroup,
  refreshWorkerPlacePricingSummary,
  toAdminActionUserId,
} from "@/worker/admin/admin-price-helpers";
import { getWorkerDb, type WorkerDatabaseBindings } from "@/worker/db";

type DataSource = "database";
type VerificationStatus = "verified" | "unverified";
type AdminUser = {
  id: string;
};

export async function moderateWorkerPriceReport(
  env: WorkerDatabaseBindings,
  reportId: string,
  input: PriceReportModerationInput,
  adminUser: AdminUser,
) {
  const db = getWorkerDb(env);

  return await db.transaction(async (tx) => {
    const [existingReport] = await tx
      .select({
        id: priceReports.id,
        placeId: places.id,
        placeSlug: places.slug,
        placeName: places.name,
        district: places.district,
        reporterUserId: priceReports.reporterUserId,
        reporterVisitorId: priceReports.reporterVisitorId,
        priceItemId: priceReports.priceItemId,
        label: priceReports.label,
        normalizedLabel: priceReports.normalizedLabel,
        amount: priceReports.amount,
        unitLabel: priceReports.unitLabel,
        comment: priceReports.comment,
        reportStatus: priceReports.reportStatus,
        createdAt: priceReports.createdAt,
      })
      .from(priceReports)
      .innerJoin(places, eq(priceReports.placeId, places.id))
      .where(and(eq(priceReports.id, reportId), eq(places.status, "active")))
      .limit(1);

    if (!existingReport) {
      return {
        ok: false,
        message: "가격 제보를 찾지 못했습니다.",
        source: "database" as DataSource,
        item: null,
      };
    }

    if (existingReport.reportStatus !== "pending_review") {
      return {
        ok: false,
        message: "이미 처리된 가격 제보입니다.",
        source: "database" as DataSource,
        item: null,
      };
    }

    const changedAt = new Date();

    if (input.decision === "reject") {
      const [claimedReport] = await tx
        .update(priceReports)
        .set({ reportStatus: "rejected" })
        .where(
          and(
            eq(priceReports.id, existingReport.id),
            eq(priceReports.reportStatus, "pending_review"),
          ),
        )
        .returning({ id: priceReports.id });

      if (!claimedReport) {
        return {
          ok: false,
          message: "이미 처리된 가격 제보입니다.",
          source: "database" as DataSource,
          item: null,
        };
      }

      await tx.insert(adminActions).values({
        adminUserId: toAdminActionUserId(adminUser.id),
        actionType: "reject_price_report",
        targetType: "price_report",
        targetId: existingReport.id,
        metadataJson: {
          placeId: existingReport.placeSlug,
          label: existingReport.label,
          amount: existingReport.amount,
        },
      });

      return {
        ok: true,
        message: "가격 제보를 반려했습니다.",
        source: "database" as DataSource,
        item: {
          id: existingReport.id,
          placeId: existingReport.placeSlug,
          placeName: existingReport.placeName,
          district: existingReport.district,
          label: existingReport.label,
          amount: existingReport.amount,
          unitLabel: existingReport.unitLabel ?? undefined,
          comment: existingReport.comment ?? undefined,
          createdAt: formatDate(existingReport.createdAt),
        },
      };
    }

    const [claimedReport] = await tx
      .update(priceReports)
      .set({
        reportStatus: "accepted",
        snapshotVerificationStatus: "unverified",
      })
      .where(
        and(
          eq(priceReports.id, existingReport.id),
          eq(priceReports.reportStatus, "pending_review"),
        ),
      )
      .returning({ id: priceReports.id });

    if (!claimedReport) {
      return {
        ok: false,
        message: "이미 처리된 가격 제보입니다.",
        source: "database" as DataSource,
        item: null,
      };
    }

    await lockWorkerPriceReportModerationGroup(tx, {
      placeId: existingReport.placeId,
      normalizedLabel: existingReport.normalizedLabel,
    });

    let matchedPriceItemId = existingReport.priceItemId;

    if (!matchedPriceItemId) {
      const [matchedPriceItem] = await tx
        .select({ id: priceItems.id })
        .from(priceItems)
        .where(
          and(
            eq(priceItems.placeId, existingReport.placeId),
            eq(priceItems.normalizedLabel, existingReport.normalizedLabel),
          ),
        )
        .limit(1);

      matchedPriceItemId = matchedPriceItem?.id ?? null;
    }

    const [acceptedCountRow] = await tx
      .select({
        count: sql<number>`count(distinct coalesce(${priceReports.reporterUserId}::text, ${priceReports.reporterVisitorId}, ${priceReports.id}::text))::int`,
      })
      .from(priceReports)
      .where(
        and(
          eq(priceReports.placeId, existingReport.placeId),
          eq(priceReports.normalizedLabel, existingReport.normalizedLabel),
          eq(priceReports.amount, existingReport.amount),
          eq(priceReports.reportStatus, "accepted"),
        ),
      )
      .limit(1);
    const nextVerifiedReportCount = Number(acceptedCountRow?.count ?? 0);
    const nextVerificationStatus: VerificationStatus =
      nextVerifiedReportCount >= 2 ? "verified" : "unverified";

    if (matchedPriceItemId) {
      await tx
        .update(priceItems)
        .set({
          label: existingReport.label,
          normalizedLabel: existingReport.normalizedLabel,
          amount: existingReport.amount,
          unitLabel: existingReport.unitLabel,
          isActive: true,
          verificationStatus: nextVerificationStatus,
          verifiedReportCount: nextVerifiedReportCount,
          latestReportedAt: changedAt,
          updatedAt: changedAt,
        })
        .where(eq(priceItems.id, matchedPriceItemId));
    } else {
      const [createdPriceItem] = await tx
        .insert(priceItems)
        .values({
          placeId: existingReport.placeId,
          label: existingReport.label,
          normalizedLabel: existingReport.normalizedLabel,
          amount: existingReport.amount,
          currency: "KRW",
          unitLabel: existingReport.unitLabel,
          isActive: true,
          isRepresentative: false,
          verificationStatus: nextVerificationStatus,
          verifiedReportCount: nextVerifiedReportCount,
          latestReportedAt: changedAt,
          createdByUserId: existingReport.reporterUserId ?? null,
        })
        .returning({ id: priceItems.id });

      matchedPriceItemId = createdPriceItem.id;
    }

    await tx
      .update(priceReports)
      .set({
        priceItemId: matchedPriceItemId,
        snapshotVerificationStatus: nextVerificationStatus,
      })
      .where(eq(priceReports.id, existingReport.id));

    if (nextVerificationStatus === "verified") {
      await tx
        .update(priceReports)
        .set({ snapshotVerificationStatus: "verified" })
        .where(
          and(
            eq(priceReports.placeId, existingReport.placeId),
            eq(priceReports.normalizedLabel, existingReport.normalizedLabel),
            eq(priceReports.amount, existingReport.amount),
            eq(priceReports.reportStatus, "accepted"),
          ),
        );
    }

    await refreshWorkerPlacePricingSummary(
      tx,
      existingReport.placeId,
      changedAt,
    );
    const [refreshedPriceItem] = await tx
      .select({
        label: priceItems.label,
        amount: priceItems.amount,
        unitLabel: priceItems.unitLabel,
        verificationStatus: priceItems.verificationStatus,
      })
      .from(priceItems)
      .where(eq(priceItems.id, matchedPriceItemId))
      .limit(1);

    await tx.insert(adminActions).values({
      adminUserId: toAdminActionUserId(adminUser.id),
      actionType: "approve_price_report",
      targetType: "price_report",
      targetId: existingReport.id,
      metadataJson: {
        placeId: existingReport.placeSlug,
        label: existingReport.label,
        amount: existingReport.amount,
        verifiedReportCount: nextVerifiedReportCount,
        verificationStatus: nextVerificationStatus,
      },
    });

    return {
      ok: true,
      message: "가격 제보를 반영했습니다.",
      source: "database" as DataSource,
      item: {
        id: existingReport.id,
        placeId: existingReport.placeSlug,
        placeName: existingReport.placeName,
        district: existingReport.district,
        label: existingReport.label,
        amount: existingReport.amount,
        unitLabel: existingReport.unitLabel ?? undefined,
        comment: existingReport.comment ?? undefined,
        createdAt: formatDate(existingReport.createdAt),
        existingPriceLabel: refreshedPriceItem?.label ?? undefined,
        existingPriceAmount: refreshedPriceItem?.amount ?? undefined,
        existingPriceUnitLabel: refreshedPriceItem?.unitLabel ?? undefined,
        existingPriceVerificationStatus:
          refreshedPriceItem?.verificationStatus ?? undefined,
      },
    };
  });
}
