import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  lte,
  or,
  sql,
} from "drizzle-orm";

import { getDb, isDatabaseEnabled } from "@/db/client";
import {
  adminActions,
  categories,
  comments,
  placeCategories,
  places,
  priceItems,
  priceReports,
  users,
} from "@/db/schema";
import { getCategoryBySlug } from "@/features/categories/catalog";
import { mockPlaces } from "@/features/places/mock-data";
import {
  normalizePriceLabel,
  slugifyPlaceName,
} from "@/features/places/normalization";
import {
  getFilteredPlaces,
  getMapBounds,
  getPlaceById,
  getRelatedPlaces,
} from "@/features/places/queries";
import type {
  PlaceModerationInput,
  PlaceSubmissionInput,
} from "@/features/submission/schema";
import type {
  PlaceCommentInput,
  PlacePriceReportInput,
  PriceReportModerationInput,
} from "@/features/places/write-schema";
import type {
  PlaceComment,
  PlaceBounds,
  PlaceHistoryEntry,
  PlacePriceItem,
  PlaceQueryBounds,
  PlaceRecord,
} from "@/features/places/types";

export type DataSource = "mock" | "database";

export type PlaceQuery = {
  category?: string | null;
  maxPrice?: number | null;
  sort?: "price" | "recent";
  bounds?: PlaceQueryBounds | null;
  query?: string | null;
};

type DatabasePlaceRow = {
  internalId: string;
  slug: string;
  name: string;
  businessName: string | null;
  description: string | null;
  note: string | null;
  roadAddress: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
  representativePriceAmount: number | null;
  representativePriceLabel: string | null;
  verifiedPriceItemCount: number;
  lastPriceUpdatedAt: Date | null;
};

export type PlaceListResult = {
  items: PlaceRecord[];
  bounds: PlaceBounds;
  source: DataSource;
};

export type PlaceDetailResult = {
  item: PlaceRecord | null;
  related: PlaceRecord[];
  source: DataSource;
};

export type PlaceSubmissionResult = {
  ok: boolean;
  message: string;
  mock: boolean;
  source: DataSource;
  preview: {
    id: string;
    name: string;
    categorySlug: string;
    roadAddress: string;
    district: string;
    latitude?: number;
    longitude?: number;
    priceItems: Array<{
      label: string;
      amount: number;
      unitLabel?: string;
    }>;
  };
};

export type PendingPlaceRecord = {
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
  priceItems: PlacePriceItem[];
};

export type PendingPlaceListResult = {
  items: PendingPlaceRecord[];
  source: DataSource;
};

export type PlaceModerationResult = {
  ok: boolean;
  message: string;
  source: DataSource;
  item: PendingPlaceRecord | null;
};

type PlaceViewer = {
  userId: string;
  role: "user" | "admin";
} | null;

export type PlaceCommentActionResult = {
  ok: boolean;
  message: string;
  source: DataSource;
  mock: boolean;
  item: PlaceComment | null;
};

export type PlaceCommentDeleteResult = {
  ok: boolean;
  message: string;
  source: DataSource;
  mock: boolean;
  deletedCommentId: string | null;
};

export type PlacePriceReportSubmissionResult = {
  ok: boolean;
  message: string;
  source: DataSource;
  mock: boolean;
  item: {
    id: string;
    placeId: string;
    placeName: string;
    label: string;
    amount: number;
    unitLabel?: string;
    comment?: string;
  } | null;
};

export type PendingPriceReportRecord = {
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
  existingPriceVerificationStatus?: "verified" | "unverified";
};

export type PendingPriceReportListResult = {
  items: PendingPriceReportRecord[];
  source: DataSource;
};

export type PriceReportModerationResult = {
  ok: boolean;
  message: string;
  source: DataSource;
  item: PendingPriceReportRecord | null;
};

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
});

function formatDate(value: Date | null) {
  return value ? dateFormatter.format(value) : "";
}

function getBoundsFromPlaces(items: PlaceRecord[]): PlaceBounds {
  const source = items.length > 0 ? items : mockPlaces;
  const latitudes = source.map((place) => place.latitude);
  const longitudes = source.map((place) => place.longitude);

  return {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLng: Math.min(...longitudes),
    maxLng: Math.max(...longitudes),
  };
}

