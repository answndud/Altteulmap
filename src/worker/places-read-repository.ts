import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  comments,
  placeReactions,
  places,
  priceItems,
  priceReports,
  users,
} from "@/db/schema";
import type {
  PlaceBounds,
  PlaceComment,
  PlaceHistoryEntry,
  PlaceMapClusterMarkerRecord,
  PlaceMapMarkerRecord,
  PlaceMapMarkerMode,
  PlaceMapPlaceMarkerRecord,
  PlacePreviewRecord,
  PlacePriceItem,
  PlaceQueryBounds,
  PlaceReactionType,
  PlaceRecord,
  PlaceSort,
} from "@/features/places/types";
import {
  buildMapPreviewCacheKey,
  getCachedMapPreviewResult,
  setCachedMapPreviewResult,
} from "@/features/places/map-preview-cache";
import {
  assertWorkerDatabaseReadEnabled,
  getWorkerDb,
  isWorkerDatabaseEnabled,
  isWorkerMockDataEnabled,
  markWorkerDatabaseUnavailable,
  WorkerDatabaseUnavailableError,
  type WorkerDatabaseBindings,
  withWorkerDatabaseReadTimeout,
} from "@/worker/db";

type DataSource = "database" | "mock";

export type WorkerPlaceViewer = {
  role: "user" | "admin" | "guest";
  userId?: string | null;
  visitorId?: string | null;
} | null;

type PlaceQuery = {
  category?: string | null;
  sort?: PlaceSort;
  bounds?: PlaceQueryBounds | null;
  query?: string | null;
  zoom?: number | null;
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
  primaryCategorySlug: string | null;
  representativePriceAmount: number | null;
  representativePriceLabel: string | null;
  likeCount: number;
  dislikeCount: number;
  verifiedPriceItemCount: number;
  lastPriceUpdatedAt: Date | null;
};

type WorkerMapPlacesResult = {
  items: PlacePreviewRecord[];
  mapMarkers: Array<PlaceMapPlaceMarkerRecord | PlaceMapClusterMarkerRecord>;
  markerMode: PlaceMapMarkerMode;
  bounds: PlaceBounds | null;
  count: number;
  source: DataSource;
  cacheStatus: "bypass" | "hit" | "miss";
};

type WorkerPlaceDetailResult = {
  item: PlaceRecord | null;
  source: DataSource;
};

const MAP_LIST_RESPONSE_LIMIT = 120;
const MAP_MARKER_SUMMARY_ROW_LIMIT = 2_000;
const MAP_CLUSTER_PREVIEW_PLACE_LIMIT = 40;

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
});

const mapPlaceSelectFields = {
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
  primaryCategorySlug: places.primaryCategorySlug,
  representativePriceAmount: places.representativePriceAmount,
  representativePriceLabel: places.representativePriceLabel,
  likeCount: places.likeCount,
  dislikeCount: places.dislikeCount,
  verifiedPriceItemCount: places.verifiedPriceItemCount,
  lastPriceUpdatedAt: places.lastPriceUpdatedAt,
};

function sortPlacePreviewRecords(items: PlacePreviewRecord[], sort: PlaceSort) {
  return [...items].sort((left, right) => {
    if (sort === "recent") {
      return (
        new Date(right.lastPriceUpdatedAt).getTime() -
        new Date(left.lastPriceUpdatedAt).getTime()
      );
    }

    return left.representativePriceAmount - right.representativePriceAmount;
  });
}

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

function toPlacePreviewRecord(
  row: DatabasePlaceRow,
  reactionSummary?: {
    likeCount: number;
    dislikeCount: number;
    viewerReaction: PlaceReactionType | null;
  },
): PlacePreviewRecord {
  const resolvedReactionSummary = reactionSummary ?? {
    likeCount: row.likeCount,
    dislikeCount: row.dislikeCount,
    viewerReaction: null,
  };

  return {
    id: row.slug,
    name: row.name,
    businessName: row.businessName ?? undefined,
    categorySlug: row.primaryCategorySlug ?? "other-service",
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
      "아직 장소 설명이 등록되지 않았습니다. 이후 정보가 쌓이면 내용을 보강할 수 있습니다.",
    note:
      row.note ??
      "운영 검토 전 단계이거나 추가 메모가 아직 등록되지 않았습니다.",
    likeCount: resolvedReactionSummary.likeCount,
    dislikeCount: resolvedReactionSummary.dislikeCount,
    viewerReaction: resolvedReactionSummary.viewerReaction,
  };
}

