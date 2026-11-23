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
  PlaceMapClusterMarkerRecord,
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
} from "@/worker/places/places-read-mappers";
import {
  getBoundsFromPlaces,
  getCappedMapListItems,
  getClusterOnlyMapMarkers,
  getMapMarkerLimit,
  getMapMarkerMode,
  getPlaceOnlyMapMarkers,
  getStableClusterCellSize,
  MAP_CLUSTER_PREVIEW_PLACE_LIMIT,
  MAP_LIST_ITEM_LIMIT,
} from "@/worker/places/places-read-markers";
import type {
  DatabasePlaceRow,
  PlaceQuery,
  WorkerMapPlacesResult,
} from "@/worker/places/places-read-types";

const MAP_QUERY_ROW_LIMIT = 2_000;

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

/**
 * 조건에 맞는 전체 건수를 LIMIT과 무관하게 각 행에 실어 보낸다(window count).
 * 건수 쿼리를 따로 보내면 DB 왕복이 한 번 더 늘고, 먼 DB에서는 그 한 번이 약 0.4초다.
 */
const totalCountField = sql<number>`(count(*) over ())::int`;

type ViewportClusterCell = {
  cellKey: string;
  placeCount: number;
  latitude: number;
  longitude: number;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  minPriceAmount: number | null;
};

type ViewportRows =
  | { kind: "place"; rows: Array<DatabasePlaceRow & { totalCount: number }>; total: number }
  | {
      kind: "cluster";
      rows: DatabasePlaceRow[];
      cells: ViewportClusterCell[];
      previewRows: Array<DatabasePlaceRow & { cellKey: string }>;
      total: number;
    };

/**
 * viewport 지도 조회를 쿼리 한 번으로 끝낸다. 먼 DB에서는 왕복과 전송량이 지연의 대부분이라,
 * 결과 모드에 따라 필요한 것만 DB에서 만들어 돌려준다.
 * - 전체 건수 <= markerLimit: 개별 장소 마커이므로 전체 행(작다).
 * - 그보다 많으면 클러스터 모드: 전체 행 수백 건 대신 목록용 상위 N건과 격자(cell) 집계만 보낸다.
 * 격자 키는 JS 클러스터링(getClusterOnlyMapMarkers)과 같은 floor(좌표 / 간격)이다.
 */
async function loadDatabaseViewportRows(
  env: WorkerDatabaseBindings,
  params: {
    whereClause: SQL | undefined;
    markerLimit: number;
    sort: PlaceSort;
    latSpan: number;
    lngSpan: number;
  },
): Promise<ViewportRows> {
  const db = getWorkerDb(env);
  const where = params.whereClause ?? sql`true`;
  const order = sql.join(getDatabaseMapPlaceOrder(params.sort), sql`, `);
  const columns = sql`
    places.id as "internalId", places.slug, places.name, places.business_name as "businessName",
    places.description, places.note, places.road_address as "roadAddress", places.district,
    places.latitude, places.longitude, places.primary_category_slug as "primaryCategorySlug",
    places.representative_price_amount as "representativePriceAmount",
    places.representative_price_label as "representativePriceLabel",
    places.like_count as "likeCount", places.dislike_count as "dislikeCount",
    places.verified_price_item_count as "verifiedPriceItemCount",
    places.last_price_updated_at as "lastPriceUpdatedAt"`;
  const result = await db.execute<{
    kind: "full" | "top" | "cell" | "preview";
    total: number;
    payload: Record<string, unknown>;
  }>(sql`
    with f as (select ${columns} from places where ${where}),
    n as (select count(*)::int as c from f)
    select 'full' as kind, n.c as total, to_jsonb(f.*) as payload
      from f, n where n.c <= ${params.markerLimit}
    union all
    select 'top', n.c, to_jsonb(t.*)
      from (
        select ${columns} from places where ${where} order by ${order} limit ${MAP_LIST_ITEM_LIMIT}
      ) t, n
      where n.c > ${params.markerLimit}
    union all
    select 'preview', n.c, to_jsonb(p.*)
      from (
        select f.*,
               floor(f.latitude / ${params.latSpan})::bigint || ':' || floor(f.longitude / ${params.lngSpan})::bigint as "cellKey",
               count(*) over (partition by floor(f.latitude / ${params.latSpan}), floor(f.longitude / ${params.lngSpan})) as "cellCount"
        from f
      ) p, n
      where n.c > ${params.markerLimit} and p."cellCount" <= ${MAP_CLUSTER_PREVIEW_PLACE_LIMIT}
    union all
    select 'cell', n.c, jsonb_build_object(
        'cellKey', c.row_idx || ':' || c.col_idx,
        'placeCount', c.cnt, 'latitude', c.avg_lat, 'longitude', c.avg_lng,
        'minLat', c.min_lat, 'maxLat', c.max_lat, 'minLng', c.min_lng, 'maxLng', c.max_lng,
        'minPriceAmount', c.min_price)
      from (
        select floor(f.latitude / ${params.latSpan})::bigint as row_idx,
               floor(f.longitude / ${params.lngSpan})::bigint as col_idx,
               count(*)::int as cnt, avg(f.latitude) as avg_lat, avg(f.longitude) as avg_lng,
               min(f.latitude) as min_lat, max(f.latitude) as max_lat,
               min(f.longitude) as min_lng, max(f.longitude) as max_lng,
               min(nullif(f."representativePriceAmount", 0)) as min_price
        from f group by 1, 2
      ) c, n
      where n.c > ${params.markerLimit}
  `);
  const rows = [...result];
  const total = Number(rows[0]?.total ?? 0);

  if (rows.some((row) => row.kind === "cell") || (total > params.markerLimit)) {
    return {
      kind: "cluster",
      total,
      rows: rows
        .filter((row) => row.kind === "top")
        .map((row) => row.payload as unknown as DatabasePlaceRow),
      cells: rows
        .filter((row) => row.kind === "cell")
        .map((row) => row.payload as unknown as ViewportClusterCell),
      previewRows: rows
        .filter((row) => row.kind === "preview")
        .map((row) => row.payload as unknown as DatabasePlaceRow & { cellKey: string })
        .sort(
          (left, right) =>
            Number(left.latitude) - Number(right.latitude) ||
            Number(left.longitude) - Number(right.longitude) ||
            left.internalId.localeCompare(right.internalId),
        ),
    };
  }

  return {
    kind: "place",
    total,
    rows: rows
      .filter((row) => row.kind === "full")
      .map((row) => ({ ...(row.payload as unknown as DatabasePlaceRow), totalCount: total })),
  };
}

