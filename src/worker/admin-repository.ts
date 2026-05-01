import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";

import {
  adminActions,
  categories,
  contentReports,
  placeCategories,
  places,
  priceItems,
  priceReports,
} from "@/db/schema";
import { normalizePriceLabel } from "@/features/places/normalization";
import type {
  AdminPriceItemUpdateInput,
  PriceReportModerationInput,
} from "@/features/places/write-schema";
import type { PlaceModerationInput } from "@/features/submission/schema";
import type { ReportModerationInput } from "@/features/reports/schema";
import { mockReports, type MockReportRecord } from "@/features/reports/mock-data";
import { getWorkerDb, type WorkerDatabaseBindings } from "@/worker/db";

type DataSource = "database";
type VerificationStatus = "verified" | "unverified";
type AdminUser = {
  id: string;
};

type PendingPlacePriceItem = {
  id: string;
  label: string;
  amount: number;
  unitLabel?: string;
  verificationStatus: VerificationStatus;
  reportedAt: string;
};

type PendingPlaceRecord = {
  id: string;
  name: string;
  businessName?: string;
  categorySlug: string;
  address: string;
  district: string;
  note: string;
  representativePriceAmount: number;
  representativePriceLabel: string;
  createdAt: string;
  latitude?: number;
  longitude?: number;
  priceItems: PendingPlacePriceItem[];
};

type PendingPriceReportRecord = {
  id: string;
  placeId: string;
  placeName: string;
  district: string;
  label: string;
  amount: number;
  unitLabel?: string;
  comment?: string;
  createdAt: string;
  existingPriceLabel?: string;
  existingPriceAmount?: number;
  existingPriceUnitLabel?: string;
  existingPriceVerificationStatus?: VerificationStatus;
};

type AdminPriceItemRecord = {
  id: string;
  label: string;
  amount: number;
  unitLabel?: string;
  verificationStatus: VerificationStatus;
  verifiedReportCount: number;
  reportedAt: string;
  isRepresentative: boolean;
  isActive: boolean;
};

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