function toFallbackPlacePreview(
  input: PlaceSubmissionInput,
): PlaceSubmissionResult["preview"] {
  const slug = slugifyPlaceName(input.name) || `draft-${Date.now()}`;

  return {
    id: `draft-${slug}`,
    name: input.name,
    categorySlug: input.categorySlug,
    roadAddress: input.roadAddress,
    district: input.district,
    latitude: input.latitude,
    longitude: input.longitude,
    priceItems: input.priceItems.map((item) => ({
      label: item.label,
      amount: item.amount,
      unitLabel: item.unitLabel || undefined,
    })),
  };
}

function toAuthorLabel(
  nickname: string | null,
  email: string | null,
  fallback: string,
) {
  if (nickname) {
    return nickname;
  }

  if (email) {
    return email.split("@")[0];
  }

  return fallback;
}

function toPlaceRecord(
  row: DatabasePlaceRow,
  categorySlug: string | null | undefined,
  detail?: {
    comments?: PlaceComment[];
    history?: PlaceHistoryEntry[];
    priceItems?: PlacePriceItem[];
  },
): PlaceRecord {
  return {
    id: row.slug,
    name: row.name,
    businessName: row.businessName ?? undefined,
    categorySlug: categorySlug ?? "other-service",
    address: row.roadAddress,
    district: row.district,
    latitude: row.latitude ?? 37.5665,
    longitude: row.longitude ?? 126.978,
    representativePriceAmount: row.representativePriceAmount ?? 0,
    representativePriceLabel: row.representativePriceLabel ?? "대표 가격 준비 중",
    verificationStatus:
      row.verifiedPriceItemCount > 0 ? "verified" : "unverified",
    lastPriceUpdatedAt: formatDate(row.lastPriceUpdatedAt),
    description:
      row.description ??
      "아직 장소 설명이 등록되지 않았습니다. 이후 제보 데이터가 쌓이면 내용을 보강할 수 있습니다.",
    note:
      row.note ??
      "운영 검토 전 단계이거나 추가 메모가 아직 등록되지 않았습니다.",
    priceItems: detail?.priceItems ?? [],
    history: detail?.history ?? [],
    comments: detail?.comments ?? [],
  };
}

