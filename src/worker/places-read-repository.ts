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
import {
  buildMapPreviewCacheKey,
  getCachedMapPreviewResult,
  setCachedMapPreviewResult,
} from "@/features/places/map-preview-cache";
import type {
  PlaceQueryBounds,
  PlaceReactionType,
  PlaceSort,
} from "@/features/places/types";
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
import {
  formatDate,
  sortPlacePreviewRecords,
  toAuthorLabel,
  toPlacePreviewRecords,
  toPlaceRecord,
} from "@/worker/places-read-mappers";
import {
  getBoundsFromPlaces,
  getCappedMapListItems,
  getClusterOnlyMapMarkers,
  getMapMarkerLimit,
  getMapMarkerMode,
  getPlaceOnlyMapMarkers,
} from "@/worker/places-read-markers";
import {
  getMockPlaceDetail,
  listMockMapPlaces,
} from "@/worker/places-read-mock";
import type {
  PlaceQuery,
  WorkerMapPlacesResult,
  WorkerPlaceDetailResult,
  WorkerPlaceViewer,
} from "@/worker/places-read-types";
export type { WorkerPlaceViewer } from "@/worker/places-read-types";

const MAP_MARKER_SUMMARY_ROW_LIMIT = 2_000;

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
