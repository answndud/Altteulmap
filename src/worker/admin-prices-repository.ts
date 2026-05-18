import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";

import {
  adminActions,
  moderationSuggestions,
  places,
  priceItems,
  priceReports,
} from "@/db/schema";
import { normalizePriceLabel } from "@/features/places/normalization";
import type {
  AdminPriceItemUpdateInput,
  PriceReportModerationInput,
} from "@/features/places/write-schema";
import type {
  AdminPriceItem,
  ModerationSuggestion,
  PendingPriceReport,
} from "@/shared/admin-contracts";
import { getWorkerDb, type WorkerDatabaseBindings } from "@/worker/db";

type DataSource = "database";
type WorkerDb = ReturnType<typeof getWorkerDb>;
type WorkerDbTransaction = Parameters<Parameters<WorkerDb["transaction"]>[0]>[0];
type WorkerDbExecutor = WorkerDb | WorkerDbTransaction;
type VerificationStatus = "verified" | "unverified";
type AdminUser = {
  id: string;
};

type ModerationSuggestionRecord = ModerationSuggestion;

type PendingPriceReportRecord = PendingPriceReport & {
  existingPriceVerificationStatus?: VerificationStatus;
};

type AdminPriceItemRecord = AdminPriceItem;

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
});
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatDate(value: Date | string | null) {
  if (!value) {
    return "";
  }

  const normalized = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(normalized.getTime())) {
    return "";
  }

  return dateFormatter.format(normalized);
}

function toAdminActionUserId(adminUserId?: string | null) {
  if (!adminUserId || !UUID_PATTERN.test(adminUserId)) {
    return null;
  }

  return adminUserId;
}

function toModerationSuggestionRecord(row: {
  suggestedAction: "approve" | "review" | "reject";
  confidence: number;
  summary: string;
  checks: string[];
  flags: string[];
}): ModerationSuggestionRecord {
  return {
    suggestedAction: row.suggestedAction,
    confidence: row.confidence,
    summary: row.summary,
    checks: row.checks,
    flags: row.flags,
  };
}

function toAdminPriceItemRecord(item: {
  id: string;
  label: string;
  amount: number;
  unitLabel: string | null;
  verificationStatus: VerificationStatus;
  verifiedReportCount: number;
  latestReportedAt: Date | null;
  isRepresentative: boolean;
  isActive: boolean;
}): AdminPriceItemRecord {
  return {
    id: item.id,
    label: item.label,
    amount: item.amount,
    unitLabel: item.unitLabel ?? undefined,
    verificationStatus: item.verificationStatus,
    verifiedReportCount: item.verifiedReportCount,
    reportedAt: formatDate(item.latestReportedAt),
    isRepresentative: item.isRepresentative,
    isActive: item.isActive,
  };
}

function selectRepresentativePriceItem(
  items: Array<{
    id: string;
    label: string;
    amount: number;
    latestReportedAt: Date | null;
    verificationStatus: VerificationStatus;
    isRepresentative: boolean;
  }>,
) {
  return (
    items.find(
      (item) => item.isRepresentative && item.verificationStatus === "verified",
    ) ??
    items.find((item) => item.verificationStatus === "verified") ??
    items.find((item) => item.isRepresentative) ??
    items[0] ??
    null
  );
}

async function refreshWorkerPlacePricingSummary(
  db: WorkerDbExecutor,
  placeId: string,
  changedAt: Date,
) {
  const currentPriceItems = await db
    .select({
      id: priceItems.id,
      label: priceItems.label,
      amount: priceItems.amount,
      latestReportedAt: priceItems.latestReportedAt,
      verificationStatus: priceItems.verificationStatus,
      isRepresentative: priceItems.isRepresentative,
    })
    .from(priceItems)
    .where(and(eq(priceItems.placeId, placeId), eq(priceItems.isActive, true)))
    .orderBy(asc(priceItems.amount), asc(priceItems.label));

  if (currentPriceItems.length === 0) {
    await db
      .update(places)
      .set({
        representativePriceAmount: null,
        representativePriceLabel: null,
        verifiedPriceItemCount: 0,
        lastPriceUpdatedAt: changedAt,
        updatedAt: changedAt,
      })
      .where(eq(places.id, placeId));
    return;
  }

  const representativeItem = selectRepresentativePriceItem(currentPriceItems);

  if (!representativeItem) {
    return;
  }

  const verifiedPriceItemCount = currentPriceItems.filter(
    (item) => item.verificationStatus === "verified",
  ).length;

  await db
    .update(priceItems)
    .set({
      isRepresentative: false,
      updatedAt: changedAt,
    })
    .where(eq(priceItems.placeId, placeId));
  await db
    .update(priceItems)
    .set({
      isRepresentative: true,
      updatedAt: changedAt,
    })
    .where(eq(priceItems.id, representativeItem.id));
  await db
    .update(places)
    .set({
      representativePriceAmount: representativeItem.amount,
      representativePriceLabel: representativeItem.label,
      verifiedPriceItemCount,
      lastPriceUpdatedAt: changedAt,
      updatedAt: changedAt,
    })
    .where(eq(places.id, placeId));
}

async function lockWorkerPriceReportModerationGroup(
  db: WorkerDbExecutor,
  input: { placeId: string; normalizedLabel: string },
) {
  await db.execute(sql`
    select pg_advisory_xact_lock(
      hashtextextended(${`${input.placeId}:${input.normalizedLabel}`}, 0)
    )
  `);
}

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
      .select({ count: sql<number>`count(*)::int` })
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