function toPlaceRecord(
  row: DatabasePlaceRow,
  detail?: {
    comments?: PlaceComment[];
    history?: PlaceHistoryEntry[];
    priceItems?: PlacePriceItem[];
    reactionSummary?: {
      likeCount: number;
      dislikeCount: number;
      viewerReaction: PlaceReactionType | null;
    };
  },
): PlaceRecord {
  return {
    ...toPlacePreviewRecord(row, detail?.reactionSummary),
    priceItems: detail?.priceItems ?? [],
    history: detail?.history ?? [],
    comments: detail?.comments ?? [],
  };
}

function getBoundsFromPlaces(
  items: Array<Pick<PlacePreviewRecord, "latitude" | "longitude">>,
): PlaceBounds {
  const latitudes = items.map((place) => place.latitude);
  const longitudes = items.map((place) => place.longitude);

  return {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLng: Math.min(...longitudes),
    maxLng: Math.max(...longitudes),
  };
}

function getCappedMapListItems(items: PlacePreviewRecord[]) {
  return items.slice(0, MAP_LIST_RESPONSE_LIMIT);
}

function toMapPlaceMarkerRecord(
  place: PlacePreviewRecord,
): PlaceMapPlaceMarkerRecord {
  return {
    kind: "place",
    ...place,
  };
}

function getMapMarkerLimit(zoom: number | null, query: string | null) {
  if (query?.trim()) {
    if (!zoom) {
      return 40;
    }

    if (zoom >= 15) {
      return 80;
    }

    if (zoom >= 14) {
      return 56;
    }

    return 48;
  }

  if (!zoom) {
    return 36;
  }

  if (zoom >= 15) {
    return 96;
  }

  if (zoom >= 14) {
    return 64;
  }

  if (zoom >= 13) {
    return 48;
  }

  if (zoom >= 12) {
    return 32;
  }

  return 24;
}

function getMapMarkerMode(
  itemCount: number,
  zoom: number | null,
  query: string | null,
): PlaceMapMarkerMode {
  if (query?.trim()) {
    return "place";
  }

  return itemCount <= getMapMarkerLimit(zoom, query) ? "place" : "cluster";
}

function getPlaceOnlyMapMarkers(
  items: PlacePreviewRecord[],
  zoom: number | null,
  query: string | null,
) {
  return items
    .slice(0, getMapMarkerLimit(zoom, query))
    .map(toMapPlaceMarkerRecord);
}

function getStableClusterCellSize(
  zoom: number | null,
  query: string | null,
) {
  if (query?.trim()) {
    return { latSpan: 0.018, lngSpan: 0.025 };
  }

  if (!zoom || zoom <= 10) {
    return { latSpan: 0.11, lngSpan: 0.14 };
  }

  if (zoom <= 11) {
    return { latSpan: 0.075, lngSpan: 0.1 };
  }

  if (zoom <= 12) {
    return { latSpan: 0.055, lngSpan: 0.075 };
  }

  if (zoom <= 13) {
    return { latSpan: 0.04, lngSpan: 0.055 };
  }

  if (zoom <= 14) {
    return { latSpan: 0.028, lngSpan: 0.038 };
  }

  return { latSpan: 0.018, lngSpan: 0.025 };
}

function getClusterOnlyMapMarkers(
  items: PlacePreviewRecord[],
  _bounds: PlaceBounds,
  query: string | null,
  zoom: number | null,
): PlaceMapMarkerRecord[] {
  const { latSpan, lngSpan } = getStableClusterCellSize(zoom, query);
  const cells = new Map<string, PlacePreviewRecord[]>();

  for (const place of items) {
    const rowIndex = Math.floor(place.latitude / latSpan);
    const columnIndex = Math.floor(place.longitude / lngSpan);
    const cellKey = `${rowIndex}:${columnIndex}`;
    const bucket = cells.get(cellKey) ?? [];

    bucket.push(place);
    cells.set(cellKey, bucket);
  }

  return [...cells.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([cellKey, bucket]) => {
      return {
        kind: "cluster",
        id: `cluster:${cellKey}`,
        latitude:
          bucket.reduce((sum, place) => sum + place.latitude, 0) /
          bucket.length,
        longitude:
          bucket.reduce((sum, place) => sum + place.longitude, 0) /
          bucket.length,
        bounds: getBoundsFromPlaces(bucket),
        placeCount: bucket.length,
        previewPlaces:
          bucket.length <= MAP_CLUSTER_PREVIEW_PLACE_LIMIT ? bucket : undefined,
      };
    });
}

