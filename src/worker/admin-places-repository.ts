import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import {
  adminActions,
  categories,
  placeCategories,
  places,
  priceItems,
  priceReports,
} from "@/db/schema";
import type { PlaceModerationInput } from "@/features/submission/schema";
import type { PendingPlace } from "@/shared/admin-contracts";
import { getWorkerDb, type WorkerDatabaseBindings } from "@/worker/db";
import { refreshWorkerPlacePricingSummary } from "@/worker/admin/admin-price-helpers";
import {
  ADMIN_QUEUE_MAX_PAGE_SIZE,
  ADMIN_QUEUE_PAGE_SIZE,
} from "@/worker/admin/admin-queue-config";

type DataSource = "database";
type WorkerDb = ReturnType<typeof getWorkerDb>;
type WorkerDbTransaction = Parameters<Parameters<WorkerDb["transaction"]>[0]>[0];
type WorkerDbExecutor = WorkerDb | WorkerDbTransaction;
type VerificationStatus = "verified" | "unverified";
type AdminUser = {
  id: string;
};

type PendingPlacePriceItem = PendingPlace["priceItems"][number] & {
  id: string;
  label: string;
  amount: number;
  unitLabel?: string;
  verificationStatus: VerificationStatus;
  reportedAt: string;
};

type PendingPlaceRecord = PendingPlace;

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
    representativePriceLabel: row.representativePriceLabel ?? "가격 정보 준비 중",
    createdAt: formatDate(row.createdAt),
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    priceItems: items,
  };
}

async function loadCategoryMap(db: WorkerDbExecutor, placeIds: string[]) {
  if (placeIds.length === 0) {
    return new Map<string, string>();
  }

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

export async function listWorkerPendingPlaces(
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
    .orderBy(desc(places.createdAt), desc(places.id))
    .limit(safeLimit)
    .offset((safePage - 1) * safeLimit);
  const [countRow] = await db
    .select({ count: count() })
    .from(places)
    .where(eq(places.status, "pending_review"));
  const pendingPlaceIds = rows.map((row) => row.internalId);
  const categoryMap = await loadCategoryMap(db, pendingPlaceIds);
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
    count: Number(countRow?.count ?? 0),
    page: safePage,
    limit: safeLimit,
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

  return await db.transaction(async (tx) => {
    const [existing] = await tx
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

    const [claimedPlace] = await tx
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
      .where(
        and(
          eq(places.id, existing.id),
          eq(places.status, "pending_review"),
        ),
      )
      .returning({ id: places.id });

    if (!claimedPlace) {
      return {
        ok: false,
        message: "이미 처리된 장소 검토 항목입니다.",
        source: "database" as DataSource,
        item: null,
      };
    }

    await tx
      .update(priceReports)
      .set({
        reportStatus: input.decision === "approve" ? "accepted" : "rejected",
      })
      .where(eq(priceReports.placeId, existing.id));
    await refreshWorkerPlacePricingSummary(tx, existing.id, changedAt);
    await tx.insert(adminActions).values({
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

    const categoryMap = await loadCategoryMap(tx, [existing.id]);
    const priceItemRows = await tx
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
  });
}