function toClusterMarkers(
  cells: ViewportClusterCell[],
  previewRows: Array<DatabasePlaceRow & { cellKey: string }>,
): PlaceMapClusterMarkerRecord[] {
  // 작은 클러스터(<= MAP_CLUSTER_PREVIEW_PLACE_LIMIT)는 클릭 즉시 보여 줄 장소를 함께 싣는다.
  const previewByCell = new Map<string, DatabasePlaceRow[]>();

  for (const row of previewRows) {
    previewByCell.set(row.cellKey, [...(previewByCell.get(row.cellKey) ?? []), row]);
  }

  return [...cells]
    .sort((left, right) => left.cellKey.localeCompare(right.cellKey))
    .map((cell) => ({
      kind: "cluster" as const,
      id: `cluster:${cell.cellKey}`,
      latitude: Number(cell.latitude),
      longitude: Number(cell.longitude),
      bounds: {
        minLat: Number(cell.minLat),
        maxLat: Number(cell.maxLat),
        minLng: Number(cell.minLng),
        maxLng: Number(cell.maxLng),
      },
      placeCount: Number(cell.placeCount),
      ...(cell.minPriceAmount ? { minPriceAmount: Number(cell.minPriceAmount) } : {}),
      ...(previewByCell.has(cell.cellKey)
        ? { previewPlaces: toPlacePreviewRecords(previewByCell.get(cell.cellKey) ?? []) }
        : {}),
    }));
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
    .select({ ...mapPlaceSelectFields, totalCount: totalCountField })
    .from(places)
    .where(params.whereClause)
    .orderBy(...getDatabaseMapPlaceOrder(params.sort));

  if (typeof params.limit === "number") {
    return queryBuilder.limit(params.limit);
  }

  return queryBuilder;
}

export async function listDatabaseMapPlaces(
  env: WorkerDatabaseBindings,
  {
    category,
    sort = "price",
    bounds,
    query,
    skipCache = false,
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
      zoom,
    });
    const cached = cacheKey && !skipCache
      ? getCachedMapPreviewResult<WorkerMapPlacesResult>(cacheKey)
      : null;

    if (cached) {
      return {
        ...cached,
        cacheStatus: "hit",
      };
    }

    const { latSpan, lngSpan } = getStableClusterCellSize(zoom, null);
    const loaded = await loadDatabaseViewportRows(env, {
      whereClause,
      markerLimit,
      sort,
      latSpan,
      lngSpan,
    });
    const count = loaded.total;
    let items: ReturnType<typeof toPlacePreviewRecords>;
    let mapMarkers: WorkerMapPlacesResult["mapMarkers"];
    const markerMode = loaded.kind === "cluster" ? "cluster" : "place";

    if (loaded.kind === "cluster") {
      // 목록은 정렬 기준 앞쪽 상위 N건(DB가 이미 정렬해 보냄), 마커는 격자 집계다.
      items = toPlacePreviewRecords(loaded.rows);
      mapMarkers = toClusterMarkers(loaded.cells, loaded.previewRows);
    } else {
      const sorted = sortPlacePreviewRecords(
        toPlacePreviewRecords(loaded.rows.slice(0, MAP_QUERY_ROW_LIMIT)),
        sort,
      );

      items = getCappedMapListItems(sorted);
      mapMarkers = getPlaceOnlyMapMarkers(sorted, zoom, null);
    }

    const result = {
      items,
      mapMarkers,
      markerMode,
      bounds,
      count,
      source: "database",
      cacheStatus: "miss",
    } satisfies WorkerMapPlacesResult;

    if (cacheKey && !skipCache) {
      setCachedMapPreviewResult(cacheKey, result);
    }

    return result;
  }

  const rows = await loadDatabaseMapPlaceRows(env, {
    whereClause,
    sort,
    limit: MAP_QUERY_ROW_LIMIT + 1,
  });
  const count = Number(rows[0]?.totalCount ?? 0);
  const mapped = sortPlacePreviewRecords(
    toPlacePreviewRecords(rows.slice(0, MAP_QUERY_ROW_LIMIT)),
    sort,
  );
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