function getDatabaseMapPlaceWhereClause({
  category,
  bounds,
  normalizedQuery,
}: {
  category?: string | null;
  bounds?: PlaceQueryBounds | null;
  normalizedQuery?: string | null;
}) {
  const conditions: SQL[] = [
    eq(places.status, "active"),
    isNotNull(places.latitude),
    isNotNull(places.longitude),
  ];

  if (category) {
    conditions.push(eq(places.primaryCategorySlug, category));
  }

  if (normalizedQuery) {
    const queryPattern = `%${normalizedQuery}%`;
    const queryClause = or(
      ilike(places.name, queryPattern),
      ilike(places.businessName, queryPattern),
      ilike(places.roadAddress, queryPattern),
      ilike(places.district, queryPattern),
      ilike(places.representativePriceLabel, queryPattern),
      ilike(places.description, queryPattern),
      ilike(places.note, queryPattern),
    );

    if (queryClause) {
      conditions.push(queryClause);
    }
  }

  if (bounds) {
    conditions.push(gte(places.latitude, bounds.minLat));
    conditions.push(lte(places.latitude, bounds.maxLat));
    conditions.push(gte(places.longitude, bounds.minLng));
    conditions.push(lte(places.longitude, bounds.maxLng));
  }

  return and(...conditions);
}

function getDatabaseMapPlaceOrder(sort: PlaceSort) {
  return sort === "recent"
    ? [desc(places.lastPriceUpdatedAt), desc(places.updatedAt)]
    : [asc(places.representativePriceAmount), desc(places.updatedAt)];
}

function toPlacePreviewRecords(rows: DatabasePlaceRow[]) {
  return rows
    .map((row) => toPlacePreviewRecord(row))
    .filter(
      (place) =>
        Number.isFinite(place.latitude) && Number.isFinite(place.longitude),
    );
}

async function loadDatabaseMapPlaceRows(
  env: WorkerDatabaseBindings,
  params: {
    whereClause: SQL | undefined;
    sort: PlaceSort;
    limit?: number;
  },
) {
  const db = getWorkerDb(env);
  const queryBuilder = db
    .select(mapPlaceSelectFields)
    .from(places)
    .where(params.whereClause)
    .orderBy(...getDatabaseMapPlaceOrder(params.sort));

  if (typeof params.limit === "number") {
    return queryBuilder.limit(params.limit);
  }

  return queryBuilder;
}

async function loadDatabaseMapMarkerRows(
  env: WorkerDatabaseBindings,
  params: {
    whereClause: SQL | undefined;
    limit: number;
  },
) {
  const db = getWorkerDb(env);

  return db
    .select(mapPlaceSelectFields)
    .from(places)
    .where(params.whereClause)
    .orderBy(asc(places.latitude), asc(places.longitude), asc(places.id))
    .limit(params.limit);
}

async function countDatabaseMapPlaces(
  env: WorkerDatabaseBindings,
  whereClause: SQL | undefined,
) {
  const db = getWorkerDb(env);
  const [countRow] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(places)
    .where(whereClause);

  return Number(countRow?.count ?? 0);
}