function toPendingPlaceRecord(
  row: {
    internalId: string;
    slug: string;
    name: string;
    businessName: string | null;
    note: string | null;
    roadAddress: string;
    district: string;
    latitude: number | null;
    longitude: number | null;
    primaryCategorySlug: string | null;
    representativePriceAmount: number | null;
    representativePriceLabel: string | null;
    createdAt: Date;
  },
  categorySlug: string | null | undefined,
  items: PendingPlacePriceItem[],
): PendingPlaceRecord {
  return {
    id: row.slug,
    name: row.name,
    businessName: row.businessName ?? undefined,
    categorySlug: row.primaryCategorySlug ?? categorySlug ?? "other-service",
    address: row.roadAddress,
    district: row.district,
    note:
      row.note ??
      "운영 검토 전 단계이거나 추가 메모가 아직 등록되지 않았습니다.",
    representativePriceAmount: row.representativePriceAmount ?? 0,
    representativePriceLabel: row.representativePriceLabel ?? "대표 가격 준비 중",
    createdAt: formatDate(row.createdAt),
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    priceItems: items,
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

async function loadCategoryMap(env: WorkerDatabaseBindings, placeIds: string[]) {
  if (placeIds.length === 0) {
    return new Map<string, string>();
  }

  const db = getWorkerDb(env);
  const rows = await db
    .select({
      placeId: placeCategories.placeId,
      categorySlug: categories.slug,
      isPrimary: placeCategories.isPrimary,
    })
    .from(placeCategories)
    .innerJoin(categories, eq(placeCategories.categoryId, categories.id))
    .where(inArray(placeCategories.placeId, placeIds))
    .orderBy(desc(placeCategories.isPrimary), asc(categories.sortOrder));
  const categoryMap = new Map<string, string>();

  for (const row of rows) {
    if (!categoryMap.has(row.placeId) || row.isPrimary) {
      categoryMap.set(row.placeId, row.categorySlug);
    }
  }

  return categoryMap;
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
    items.find((item) => item.isRepresentative && item.verificationStatus === "verified") ??
    items.find((item) => item.verificationStatus === "verified") ??
    items.find((item) => item.isRepresentative) ??
    items[0] ??
    null
  );
}

async function refreshWorkerPlacePricingSummary(
  env: WorkerDatabaseBindings,
  placeId: string,
  changedAt: Date,
) {
  const db = getWorkerDb(env);
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

export async function listWorkerPendingPlaces(env: WorkerDatabaseBindings) {
  const db = getWorkerDb(env);
  const rows = await db
    .select({
      internalId: places.id,
      slug: places.slug,
      name: places.name,
      businessName: places.businessName,
      note: places.note,
      roadAddress: places.roadAddress,
      district: places.district,
      latitude: places.latitude,
      longitude: places.longitude,
      primaryCategorySlug: places.primaryCategorySlug,
      representativePriceAmount: places.representativePriceAmount,
      representativePriceLabel: places.representativePriceLabel,
      createdAt: places.createdAt,
    })
    .from(places)
    .where(eq(places.status, "pending_review"))
    .orderBy(desc(places.createdAt));
  const pendingPlaceIds = rows.map((row) => row.internalId);
  const categoryMap = await loadCategoryMap(env, pendingPlaceIds);
  const priceItemRows =
    pendingPlaceIds.length === 0
      ? []
      : await db
          .select({
            placeId: priceItems.placeId,
            id: priceItems.id,
            label: priceItems.label,
            amount: priceItems.amount,
            unitLabel: priceItems.unitLabel,
            verificationStatus: priceItems.verificationStatus,
            latestReportedAt: priceItems.latestReportedAt,
          })
          .from(priceItems)
          .where(inArray(priceItems.placeId, pendingPlaceIds))
          .orderBy(asc(priceItems.amount), asc(priceItems.label));
  const priceItemsByPlaceId = new Map<string, PendingPlacePriceItem[]>();

  for (const item of priceItemRows) {
    const items = priceItemsByPlaceId.get(item.placeId) ?? [];

    items.push({
      id: item.id,
      label: item.label,
      amount: item.amount,
      unitLabel: item.unitLabel ?? undefined,
      verificationStatus: item.verificationStatus,
      reportedAt: formatDate(item.latestReportedAt),
    });
    priceItemsByPlaceId.set(item.placeId, items);
  }

  return {
    items: rows.map((row) =>
      toPendingPlaceRecord(
        row,
        categoryMap.get(row.internalId),
        priceItemsByPlaceId.get(row.internalId) ?? [],
      ),
    ),
    source: "database" as DataSource,
  };
}

export async function moderateWorkerPlaceSubmission(
  env: WorkerDatabaseBindings,
  slug: string,
  input: PlaceModerationInput,
  adminUser: AdminUser,
) {
  const db = getWorkerDb(env);
  const [existing] = await db
    .select({
      id: places.id,
      slug: places.slug,
      name: places.name,
      businessName: places.businessName,
      note: places.note,
      roadAddress: places.roadAddress,
      district: places.district,
      latitude: places.latitude,
      longitude: places.longitude,
      primaryCategorySlug: places.primaryCategorySlug,
      representativePriceAmount: places.representativePriceAmount,
      representativePriceLabel: places.representativePriceLabel,
      createdAt: places.createdAt,
    })
    .from(places)
    .where(and(eq(places.slug, slug), eq(places.status, "pending_review")))
    .limit(1);

  if (!existing) {
    return {
      ok: false,
      message: "검토 대상을 찾지 못했습니다.",
      source: "database" as DataSource,
      item: null,
    };
  }

  const nextStatus = input.decision === "approve" ? "active" : "hidden";
  const changedAt = new Date();

  await db
    .update(places)
    .set({
      status: nextStatus,
      latitude:
        input.decision === "approve"
          ? input.latitude ?? existing.latitude
          : existing.latitude,
      longitude:
        input.decision === "approve"
          ? input.longitude ?? existing.longitude
          : existing.longitude,
      updatedAt: changedAt,
    })
    .where(eq(places.id, existing.id));
  await db
    .update(priceReports)
    .set({
      reportStatus: input.decision === "approve" ? "accepted" : "rejected",
    })
    .where(eq(priceReports.placeId, existing.id));
  await db.insert(adminActions).values({
    adminUserId: toAdminActionUserId(adminUser.id),
    actionType:
      input.decision === "approve"
        ? "approve_place_submission"
        : "reject_place_submission",
    targetType: "place",
    targetId: existing.id,
    metadataJson: {
      latitude:
        input.decision === "approve"
          ? input.latitude ?? existing.latitude
          : existing.latitude,
      longitude:
        input.decision === "approve"
          ? input.longitude ?? existing.longitude
          : existing.longitude,
    },
  });

  const categoryMap = await loadCategoryMap(env, [existing.id]);
  const priceItemRows = await db
    .select({
      id: priceItems.id,
      label: priceItems.label,
      amount: priceItems.amount,
      unitLabel: priceItems.unitLabel,
      verificationStatus: priceItems.verificationStatus,
      latestReportedAt: priceItems.latestReportedAt,
    })
    .from(priceItems)
    .where(eq(priceItems.placeId, existing.id))
    .orderBy(asc(priceItems.amount), asc(priceItems.label));

  return {
    ok: true,
    message:
      input.decision === "approve"
        ? "장소 제보를 승인했습니다."
        : "장소 제보를 반려했습니다.",
    source: "database" as DataSource,
    item: toPendingPlaceRecord(
      {
        ...existing,
        internalId: existing.id,
      },
      categoryMap.get(existing.id),
      priceItemRows.map((item) => ({
        id: item.id,
        label: item.label,
        amount: item.amount,
        unitLabel: item.unitLabel ?? undefined,
        verificationStatus: item.verificationStatus,
        reportedAt: formatDate(item.latestReportedAt),
      })),
    ),
  };
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
  const [existingReport] = await db
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
    await db
      .update(priceReports)
      .set({ reportStatus: "rejected" })
      .where(eq(priceReports.id, existingReport.id));
    await db.insert(adminActions).values({
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

  let matchedPriceItemId = existingReport.priceItemId;

  if (!matchedPriceItemId) {
    const [matchedPriceItem] = await db
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

  const [acceptedCountRow] = await db
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
  const nextVerifiedReportCount = Number(acceptedCountRow?.count ?? 0) + 1;
  const nextVerificationStatus: VerificationStatus =
    nextVerifiedReportCount >= 2 ? "verified" : "unverified";

  if (matchedPriceItemId) {
    await db
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
    const [createdPriceItem] = await db
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

  await db
    .update(priceReports)
    .set({
      priceItemId: matchedPriceItemId,
      reportStatus: "accepted",
      snapshotVerificationStatus: nextVerificationStatus,
    })
    .where(eq(priceReports.id, existingReport.id));

  if (nextVerificationStatus === "verified") {
    await db
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

  await refreshWorkerPlacePricingSummary(env, existingReport.placeId, changedAt);
  const [refreshedPriceItem] = await db
    .select({
      label: priceItems.label,
      amount: priceItems.amount,
      unitLabel: priceItems.unitLabel,
      verificationStatus: priceItems.verificationStatus,
    })
    .from(priceItems)
    .where(eq(priceItems.id, matchedPriceItemId))
    .limit(1);

  await db.insert(adminActions).values({
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
  const [existingItem] = await db
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
  const [duplicateItem] = await db
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
    await db
      .update(priceItems)
      .set({
        isRepresentative: false,
        updatedAt: changedAt,
      })
      .where(eq(priceItems.placeId, existingItem.placeId));
  }

  const [updatedItem] = await db
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

  await refreshWorkerPlacePricingSummary(env, existingItem.placeId, changedAt);
  await db.insert(adminActions).values({
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
}

export async function listWorkerReports(env: WorkerDatabaseBindings) {
  const db = getWorkerDb(env);
  const rows = await db
    .select({
      id: contentReports.id,
      placeId: places.slug,
      placeName: places.name,
      reasonType: contentReports.reasonType,
      detail: contentReports.detail,
      status: contentReports.status,
      createdAt: contentReports.createdAt,
    })
    .from(contentReports)
    .leftJoin(places, eq(contentReports.targetId, places.id))
    .where(eq(contentReports.targetType, "place"))
    .orderBy(desc(contentReports.createdAt));

  return {
    items: rows.map((row) => ({
      id: row.id,
      placeId: row.placeId ?? "unknown-place",
      placeName: row.placeName ?? "알 수 없는 장소",
      reasonType: row.reasonType as MockReportRecord["reasonType"],
      detail: row.detail ?? "",
      status: row.status,
      createdAt: formatDate(row.createdAt),
    })),
    source: "database" as DataSource,
  };
}

export function listWorkerMockReports() {
  return {
    items: mockReports,
    source: "mock" as const,
  };
}

export async function updateWorkerReportStatus(
  env: WorkerDatabaseBindings,
  id: string,
  input: ReportModerationInput,
  adminUser: AdminUser,
) {
  const db = getWorkerDb(env);
  const now = new Date();
  const [updatedReport] = await db
    .update(contentReports)
    .set({
      status: input.status,
      resolvedAt:
        input.status === "resolved" || input.status === "dismissed" ? now : null,
    })
    .where(eq(contentReports.id, id))
    .returning({
      id: contentReports.id,
      targetId: contentReports.targetId,
      reasonType: contentReports.reasonType,
      detail: contentReports.detail,
      status: contentReports.status,
      createdAt: contentReports.createdAt,
    });

  if (!updatedReport) {
    return {
      ok: false,
      message: "신고를 찾지 못했습니다.",
      source: "database" as DataSource,
      item: null,
    };
  }

  const [placeRow] = await db
    .select({
      slug: places.slug,
      name: places.name,
    })
    .from(places)
    .where(eq(places.id, updatedReport.targetId))
    .limit(1);

  await db.insert(adminActions).values({
    adminUserId: toAdminActionUserId(adminUser.id),
    actionType: "update_content_report_status",
    targetType: "content_report",
    targetId: updatedReport.id,
    metadataJson: {
      status: input.status,
    },
  });

  return {
    ok: true,
    message: "신고 상태를 업데이트했습니다.",
    source: "database" as DataSource,
    item: {
      id: updatedReport.id,
      placeId: placeRow?.slug ?? "unknown-place",
      placeName: placeRow?.name ?? "알 수 없는 장소",
      reasonType: updatedReport.reasonType as MockReportRecord["reasonType"],
      detail: updatedReport.detail ?? "",
      status: updatedReport.status,
      createdAt: formatDate(updatedReport.createdAt),
    },
  };
}
