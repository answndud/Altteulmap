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

import { places } from "@/db/schema";
import {
  buildMapPreviewCacheKey,
  getCachedMapPreviewResult,
  setCachedMapPreviewResult,
} from "@/features/places/map-preview-cache";
import type {
  PlaceQueryBounds,
  PlaceSort,
} from "@/features/places/types";
import {
  getWorkerDb,
  type WorkerDatabaseBindings,
} from "@/worker/db";
import {
  sortPlacePreviewRecords,
  toPlacePreviewRecords,
} from "@/worker/places-read-mappers";
import {
  getBoundsFromPlaces,
  getCappedMapListItems,
  getClusterOnlyMapMarkers,
  getMapMarkerLimit,
  getMapMarkerMode,
  getPlaceOnlyMapMarkers,
} from "@/worker/places-read-markers";
import type {
  PlaceQuery,
  WorkerMapPlacesResult,
} from "@/worker/places-read-types";

const MAP_MARKER_SUMMARY_ROW_LIMIT = 2_000;
const MAP_GLOBAL_QUERY_ROW_LIMIT = 2_000;

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

export async function listDatabaseMapPlaces(
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
      limit: MAP_GLOBAL_QUERY_ROW_LIMIT,
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