async function listDatabaseMapPlaces(
  env: WorkerDatabaseBindings,
  {
    category,
    sort = "price",
    bounds,
    query,
    zoom = null,
  }: PlaceQuery = {},
): Promise<WorkerMapPlacesResult> {
  const normalizedQuery = query?.trim() || null;
  const whereClause = getDatabaseMapPlaceWhereClause({
    category,
    bounds,
    normalizedQuery,
  });
  if (bounds && !normalizedQuery) {
    const markerLimit = getMapMarkerLimit(zoom, null);
    const cacheKey = buildMapPreviewCacheKey({
      bounds,
      category,
      markerLimit,
      normalizedQuery,
      sort,
    });
    const cached = cacheKey
      ? getCachedMapPreviewResult<WorkerMapPlacesResult>(cacheKey)
      : null;

    if (cached) {
      return {
        ...cached,
        cacheStatus: "hit",
      };
    }

    const markerRows = await loadDatabaseMapMarkerRows(env, {
      whereClause,
      limit: MAP_MARKER_SUMMARY_ROW_LIMIT,
    });
    const mapped = toPlacePreviewRecords(markerRows);
    const count =
      markerRows.length < MAP_MARKER_SUMMARY_ROW_LIMIT
        ? mapped.length
        : await countDatabaseMapPlaces(env, whereClause);
    const sorted = sortPlacePreviewRecords(mapped, sort);
    const items = getCappedMapListItems(sorted);
    const markerMode = getMapMarkerMode(count, zoom, null);
    const mapMarkers =
      markerMode === "place"
        ? getPlaceOnlyMapMarkers(sorted, zoom, null)
        : getClusterOnlyMapMarkers(
            mapped,
            bounds,
            null,
            zoom,
          );

    const result = {
      items,
      mapMarkers,
      markerMode,
      bounds,
      count,
      source: "database",
      cacheStatus: "miss",
    } satisfies WorkerMapPlacesResult;

    if (cacheKey) {
      setCachedMapPreviewResult(cacheKey, result);
    }

    return result;
  }

  const db = getWorkerDb(env);
  const countPromise = db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(places)
    .where(whereClause);
  const [countRows, rows] = await Promise.all([
    countPromise,
    loadDatabaseMapPlaceRows(env, {
      whereClause,
      sort,
    }),
  ]);
  const count = Number(countRows[0]?.count ?? 0);
  const mapped = sortPlacePreviewRecords(toPlacePreviewRecords(rows), sort);
  const resultBounds =
    mapped.length > 0 ? getBoundsFromPlaces(mapped) : bounds ?? null;
  const markerMode = getMapMarkerMode(count, zoom, normalizedQuery);
  const mapMarkers =
    markerMode === "place"
      ? getPlaceOnlyMapMarkers(mapped, zoom, normalizedQuery)
      : resultBounds
        ? getClusterOnlyMapMarkers(mapped, resultBounds, normalizedQuery, zoom)
        : [];

  return {
    items: getCappedMapListItems(mapped),
    mapMarkers,
    markerMode,
    bounds: resultBounds,
    count,
    source: "database",
    cacheStatus: "bypass",
  };
}

async function listMockMapPlaces(query: PlaceQuery = {}) {
  const { getFilteredPlaces, getMapBounds } = await import(
    "@/features/places/queries"
  );
  const allItems = getFilteredPlaces(query).map((place) =>
    toPlacePreviewRecord({
      internalId: place.id,
      slug: place.id,
      name: place.name,
      businessName: place.businessName ?? null,
      description: place.description,
      note: place.note,
      roadAddress: place.address,
      district: place.district,
      latitude: place.latitude,
      longitude: place.longitude,
      primaryCategorySlug: place.categorySlug,
      representativePriceAmount: place.representativePriceAmount,
      representativePriceLabel: place.representativePriceLabel,
      likeCount: place.likeCount,
      dislikeCount: place.dislikeCount,
      verifiedPriceItemCount: place.verificationStatus === "verified" ? 1 : 0,
      lastPriceUpdatedAt: new Date(place.lastPriceUpdatedAt),
    }),
  );
  const items = getCappedMapListItems(allItems);
  const mapMarkers = items.map(toMapPlaceMarkerRecord);

  return {
    items,
    mapMarkers,
    markerMode: "place",
    bounds: items.length > 0 ? getMapBounds() : query.bounds ?? null,
    count: allItems.length,
    source: "mock",
    cacheStatus: "bypass",
  } satisfies WorkerMapPlacesResult;
}

export async function listWorkerMapPlaces(
  env: WorkerDatabaseBindings,
  query: PlaceQuery = {},
) {
  if (!isWorkerDatabaseEnabled(env)) {
    if (isWorkerMockDataEnabled(env)) {
      return listMockMapPlaces(query);
    }

    assertWorkerDatabaseReadEnabled(env, "listWorkerMapPlaces");
  }

  try {
    return await withWorkerDatabaseReadTimeout(env, "listWorkerMapPlaces", () =>
      listDatabaseMapPlaces(env, query),
    );
  } catch (error) {
    markWorkerDatabaseUnavailable();
    console.error(
      "Failed to load worker map places from database.",
      error,
    );
    throw new WorkerDatabaseUnavailableError(
      "지도 장소 목록을 운영 DB에서 불러오지 못했습니다.",
    );
  }
}