function toPendingPlaceRecord(
  row: DatabasePlaceRow & { createdAt: Date },
  categorySlug: string | null | undefined,
  items: PlacePriceItem[],
): PendingPlaceRecord {
  return {
    id: row.slug,
    name: row.name,
    businessName: row.businessName ?? undefined,
    categorySlug: categorySlug ?? "other-service",
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

async function loadCategoryMap(placeIds: string[]) {
  if (placeIds.length === 0) {
    return new Map<string, string>();
  }

  const db = getDb();
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

async function listDatabasePlaces({
  category,
  maxPrice,
  sort = "price",
  bounds,
  query,
}: PlaceQuery = {}): Promise<PlaceListResult> {
  const db = getDb();
  const conditions = [
    eq(places.status, "active"),
    isNotNull(places.latitude),
    isNotNull(places.longitude),
  ];
  const normalizedQuery = query?.trim();

  if (maxPrice) {
    conditions.push(lte(places.representativePriceAmount, maxPrice));
  }

  if (normalizedQuery) {
    const queryPattern = `%${normalizedQuery}%`;

    conditions.push(
      or(
        ilike(places.name, queryPattern),
        ilike(places.businessName, queryPattern),
        ilike(places.roadAddress, queryPattern),
        ilike(places.district, queryPattern),
        ilike(places.representativePriceLabel, queryPattern),
        ilike(places.description, queryPattern),
        ilike(places.note, queryPattern),
      )!,
    );
  }

  if (bounds) {
    conditions.push(gte(places.latitude, bounds.minLat));
    conditions.push(lte(places.latitude, bounds.maxLat));
    conditions.push(gte(places.longitude, bounds.minLng));
    conditions.push(lte(places.longitude, bounds.maxLng));
  }

  const rows = await db
    .select({
      internalId: places.id,
      slug: places.slug,
      name: places.name,
      businessName: places.businessName,
      description: places.description,
      note: places.note,
      roadAddress: places.roadAddress,
      district: places.district,
      latitude: places.latitude,
      longitude: places.longitude,
      representativePriceAmount: places.representativePriceAmount,
      representativePriceLabel: places.representativePriceLabel,
      verifiedPriceItemCount: places.verifiedPriceItemCount,
      lastPriceUpdatedAt: places.lastPriceUpdatedAt,
    })
    .from(places)
    .where(and(...conditions))
    .orderBy(
      ...(sort === "recent"
        ? [desc(places.lastPriceUpdatedAt), desc(places.updatedAt)]
        : [asc(places.representativePriceAmount), desc(places.updatedAt)]),
    );

  const categoryMap = await loadCategoryMap(rows.map((row) => row.internalId));
  const mapped = rows
    .map((row) => toPlaceRecord(row, categoryMap.get(row.internalId)))
    .filter((place) =>
      category ? place.categorySlug === category : true,
    );

  return {
    items: mapped,
    bounds:
      mapped.length > 0
        ? getBoundsFromPlaces(mapped)
        : bounds ?? getMapBounds(),
    source: "database",
  };
}

async function getDatabasePlaceDetail(
  slug: string,
  viewer: PlaceViewer = null,
): Promise<PlaceDetailResult> {
  const db = getDb();
  const [row] = await db
    .select({
      internalId: places.id,
      slug: places.slug,
      name: places.name,
      businessName: places.businessName,
      description: places.description,
      note: places.note,
      roadAddress: places.roadAddress,
      district: places.district,
      latitude: places.latitude,
      longitude: places.longitude,
      representativePriceAmount: places.representativePriceAmount,
      representativePriceLabel: places.representativePriceLabel,
      verifiedPriceItemCount: places.verifiedPriceItemCount,
      lastPriceUpdatedAt: places.lastPriceUpdatedAt,
    })
    .from(places)
    .where(and(eq(places.slug, slug), eq(places.status, "active")))
    .limit(1);

  if (!row) {
    return {
      item: null,
      related: [],
      source: "database",
    };
  }

  const [categoryMap, priceItemRows, historyRows, commentRows, relatedList] =
    await Promise.all([
      loadCategoryMap([row.internalId]),
      db
        .select({
          id: priceItems.id,
          label: priceItems.label,
          amount: priceItems.amount,
          unitLabel: priceItems.unitLabel,
          verificationStatus: priceItems.verificationStatus,
          latestReportedAt: priceItems.latestReportedAt,
        })
        .from(priceItems)
        .where(eq(priceItems.placeId, row.internalId))
        .orderBy(
          desc(priceItems.isRepresentative),
          asc(priceItems.amount),
          asc(priceItems.label),
        ),
      db
        .select({
          id: priceReports.id,
          label: priceReports.label,
          amount: priceReports.amount,
          verificationStatus: priceReports.snapshotVerificationStatus,
          recordedAt: priceReports.createdAt,
        })
        .from(priceReports)
        .where(
          and(
            eq(priceReports.placeId, row.internalId),
            eq(priceReports.reportStatus, "accepted"),
          ),
        )
        .orderBy(desc(priceReports.createdAt)),
      db
        .select({
          id: comments.id,
          userId: comments.userId,
          body: comments.body,
          createdAt: comments.createdAt,
          nickname: users.nickname,
          email: users.email,
        })
        .from(comments)
        .leftJoin(users, eq(comments.userId, users.id))
        .where(and(eq(comments.placeId, row.internalId), eq(comments.status, "visible")))
        .orderBy(desc(comments.createdAt)),
      listDatabasePlaces({ sort: "price" }),
    ]);

  const categorySlug = categoryMap.get(row.internalId);
  const item = toPlaceRecord(row, categorySlug, {
    priceItems: priceItemRows.map((priceItem) => ({
      id: priceItem.id,
      label: priceItem.label,
      amount: priceItem.amount,
      unitLabel: priceItem.unitLabel ?? undefined,
      verificationStatus: priceItem.verificationStatus,
      reportedAt: formatDate(priceItem.latestReportedAt),
    })),
    history: historyRows.map((history) => ({
      id: history.id,
      label: history.label,
      amount: history.amount,
      verificationStatus: history.verificationStatus,
      recordedAt: formatDate(history.recordedAt),
    })),
    comments: commentRows.map((comment) => ({
      id: comment.id,
      authorLabel: toAuthorLabel(comment.nickname, comment.email, "사용자"),
      body: comment.body,
      createdAt: formatDate(comment.createdAt),
      canDelete:
        viewer?.role === "admin" || viewer?.userId === comment.userId,
    })),
  });

  const currentCategory = getCategoryBySlug(categorySlug);
  const related = relatedList.items
    .filter((candidate) => {
      if (candidate.id === item.id) {
        return false;
      }

      const candidateCategory = getCategoryBySlug(candidate.categorySlug);

      return candidateCategory?.parentSlug === currentCategory?.parentSlug;
    })
    .slice(0, 3);

  return {
    item,
    related,
    source: "database",
  };
}

async function createUniquePlaceSlug(baseSlug: string) {
  const db = getDb();
  const rootSlug = baseSlug || `place-${Date.now()}`;
  let candidate = rootSlug;
  let suffix = 2;

  while (true) {
    const existing = await db
      .select({ id: places.id })
      .from(places)
      .where(eq(places.slug, candidate))
      .limit(1);

    if (existing.length === 0) {
      return candidate;
    }

    candidate = `${rootSlug}-${suffix}`;
    suffix += 1;
  }
}

async function getActivePlaceIdentityBySlug(slug: string) {
  const db = getDb();
  const [placeRow] = await db
    .select({
      id: places.id,
      slug: places.slug,
      name: places.name,
      district: places.district,
    })
    .from(places)
    .where(and(eq(places.slug, slug), eq(places.status, "active")))
    .limit(1);

  return placeRow ?? null;
}

async function refreshPlacePricingSummary(placeId: string, changedAt: Date) {
  const db = getDb();
  const currentPriceItems = await db
    .select({
      id: priceItems.id,
      label: priceItems.label,
      amount: priceItems.amount,
      verificationStatus: priceItems.verificationStatus,
    })
    .from(priceItems)
    .where(eq(priceItems.placeId, placeId))
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

  const representativeItem = currentPriceItems[0];
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

async function createDatabasePlaceSubmission(
  input: PlaceSubmissionInput,
  createdByUserId?: string | null,
): Promise<PlaceSubmissionResult> {
  const db = getDb();
  const [categoryRow] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, input.categorySlug))
    .limit(1);

  if (!categoryRow) {
    throw new Error("Selected category does not exist.");
  }

  let representativeIndex = 0;

  input.priceItems.forEach((item, index) => {
    if (item.amount < input.priceItems[representativeIndex].amount) {
      representativeIndex = index;
    }
  });

  const slug = await createUniquePlaceSlug(slugifyPlaceName(input.name));
  const now = new Date();
  const [createdPlace] = await db
    .insert(places)
    .values({
      slug,
      name: input.name,
      businessName: input.businessName || null,
      description: null,
      note: input.note || null,
      roadAddress: input.roadAddress,
      district: input.district,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      status: "pending_review",
      representativePriceAmount: input.priceItems[representativeIndex].amount,
      representativePriceLabel: input.priceItems[representativeIndex].label,
      verifiedPriceItemCount: 0,
      lastPriceUpdatedAt: now,
      createdByUserId: createdByUserId ?? null,
    })
    .returning({
      id: places.id,
      slug: places.slug,
    });

  await db.insert(placeCategories).values({
    placeId: createdPlace.id,
    categoryId: categoryRow.id,
    isPrimary: true,
  });

  const insertedPriceItems = await db
    .insert(priceItems)
    .values(
      input.priceItems.map((item, index) => ({
        placeId: createdPlace.id,
        label: item.label,
        normalizedLabel: normalizePriceLabel(item.label),
        amount: item.amount,
        currency: "KRW" as const,
        unitLabel: item.unitLabel || null,
        isRepresentative: index === representativeIndex,
        verificationStatus: "unverified" as const,
        verifiedReportCount: 0,
        latestReportedAt: now,
        createdByUserId: createdByUserId ?? null,
      })),
    )
    .returning({
      id: priceItems.id,
      normalizedLabel: priceItems.normalizedLabel,
    });

  const priceItemIdByLabel = new Map(
    insertedPriceItems.map((item) => [item.normalizedLabel, item.id]),
  );

  await db.insert(priceReports).values(
    input.priceItems.map((item) => ({
      placeId: createdPlace.id,
      priceItemId: priceItemIdByLabel.get(normalizePriceLabel(item.label)) ?? null,
      label: item.label,
      normalizedLabel: normalizePriceLabel(item.label),
      amount: item.amount,
      currency: "KRW" as const,
      unitLabel: item.unitLabel || null,
      comment: "신규 제보 등록",
      reportStatus: "pending_review" as const,
      snapshotVerificationStatus: "unverified" as const,
      reporterUserId: createdByUserId ?? null,
      createdAt: now,
    })),
  );

  return {
    ok: true,
    message:
      "제출이 접수되었습니다. DB에 임시 저장했고, 운영 검토 전까지는 공개 목록에 노출되지 않습니다.",
    mock: false,
    source: "database",
    preview: {
      id: createdPlace.slug,
      name: input.name,
      categorySlug: input.categorySlug,
      roadAddress: input.roadAddress,
      district: input.district,
      latitude: input.latitude,
      longitude: input.longitude,
      priceItems: input.priceItems.map((item) => ({
        label: item.label,
        amount: item.amount,
        unitLabel: item.unitLabel || undefined,
      })),
    },
  };
}

async function createDatabasePlaceComment(
  slug: string,
  input: PlaceCommentInput,
  userId: string,
): Promise<PlaceCommentActionResult> {
  const db = getDb();
  const placeRow = await getActivePlaceIdentityBySlug(slug);

  if (!placeRow) {
    return {
      ok: false,
      message: "장소를 찾지 못했습니다.",
      source: "database",
      mock: false,
      item: null,
    };
  }

  const [createdComment] = await db
    .insert(comments)
    .values({
      placeId: placeRow.id,
      userId,
      body: input.body,
      status: "visible",
    })
    .returning({
      id: comments.id,
      createdAt: comments.createdAt,
    });

  const [author] = await db
    .select({
      nickname: users.nickname,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return {
    ok: true,
    message: "코멘트를 등록했습니다.",
    source: "database",
    mock: false,
    item: {
      id: createdComment.id,
      authorLabel: toAuthorLabel(author?.nickname ?? null, author?.email ?? null, "나"),
      body: input.body,
      createdAt: formatDate(createdComment.createdAt),
      canDelete: true,
    },
  };
}

async function hideDatabasePlaceComment(
  slug: string,
  commentId: string,
  viewer: NonNullable<PlaceViewer>,
): Promise<PlaceCommentDeleteResult> {
  const db = getDb();
  const placeRow = await getActivePlaceIdentityBySlug(slug);

  if (!placeRow) {
    return {
      ok: false,
      message: "장소를 찾지 못했습니다.",
      source: "database",
      mock: false,
      deletedCommentId: null,
    };
  }

  const [existingComment] = await db
    .select({
      id: comments.id,
      userId: comments.userId,
      status: comments.status,
    })
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.placeId, placeRow.id)))
    .limit(1);

  if (!existingComment || existingComment.status !== "visible") {
    return {
      ok: false,
      message: "코멘트를 찾지 못했습니다.",
      source: "database",
      mock: false,
      deletedCommentId: null,
    };
  }

  if (viewer.role !== "admin" && existingComment.userId !== viewer.userId) {
    return {
      ok: false,
      message: "삭제 권한이 없습니다.",
      source: "database",
      mock: false,
      deletedCommentId: null,
    };
  }

  await db
    .update(comments)
    .set({
      status: "hidden",
      updatedAt: new Date(),
    })
    .where(eq(comments.id, existingComment.id));

  return {
    ok: true,
    message: "코멘트를 삭제했습니다.",
    source: "database",
    mock: false,
    deletedCommentId: existingComment.id,
  };
}

async function createDatabasePlacePriceReport(
  slug: string,
  input: PlacePriceReportInput,
  reporterUserId: string,
): Promise<PlacePriceReportSubmissionResult> {
  const db = getDb();
  const placeRow = await getActivePlaceIdentityBySlug(slug);

  if (!placeRow) {
    return {
      ok: false,
      message: "장소를 찾지 못했습니다.",
      source: "database",
      mock: false,
      item: null,
    };
  }

  const normalizedLabel = normalizePriceLabel(input.label);
  const [matchedPriceItem] = await db
    .select({
      id: priceItems.id,
    })
    .from(priceItems)
    .where(
      and(
        eq(priceItems.placeId, placeRow.id),
        eq(priceItems.normalizedLabel, normalizedLabel),
      ),
    )
    .limit(1);

  const [createdReport] = await db
    .insert(priceReports)
    .values({
      placeId: placeRow.id,
      priceItemId: matchedPriceItem?.id ?? null,
      reporterUserId,
      label: input.label,
      normalizedLabel,
      amount: input.amount,
      currency: "KRW",
      unitLabel: input.unitLabel || null,
      comment: input.comment || null,
      reportStatus: "pending_review",
      snapshotVerificationStatus: "unverified",
    })
    .returning({
      id: priceReports.id,
    });

  return {
    ok: true,
    message: "가격 제보가 접수되었습니다. 운영 검토 후 상세 화면에 반영됩니다.",
    source: "database",
    mock: false,
    item: {
      id: createdReport.id,
      placeId: placeRow.slug,
      placeName: placeRow.name,
      label: input.label,
      amount: input.amount,
      unitLabel: input.unitLabel || undefined,
      comment: input.comment || undefined,
    },
  };
}

async function listDatabasePendingPriceReports(): Promise<PendingPriceReportListResult> {
  const db = getDb();
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
    })),
    source: "database",
  };
}