async function loadViewerReactionMap(
  env: WorkerDatabaseBindings,
  placeId: string,
  viewer: WorkerPlaceViewer,
) {
  if (!viewer?.userId && !viewer?.visitorId) {
    return new Map<string, PlaceReactionType>();
  }

  const db = getWorkerDb(env);
  const rows = await db
    .select({
      placeId: placeReactions.placeId,
      reactionType: placeReactions.reactionType,
    })
    .from(placeReactions)
    .where(
      and(
        eq(placeReactions.placeId, placeId),
        viewer.userId
          ? eq(placeReactions.userId, viewer.userId)
          : eq(placeReactions.visitorId, viewer.visitorId ?? ""),
      ),
    );

  return new Map(rows.map((row) => [row.placeId, row.reactionType]));
}

async function getDatabasePlaceDetail(
  env: WorkerDatabaseBindings,
  slug: string,
  viewer: WorkerPlaceViewer,
): Promise<WorkerPlaceDetailResult> {
  const db = getWorkerDb(env);
  const [row] = await db
    .select(mapPlaceSelectFields)
    .from(places)
    .where(and(eq(places.slug, slug), eq(places.status, "active")))
    .limit(1);

  if (!row) {
    return {
      item: null,
      source: "database",
    };
  }

  const [priceItemRows, historyRows, commentRows, viewerReactionMap] =
    await Promise.all([
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
        .where(
          and(eq(priceItems.placeId, row.internalId), eq(priceItems.isActive, true)),
        )
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
          visitorId: comments.visitorId,
          body: comments.body,
          createdAt: comments.createdAt,
          nickname: users.nickname,
          email: users.email,
        })
        .from(comments)
        .leftJoin(users, eq(comments.userId, users.id))
        .where(and(eq(comments.placeId, row.internalId), eq(comments.status, "visible")))
        .orderBy(desc(comments.createdAt)),
      loadViewerReactionMap(env, row.internalId, viewer),
    ]);

  return {
    item: toPlaceRecord(row, {
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
        authorLabel: toAuthorLabel(comment.nickname, comment.email, "익명"),
        body: comment.body,
        createdAt: formatDate(comment.createdAt),
        canDelete:
          viewer?.role === "admin" ||
          (Boolean(comment.userId) && viewer?.userId === comment.userId) ||
          (Boolean(comment.visitorId) && viewer?.visitorId === comment.visitorId),
      })),
      reactionSummary: {
        likeCount: row.likeCount,
        dislikeCount: row.dislikeCount,
        viewerReaction: viewerReactionMap.get(row.internalId) ?? null,
      },
    }),
    source: "database",
  };
}

async function getMockPlaceDetail(
  slug: string,
  viewer: WorkerPlaceViewer,
): Promise<WorkerPlaceDetailResult> {
  const { getPlaceById } = await import("@/features/places/queries");
  const place = getPlaceById(slug);

  if (!place) {
    return {
      item: null,
      source: "mock",
    };
  }

  return {
    item: {
      ...place,
      comments: place.comments.map((comment) => ({
        ...comment,
        canDelete: viewer?.role === "admin" || comment.canDelete,
      })),
    },
    source: "mock",
  };
}

export async function getWorkerPlaceDetail(
  env: WorkerDatabaseBindings,
  slug: string,
  viewer: WorkerPlaceViewer,
) {
  if (!isWorkerDatabaseEnabled(env)) {
    if (isWorkerMockDataEnabled(env)) {
      return getMockPlaceDetail(slug, viewer);
    }

    assertWorkerDatabaseReadEnabled(env, "getWorkerPlaceDetail");
  }

  try {
    return await withWorkerDatabaseReadTimeout(env, "getWorkerPlaceDetail", () =>
      getDatabasePlaceDetail(env, slug, viewer),
    );
  } catch (error) {
    markWorkerDatabaseUnavailable();
    console.error(
      "Failed to load worker place detail from database.",
      error,
    );
    throw new WorkerDatabaseUnavailableError(
      "장소 상세 정보를 운영 DB에서 불러오지 못했습니다.",
    );
  }
}