async function moderateDatabasePriceReport(
  reportId: string,
  input: PriceReportModerationInput,
  adminUserId?: string | null,
): Promise<PriceReportModerationResult> {
  const db = getDb();
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
      source: "database",
      item: null,
    };
  }

  if (existingReport.reportStatus !== "pending_review") {
    return {
      ok: false,
      message: "이미 처리된 가격 제보입니다.",
      source: "database",
      item: null,
    };
  }

  const changedAt = new Date();

  if (input.decision === "reject") {
    await db
      .update(priceReports)
      .set({
        reportStatus: "rejected",
      })
      .where(eq(priceReports.id, existingReport.id));

    await db.insert(adminActions).values({
      adminUserId: adminUserId ?? null,
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
      source: "database",
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
      .select({
        id: priceItems.id,
      })
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

  const acceptedCountRow = await db
    .select({
      count: sql<number>`count(*)::int`,
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

  const nextVerifiedReportCount = (acceptedCountRow[0]?.count ?? 0) + 1;
  const nextVerificationStatus =
    nextVerifiedReportCount >= 2 ? "verified" : "unverified";

  if (matchedPriceItemId) {
    await db
      .update(priceItems)
      .set({
        label: existingReport.label,
        normalizedLabel: existingReport.normalizedLabel,
        amount: existingReport.amount,
        unitLabel: existingReport.unitLabel,
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
        isRepresentative: false,
        verificationStatus: nextVerificationStatus,
        verifiedReportCount: nextVerifiedReportCount,
        latestReportedAt: changedAt,
        createdByUserId: existingReport.reporterUserId ?? null,
      })
      .returning({
        id: priceItems.id,
      });

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
      .set({
        snapshotVerificationStatus: "verified",
      })
      .where(
        and(
          eq(priceReports.placeId, existingReport.placeId),
          eq(priceReports.normalizedLabel, existingReport.normalizedLabel),
          eq(priceReports.amount, existingReport.amount),
          eq(priceReports.reportStatus, "accepted"),
        ),
      );
  }

  await refreshPlacePricingSummary(existingReport.placeId, changedAt);

  const [refreshedPriceItem] = await db
    .select({
      label: priceItems.label,
      amount: priceItems.amount,
      unitLabel: priceItems.unitLabel,
      verificationStatus: priceItems.verificationStatus,
    })
    .from(priceItems)
    .where(eq(priceItems.id, matchedPriceItemId!))
    .limit(1);

  await db.insert(adminActions).values({
    adminUserId: adminUserId ?? null,
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
    source: "database",
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

async function listDatabasePendingPlaces(): Promise<PendingPlaceListResult> {
  const db = getDb();
  const rows = await db
    .select({
      internalId: places.id,
      slug: places.slug,
      name: places.name,
      businessName: places.businessName,
      description: places.description,
      note: places.note,
      roadAddress: places.roadAddress,
      district: places.district,
      latitude: places.latitude,
      longitude: places.longitude,
      representativePriceAmount: places.representativePriceAmount,
      representativePriceLabel: places.representativePriceLabel,
      verifiedPriceItemCount: places.verifiedPriceItemCount,
      lastPriceUpdatedAt: places.lastPriceUpdatedAt,
      createdAt: places.createdAt,
    })
    .from(places)
    .where(eq(places.status, "pending_review"))
    .orderBy(desc(places.createdAt));

  const [categoryMap, priceItemRows] = await Promise.all([
    loadCategoryMap(rows.map((row) => row.internalId)),
    rows.length === 0
      ? Promise.resolve([])
      : db
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
          .where(inArray(priceItems.placeId, rows.map((row) => row.internalId)))
          .orderBy(asc(priceItems.amount), asc(priceItems.label)),
  ]);

  const priceItemsByPlaceId = new Map<string, PlacePriceItem[]>();

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
    source: "database",
  };
}

async function moderateDatabasePlace(
  slug: string,
  input: PlaceModerationInput,
  adminUserId?: string | null,
): Promise<PlaceModerationResult> {
  const db = getDb();
  const [existing] = await db
    .select({
      id: places.id,
      slug: places.slug,
      name: places.name,
      businessName: places.businessName,
      description: places.description,
      note: places.note,
      roadAddress: places.roadAddress,
      district: places.district,
      latitude: places.latitude,
      longitude: places.longitude,
      representativePriceAmount: places.representativePriceAmount,
      representativePriceLabel: places.representativePriceLabel,
      verifiedPriceItemCount: places.verifiedPriceItemCount,
      lastPriceUpdatedAt: places.lastPriceUpdatedAt,
      createdAt: places.createdAt,
    })
    .from(places)
    .where(and(eq(places.slug, slug), eq(places.status, "pending_review")))
    .limit(1);

  if (!existing) {
    return {
      ok: false,
      message: "검토 대상을 찾지 못했습니다.",
      source: "database",
      item: null,
    };
  }

  const nextStatus = input.decision === "approve" ? "active" : "hidden";

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
      updatedAt: new Date(),
    })
    .where(eq(places.id, existing.id));

  await db
    .update(priceReports)
    .set({
      reportStatus:
        input.decision === "approve" ? "accepted" : "rejected",
    })
    .where(eq(priceReports.placeId, existing.id));

  await db.insert(adminActions).values({
    adminUserId: adminUserId ?? null,
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

  const categoryMap = await loadCategoryMap([existing.id]);
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
    source: "database",
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

function listMockPlaces(query: PlaceQuery = {}): PlaceListResult {
  const items = getFilteredPlaces(query);

  return {
    items,
    bounds: items.length > 0 ? getBoundsFromPlaces(items) : query.bounds ?? getMapBounds(),
    source: "mock",
  };
}

function getMockPlaceDetail(id: string): PlaceDetailResult {
  return {
    item: getPlaceById(id),
    related: getRelatedPlaces(id),
    source: "mock",
  };
}

export async function listPlaces(query: PlaceQuery = {}) {
  if (!isDatabaseEnabled()) {
    return listMockPlaces(query);
  }

  try {
    return await listDatabasePlaces(query);
  } catch (error) {
    console.error("Failed to load places from database. Falling back to mock data.", error);
    return listMockPlaces(query);
  }
}

export async function getPlaceDetail(id: string, viewer: PlaceViewer = null) {
  if (!isDatabaseEnabled()) {
    return getMockPlaceDetail(id);
  }

  try {
    return await getDatabasePlaceDetail(id, viewer);
  } catch (error) {
    console.error("Failed to load place detail from database. Falling back to mock data.", error);
    return getMockPlaceDetail(id);
  }
}

export async function createPlaceSubmission(
  input: PlaceSubmissionInput,
  createdByUserId?: string | null,
) {
  if (!isDatabaseEnabled()) {
    return {
      ok: true,
      message:
        "목업 제출이 완료되었습니다. 현재는 DB 연결 없이 payload만 검증하고 있습니다.",
      mock: true,
      source: "mock" as const,
      preview: toFallbackPlacePreview(input),
    };
  }

  try {
    return await createDatabasePlaceSubmission(input, createdByUserId);
  } catch (error) {
    console.error("Failed to persist place submission. Falling back to mock preview.", error);

    return {
      ok: true,
      message:
        "DB에 연결되지 않아 목업 제출로 처리했습니다. 입력값은 검증되었고, 저장만 보류된 상태입니다.",
      mock: true,
      source: "mock" as const,
      preview: toFallbackPlacePreview(input),
    };
  }
}

export async function listPendingPlaces() {
  if (!isDatabaseEnabled()) {
    return {
      items: [] satisfies PendingPlaceRecord[],
      source: "mock" as const,
    };
  }

  try {
    return await listDatabasePendingPlaces();
  } catch (error) {
    console.error("Failed to load pending place submissions.", error);

    return {
      items: [] satisfies PendingPlaceRecord[],
      source: "database" as const,
    };
  }
}

export async function moderatePlaceSubmission(
  slug: string,
  input: PlaceModerationInput,
  adminUserId?: string | null,
) {
  if (!isDatabaseEnabled()) {
    return {
      ok: true,
      message: "목업 모드에서는 장소 검토 결과가 실제 저장되지 않습니다.",
      source: "mock" as const,
      item: null,
    };
  }

  try {
    return await moderateDatabasePlace(slug, input, adminUserId);
  } catch (error) {
    console.error("Failed to moderate place submission.", error);

    return {
      ok: false,
      message: "장소 검토 처리에 실패했습니다.",
      source: "database" as const,
      item: null,
    };
  }
}

export async function createPlaceComment(
  slug: string,
  input: PlaceCommentInput,
  userId: string,
) {
  if (!isDatabaseEnabled()) {
    return {
      ok: true,
      message: "목업 코멘트를 등록했습니다. 현재는 새로고침 전까지만 유지됩니다.",
      source: "mock" as const,
      mock: true,
      item: {
        id: `mock-comment-${Date.now()}`,
        authorLabel: "나",
        body: input.body,
        createdAt: formatDate(new Date()),
        canDelete: true,
      },
    };
  }

  try {
    return await createDatabasePlaceComment(slug, input, userId);
  } catch (error) {
    console.error("Failed to create place comment.", error);

    return {
      ok: false,
      message: "코멘트 등록에 실패했습니다.",
      source: "database" as const,
      mock: false,
      item: null,
    };
  }
}

export async function deletePlaceComment(
  slug: string,
  commentId: string,
  viewer: NonNullable<PlaceViewer>,
) {
  if (!isDatabaseEnabled()) {
    return {
      ok: true,
      message: "목업 코멘트를 삭제했습니다.",
      source: "mock" as const,
      mock: true,
      deletedCommentId: commentId,
    };
  }

  try {
    return await hideDatabasePlaceComment(slug, commentId, viewer);
  } catch (error) {
    console.error("Failed to delete place comment.", error);

    return {
      ok: false,
      message: "코멘트 삭제에 실패했습니다.",
      source: "database" as const,
      mock: false,
      deletedCommentId: null,
    };
  }
}

export async function createPlacePriceReport(
  slug: string,
  input: PlacePriceReportInput,
  reporterUserId: string,
) {
  if (!isDatabaseEnabled()) {
    return {
      ok: true,
      message:
        "목업 가격 제보가 접수되었습니다. 현재는 관리자 큐에 실제 저장되지 않습니다.",
      source: "mock" as const,
      mock: true,
      item: {
        id: `mock-price-report-${Date.now()}`,
        placeId: slug,
        placeName: slug,
        label: input.label,
        amount: input.amount,
        unitLabel: input.unitLabel || undefined,
        comment: input.comment || undefined,
      },
    };
  }

  try {
    return await createDatabasePlacePriceReport(slug, input, reporterUserId);
  } catch (error) {
    console.error("Failed to create place price report.", error);

    return {
      ok: false,
      message: "가격 제보 저장에 실패했습니다.",
      source: "database" as const,
      mock: false,
      item: null,
    };
  }
}

export async function listPendingPriceReports() {
  if (!isDatabaseEnabled()) {
    return {
      items: [] satisfies PendingPriceReportRecord[],
      source: "mock" as const,
    };
  }

  try {
    return await listDatabasePendingPriceReports();
  } catch (error) {
    console.error("Failed to load pending price reports.", error);

    return {
      items: [] satisfies PendingPriceReportRecord[],
      source: "database" as const,
    };
  }
}

export async function moderatePriceReport(
  reportId: string,
  input: PriceReportModerationInput,
  adminUserId?: string | null,
) {
  if (!isDatabaseEnabled()) {
    return {
      ok: true,
      message: "목업 모드에서는 가격 제보 검토 결과가 실제 저장되지 않습니다.",
      source: "mock" as const,
      item: null,
    };
  }

  try {
    return await moderateDatabasePriceReport(reportId, input, adminUserId);
  } catch (error) {
    console.error("Failed to moderate price report.", error);

    return {
      ok: false,
      message: "가격 제보 검토 처리에 실패했습니다.",
      source: "database" as const,
      item: null,
    };
  }
}
