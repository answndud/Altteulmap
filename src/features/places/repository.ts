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
  ne,
  or,
  sql,
} from "drizzle-orm";

import { getDb, isDatabaseEnabled } from "@/db/client";
import {
  adminActions,
  categories,
  comments,
  placeCategories,
  placeReactions,
  places,
  priceItems,
  priceReports,
  users,
} from "@/db/schema";
import { mockPlaces } from "@/features/places/catalog-data";
import {
  normalizePriceLabel,
  slugifyPlaceName,
} from "@/features/places/normalization";
import {
  getFilteredPlaces,
  getMapBounds,
  getPlaceById,
  sortPlaceRecords,
} from "@/features/places/queries";
import type {
  PlaceModerationInput,
  PlaceSubmissionInput,
} from "@/features/submission/schema";
import type {
  AdminPriceItemUpdateInput,
  PlaceCommentInput,
  PlacePriceReportInput,
  PriceReportModerationInput,
} from "@/features/places/write-schema";
import type {
  PlaceComment,
  PlaceBounds,
  PlaceHistoryEntry,
  PlaceMapClusterMarkerRecord,
  PlaceMapMarkerRecord,
  PlaceMapPlaceMarkerRecord,
  PlacePriceItem,
  PlacePreviewRecord,
  PlaceQueryBounds,
  PlaceReactionType,
  PlaceRecord,
  PlaceSort,
} from "@/features/places/types";

export type DataSource = "mock" | "database";

export type PlaceQuery = {
  category?: string | null;
  maxPrice?: number | null;
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

type MapTileAggregateRow = {
  rowIndex: number;
  columnIndex: number;
  placeCount: number;
  latitude: number;
  longitude: number;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  slug: string | null;
  name: string | null;
  businessName: string | null;
  description: string | null;
  note: string | null;
  roadAddress: string | null;
  district: string | null;
  primaryCategorySlug: string | null;
  representativePriceAmount: number | null;
  representativePriceLabel: string | null;
  likeCount: number | null;
  dislikeCount: number | null;
  verifiedPriceItemCount: number | null;
  lastPriceUpdatedAt: Date | null;
};

export type PlaceListResult = {
  items: PlaceRecord[];
  bounds: PlaceBounds;
  source: DataSource;
};

export type PlacePreviewListResult = {
  items: PlacePreviewRecord[];
  mapMarkers: PlaceMapMarkerRecord[];
  bounds: PlaceBounds;
  count: number;
  source: DataSource;
};

const MAP_LIST_RESPONSE_LIMIT = 120;

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

export type PlaceDetailResult = {
  item: PlaceRecord | null;
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
  role: "user" | "admin" | "guest";
  userId?: string | null;
  visitorId?: string | null;
} | null;

type PlaceReactionActor = {
  userId?: string | null;
  visitorId?: string | null;
  email?: string | null;
  name?: string | null;
} | null;

type PlaceCommentActor = {
  userId?: string | null;
  visitorId?: string | null;
  email?: string | null;
  name?: string | null;
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

export type PlaceReactionActionResult = {
  ok: boolean;
  message: string;
  source: DataSource;
  reaction: PlaceReactionType | null;
  likeCount: number;
  dislikeCount: number;
  placeId: string;
};

export type AdminPriceItemRecord = {
  id: string;
  label: string;
  amount: number;
  unitLabel?: string;
  verificationStatus: "verified" | "unverified";
  verifiedReportCount: number;
  reportedAt: string;
  isRepresentative: boolean;
  isActive: boolean;
};

export type AdminPlacePriceDetailResult = {
  item: {
    id: string;
    name: string;
    district: string;
    representativePriceAmount: number;
    representativePriceLabel: string;
    verificationStatus: "verified" | "unverified";
    priceItems: AdminPriceItemRecord[];
  } | null;
  source: DataSource;
};

export type AdminPriceItemUpdateResult = {
  ok: boolean;
  message: string;
  source: DataSource;
  item: AdminPriceItemRecord | null;
  placeId: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
});

const globalMockReactionStore = globalThis as typeof globalThis & {
  __altteulmapMockPlaceReactions?: Map<string, PlaceReactionType>;
};

type PlaceReactionSummary = {
  likeCount: number;
  dislikeCount: number;
  viewerReaction: PlaceReactionType | null;
};

function formatDate(value: Date | null) {
  return value ? dateFormatter.format(value) : "";
}

function getMockReactionStore() {
  if (!globalMockReactionStore.__altteulmapMockPlaceReactions) {
    globalMockReactionStore.__altteulmapMockPlaceReactions = new Map();
  }

  return globalMockReactionStore.__altteulmapMockPlaceReactions;
}

function getReactionViewerKey(
  viewer: Pick<NonNullable<PlaceViewer>, "userId" | "visitorId"> | null,
) {
  if (viewer?.userId) {
    return `user:${viewer.userId}`;
  }

  if (viewer?.visitorId) {
    return `visitor:${viewer.visitorId}`;
  }

  return null;
}

function getReactionActorKey(actor: PlaceReactionActor) {
  return getReactionViewerKey(actor);
}

function createEmptyReactionSummary(): PlaceReactionSummary {
  return {
    likeCount: 0,
    dislikeCount: 0,
    viewerReaction: null,
  };
}

function getMockReactionSummary(
  placeId: string,
  viewerKey?: string | null,
): PlaceReactionSummary {
  const place = mockPlaces.find((item) => item.id === placeId);

  if (!place) {
    return createEmptyReactionSummary();
  }

  const summary: PlaceReactionSummary = {
    likeCount: place.likeCount,
    dislikeCount: place.dislikeCount,
    viewerReaction: null,
  };
  const store = getMockReactionStore();

  for (const [key, reaction] of store.entries()) {
    const [, storedPlaceId] = key.split(":");

    if (storedPlaceId !== placeId) {
      continue;
    }

    if (reaction === "like") {
      summary.likeCount += 1;
    } else {
      summary.dislikeCount += 1;
    }
  }

  if (viewerKey) {
    summary.viewerReaction = store.get(`${viewerKey}:${placeId}`) ?? null;
  }

  return summary;
}

async function loadViewerReactionMap(
  placeIds: string[],
  viewer: PlaceViewer = null,
) {
  const viewerReactionMap = new Map<string, PlaceReactionType>();

  if (placeIds.length === 0 || !viewer) {
    return viewerReactionMap;
  }

  const db = getDb();
  const viewerRows = await db
    .select({
      placeId: placeReactions.placeId,
      reactionType: placeReactions.reactionType,
    })
    .from(placeReactions)
    .where(
      and(
        inArray(placeReactions.placeId, placeIds),
        viewer.userId
          ? eq(placeReactions.userId, viewer.userId)
          : eq(placeReactions.visitorId, viewer.visitorId ?? ""),
      ),
    );

  for (const row of viewerRows) {
    viewerReactionMap.set(row.placeId, row.reactionType);
  }

  return viewerReactionMap;
}

async function refreshPlaceReactionSummary(placeId: string) {
  const db = getDb();
  const countRows = await db
    .select({
      reactionType: placeReactions.reactionType,
      count: sql<number>`count(*)::int`,
    })
    .from(placeReactions)
    .where(eq(placeReactions.placeId, placeId))
    .groupBy(placeReactions.reactionType);

  const summary = createEmptyReactionSummary();

  for (const row of countRows) {
    const count = Number(row.count) || 0;

    if (row.reactionType === "like") {
      summary.likeCount = count;
    } else {
      summary.dislikeCount = count;
    }
  }

  await db
    .update(places)
    .set({
      likeCount: summary.likeCount,
      dislikeCount: summary.dislikeCount,
      updatedAt: new Date(),
    })
    .where(eq(places.id, placeId));

  return summary;
}

type PriceSummaryItem = {
  id: string;
  label: string;
  amount: number;
  latestReportedAt: Date | null;
  verificationStatus: "verified" | "unverified";
  isRepresentative: boolean;
};

function selectRepresentativePriceItem(items: PriceSummaryItem[]) {
  if (items.length === 0) {
    return null;
  }

  const byLatestDesc = (left: PriceSummaryItem, right: PriceSummaryItem) => {
    const leftTime = left.latestReportedAt?.getTime() ?? 0;
    const rightTime = right.latestReportedAt?.getTime() ?? 0;

    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    if (left.amount !== right.amount) {
      return left.amount - right.amount;
    }

    return left.label.localeCompare(right.label, "ko");
  };

  const representativeVerified = items
    .filter(
      (item) => item.isRepresentative && item.verificationStatus === "verified",
    )
    .sort(byLatestDesc)[0];

  if (representativeVerified) {
    return representativeVerified;
  }

  const representativeUnverified = items
    .filter(
      (item) =>
        item.isRepresentative && item.verificationStatus === "unverified",
    )
    .sort(byLatestDesc)[0];

  if (representativeUnverified) {
    return representativeUnverified;
  }

  return [...items].sort((left, right) => {
    if (left.amount !== right.amount) {
      return left.amount - right.amount;
    }

    return byLatestDesc(left, right);
  })[0];
}

function getBoundsFromPlaces(
  items: Array<Pick<PlacePreviewRecord, "latitude" | "longitude">>,
): PlaceBounds {
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

function getMapTileGrid(bounds: PlaceBounds, markerLimit: number) {
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.0001);
  const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.0001);
  const aspectRatio = Math.max(lngSpan / latSpan, 0.65);
  const columnCount = Math.max(
    1,
    Math.round(Math.sqrt(markerLimit * aspectRatio)),
  );
  const rowCount = Math.max(1, Math.ceil(markerLimit / columnCount));

  return {
    latSpan,
    lngSpan,
    rowCount,
    columnCount,
  };
}

function getDatabaseMapPlaceWhereClause({
  category,
  maxPrice,
  bounds,
  normalizedQuery,
}: {
  category?: string | null;
  maxPrice?: number | null;
  bounds?: PlaceQueryBounds | null;
  normalizedQuery?: string | null;
}) {
  const conditions = [
    eq(places.status, "active"),
    isNotNull(places.latitude),
    isNotNull(places.longitude),
  ];

  if (maxPrice) {
    conditions.push(lte(places.representativePriceAmount, maxPrice));
  }

  if (category) {
    conditions.push(eq(places.primaryCategorySlug, category));
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

  return and(...conditions);
}

function getDatabaseMapPlaceOrder(sort: PlaceSort) {
  return sort === "recent"
    ? [desc(places.lastPriceUpdatedAt), desc(places.updatedAt)]
    : [asc(places.representativePriceAmount), desc(places.updatedAt)];
}

async function loadDatabaseMapPlaceRows(params: {
  whereClause: ReturnType<typeof and>;
  sort: PlaceSort;
  limit?: number;
}) {
  const db = getDb();
  let queryBuilder = db
    .select(mapPlaceSelectFields)
    .from(places)
    .where(params.whereClause)
    .orderBy(...getDatabaseMapPlaceOrder(params.sort));

  if (typeof params.limit === "number") {
    queryBuilder = queryBuilder.limit(params.limit);
  }

  return queryBuilder;
}

function toPlacePreviewRecords(rows: DatabasePlaceRow[]) {
  return rows
    .map((row) => toPlacePreviewRecord(row, row.primaryCategorySlug))
    .filter((place) => place.latitude && place.longitude);
}

function toDatabaseRowFromTileAggregate(
  row: MapTileAggregateRow,
): DatabasePlaceRow | null {
  if (
    !row.slug ||
    !row.name ||
    !row.roadAddress ||
    !row.district ||
    row.representativePriceAmount === null ||
    row.representativePriceLabel === null ||
    row.likeCount === null ||
    row.dislikeCount === null ||
    row.verifiedPriceItemCount === null
  ) {
    return null;
  }

  return {
    internalId: row.slug,
    slug: row.slug,
    name: row.name,
    businessName: row.businessName,
    description: row.description,
    note: row.note,
    roadAddress: row.roadAddress,
    district: row.district,
    latitude: row.latitude,
    longitude: row.longitude,
    primaryCategorySlug: row.primaryCategorySlug,
    representativePriceAmount: row.representativePriceAmount,
    representativePriceLabel: row.representativePriceLabel,
    likeCount: row.likeCount,
    dislikeCount: row.dislikeCount,
    verifiedPriceItemCount: row.verifiedPriceItemCount,
    lastPriceUpdatedAt: row.lastPriceUpdatedAt,
  };
}

async function loadDatabaseMapTileMarkers(params: {
  whereClause: ReturnType<typeof and>;
  bounds: PlaceBounds;
  zoom: number | null;
}) {
  const markerLimit = getMapMarkerLimit(params.zoom, null);
  const { latSpan, lngSpan, rowCount, columnCount } = getMapTileGrid(
    params.bounds,
    markerLimit,
  );
  const rowIndexExpression = sql<number>`
    least(
      ${rowCount - 1},
      greatest(
        0,
        floor(((${places.latitude} - ${params.bounds.minLat}) / ${latSpan}) * ${rowCount})::int
      )
    )
  `;
  const columnIndexExpression = sql<number>`
    least(
      ${columnCount - 1},
      greatest(
        0,
        floor(((${places.longitude} - ${params.bounds.minLng}) / ${lngSpan}) * ${columnCount})::int
      )
    )
  `;
  const db = getDb();
  const rows = await db
    .select({
      rowIndex: rowIndexExpression,
      columnIndex: columnIndexExpression,
      placeCount: sql<number>`count(*)::int`,
      latitude: sql<number>`avg(${places.latitude})::float8`,
      longitude: sql<number>`avg(${places.longitude})::float8`,
      minLat: sql<number>`min(${places.latitude})::float8`,
      maxLat: sql<number>`max(${places.latitude})::float8`,
      minLng: sql<number>`min(${places.longitude})::float8`,
      maxLng: sql<number>`max(${places.longitude})::float8`,
      slug: sql<string | null>`min(${places.slug})`,
      name: sql<string | null>`min(${places.name})`,
      businessName: sql<string | null>`min(${places.businessName})`,
      description: sql<string | null>`min(${places.description})`,
      note: sql<string | null>`min(${places.note})`,
      roadAddress: sql<string | null>`min(${places.roadAddress})`,
      district: sql<string | null>`min(${places.district})`,
      primaryCategorySlug: sql<string | null>`min(${places.primaryCategorySlug})`,
      representativePriceAmount: sql<number | null>`min(${places.representativePriceAmount})::int`,
      representativePriceLabel: sql<string | null>`min(${places.representativePriceLabel})`,
      likeCount: sql<number | null>`min(${places.likeCount})::int`,
      dislikeCount: sql<number | null>`min(${places.dislikeCount})::int`,
      verifiedPriceItemCount: sql<number | null>`min(${places.verifiedPriceItemCount})::int`,
      lastPriceUpdatedAt: sql<Date | null>`max(${places.lastPriceUpdatedAt})`,
    })
    .from(places)
    .where(params.whereClause)
    .groupBy(rowIndexExpression, columnIndexExpression)
    .orderBy(asc(rowIndexExpression), asc(columnIndexExpression));

  return rows.map((row) => {
    if (row.placeCount === 1) {
      const singletonRow = toDatabaseRowFromTileAggregate(row);

      if (!singletonRow) {
        return {
          kind: "cluster",
          id: `cluster:${row.rowIndex}:${row.columnIndex}:${row.placeCount}`,
          latitude: row.latitude,
          longitude: row.longitude,
          bounds: {
            minLat: row.minLat,
            maxLat: row.maxLat,
            minLng: row.minLng,
            maxLng: row.maxLng,
          },
          placeCount: row.placeCount,
        } satisfies PlaceMapClusterMarkerRecord;
      }

      return toMapPlaceMarkerRecord(
        toPlacePreviewRecord(singletonRow, singletonRow.primaryCategorySlug),
      );
    }

    return {
      kind: "cluster",
      id: `cluster:${row.rowIndex}:${row.columnIndex}:${row.placeCount}`,
      latitude: row.latitude,
      longitude: row.longitude,
      bounds: {
        minLat: row.minLat,
        maxLat: row.maxLat,
        minLng: row.minLng,
        maxLng: row.maxLng,
      },
      placeCount: row.placeCount,
    } satisfies PlaceMapClusterMarkerRecord;
  }) as PlaceMapMarkerRecord[];
}

function getTileSummarizedMapMarkers(
  items: PlacePreviewRecord[],
  bounds: PlaceBounds,
  query: string | null,
  zoom: number | null,
) {
  const markerLimit = getMapMarkerLimit(zoom, query);

  if (items.length <= markerLimit || query?.trim()) {
    return items
      .slice(0, markerLimit)
      .map((place) => toMapPlaceMarkerRecord(place)) as PlaceMapMarkerRecord[];
  }

  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.0001);
  const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.0001);
  const aspectRatio = Math.max(lngSpan / latSpan, 0.65);
  const columnCount = Math.max(
    1,
    Math.round(Math.sqrt(markerLimit * aspectRatio)),
  );
  const rowCount = Math.max(1, Math.ceil(markerLimit / columnCount));
  const cells = new Map<string, PlacePreviewRecord[]>();

  for (const place of items) {
    const rowIndex = Math.min(
      rowCount - 1,
      Math.floor(((place.latitude - bounds.minLat) / latSpan) * rowCount),
    );
    const columnIndex = Math.min(
      columnCount - 1,
      Math.floor(((place.longitude - bounds.minLng) / lngSpan) * columnCount),
    );
    const cellKey = `${rowIndex}:${columnIndex}`;
    const bucket = cells.get(cellKey) ?? [];

    bucket.push(place);
    cells.set(cellKey, bucket);
  }

  const mapMarkers: PlaceMapMarkerRecord[] = [];

  for (const [cellKey, bucket] of cells.entries()) {
    if (bucket.length === 1) {
      mapMarkers.push(toMapPlaceMarkerRecord(bucket[0]));
      continue;
    }

    const latitude =
      bucket.reduce((sum, place) => sum + place.latitude, 0) / bucket.length;
    const longitude =
      bucket.reduce((sum, place) => sum + place.longitude, 0) / bucket.length;

    mapMarkers.push({
      kind: "cluster",
      id: `cluster:${cellKey}:${bucket.length}`,
      latitude,
      longitude,
      bounds: getBoundsFromPlaces(bucket),
      placeCount: bucket.length,
    } satisfies PlaceMapClusterMarkerRecord);
  }

  return mapMarkers;
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

function toAdminPriceItemRecord(item: {
  id: string;
  label: string;
  amount: number;
  unitLabel: string | null;
  verificationStatus: "verified" | "unverified";
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

function toPlacePreviewRecord(
  row: DatabasePlaceRow,
  categorySlug: string | null | undefined,
  reactionSummary?: PlaceReactionSummary,
): PlacePreviewRecord {
  const resolvedReactionSummary =
    reactionSummary ??
    ({
      likeCount: row.likeCount,
      dislikeCount: row.dislikeCount,
      viewerReaction: null,
    } satisfies PlaceReactionSummary);

  return {
    id: row.slug,
    name: row.name,
    businessName: row.businessName ?? undefined,
    categorySlug: row.primaryCategorySlug ?? categorySlug ?? "other-service",
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
  categorySlug: string | null | undefined,
  detail?: {
    comments?: PlaceComment[];
    history?: PlaceHistoryEntry[];
    priceItems?: PlacePriceItem[];
    reactionSummary?: PlaceReactionSummary;
  },
): PlaceRecord {
  const preview = toPlacePreviewRecord(
    row,
    categorySlug,
    detail?.reactionSummary,
  );

  return {
    ...preview,
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

  if (category) {
    conditions.push(eq(places.primaryCategorySlug, category));
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
      primaryCategorySlug: places.primaryCategorySlug,
      representativePriceAmount: places.representativePriceAmount,
      representativePriceLabel: places.representativePriceLabel,
      likeCount: places.likeCount,
      dislikeCount: places.dislikeCount,
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

  const mapped = sortPlaceRecords(
    rows
      .map((row) => toPlaceRecord(row, row.primaryCategorySlug))
      .filter((place) =>
        category ? place.categorySlug === category : true,
      ),
    sort,
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

function toMapPreviewRecord(place: PlaceRecord): PlacePreviewRecord {
  return {
    id: place.id,
    name: place.name,
    businessName: place.businessName,
    categorySlug: place.categorySlug,
    address: place.address,
    district: place.district,
    latitude: place.latitude,
    longitude: place.longitude,
    representativePriceAmount: place.representativePriceAmount,
    representativePriceLabel: place.representativePriceLabel,
    verificationStatus: place.verificationStatus,
    lastPriceUpdatedAt: place.lastPriceUpdatedAt,
    description: place.description,
    note: place.note,
    likeCount: place.likeCount,
    dislikeCount: place.dislikeCount,
    viewerReaction: place.viewerReaction,
  };
}

async function listDatabaseMapPlaces({
  category,
  maxPrice,
  sort = "price",
  bounds,
  query,
  zoom = null,
}: PlaceQuery = {}): Promise<PlacePreviewListResult> {
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

  if (category) {
    conditions.push(eq(places.primaryCategorySlug, category));
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
      primaryCategorySlug: places.primaryCategorySlug,
      representativePriceAmount: places.representativePriceAmount,
      representativePriceLabel: places.representativePriceLabel,
      likeCount: places.likeCount,
      dislikeCount: places.dislikeCount,
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

  const mapped = sortPlaceRecords(
    rows
      .map((row) => toPlacePreviewRecord(row, row.primaryCategorySlug))
      .filter((place) => (category ? place.categorySlug === category : true)),
    sort,
  );
  const boundsForResult =
    mapped.length > 0 ? getBoundsFromPlaces(mapped) : bounds ?? getMapBounds();
  const items = getCappedMapListItems(mapped);
  const mapMarkers = getTileSummarizedMapMarkers(
    mapped,
    boundsForResult,
    normalizedQuery ?? null,
    zoom,
  );

  return {
    items,
    mapMarkers,
    bounds: boundsForResult,
    count: mapped.length,
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
      primaryCategorySlug: places.primaryCategorySlug,
      representativePriceAmount: places.representativePriceAmount,
      representativePriceLabel: places.representativePriceLabel,
      likeCount: places.likeCount,
      dislikeCount: places.dislikeCount,
      verifiedPriceItemCount: places.verifiedPriceItemCount,
      lastPriceUpdatedAt: places.lastPriceUpdatedAt,
    })
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
      loadViewerReactionMap([row.internalId], viewer),
    ]);

  const item = toPlaceRecord(row, row.primaryCategorySlug, {
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
  });

  return {
    item,
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

function getPlaceReactionMessage(reaction: PlaceReactionType | null) {
  if (reaction === "like") {
    return "좋아요를 남겼습니다.";
  }

  if (reaction === "dislike") {
    return "싫어요를 남겼습니다.";
  }

  return "반응을 취소했습니다.";
}

function setMockPlaceReaction(
  placeSlug: string,
  reaction: PlaceReactionType | null,
  actor: PlaceReactionActor,
): PlaceReactionActionResult {
  const actorKey = getReactionActorKey(actor);

  if (!actorKey) {
    return {
      ok: false,
      source: "mock",
      reaction: null,
      likeCount: 0,
      dislikeCount: 0,
      message: "반응 대상을 확인하지 못했습니다.",
      placeId: placeSlug,
    };
  }

  const place = getPlaceById(placeSlug);

  if (!place) {
    return {
      ok: false,
      source: "mock",
      reaction: null,
      likeCount: 0,
      dislikeCount: 0,
      message: "장소를 찾지 못했습니다.",
      placeId: placeSlug,
    };
  }

  const store = getMockReactionStore();
  const key = `${actorKey}:${placeSlug}`;

  if (reaction) {
    store.set(key, reaction);
  } else {
    store.delete(key);
  }

  const summary = getMockReactionSummary(placeSlug, actorKey);

  return {
    ok: true,
    source: "mock",
    reaction: summary.viewerReaction,
    likeCount: summary.likeCount,
    dislikeCount: summary.dislikeCount,
    message: getPlaceReactionMessage(summary.viewerReaction),
    placeId: placeSlug,
  };
}

async function setDatabasePlaceReaction(
  placeSlug: string,
  reaction: PlaceReactionType | null,
  actor: PlaceReactionActor,
): Promise<PlaceReactionActionResult> {
  const actorKey = getReactionActorKey(actor);

  if (!actorKey) {
    return {
      ok: false,
      source: "database",
      reaction: null,
      likeCount: 0,
      dislikeCount: 0,
      message: "반응 대상을 확인하지 못했습니다.",
      placeId: placeSlug,
    };
  }

  const place = await getActivePlaceIdentityBySlug(placeSlug);

  if (!place) {
    return {
      ok: false,
      source: "database",
      reaction: null,
      likeCount: 0,
      dislikeCount: 0,
      message: "장소를 찾지 못했습니다.",
      placeId: placeSlug,
    };
  }

  const db = getDb();

  if (reaction) {
    await db
      .insert(placeReactions)
      .values({
        userId: actor?.userId ?? null,
        visitorId: actor?.visitorId ?? null,
        placeId: place.id,
        reactionType: reaction,
      })
      .onConflictDoUpdate({
        target:
          actor?.userId
            ? [placeReactions.userId, placeReactions.placeId]
            : [placeReactions.visitorId, placeReactions.placeId],
        set: {
          reactionType: reaction,
          updatedAt: new Date(),
        },
      });
  } else {
    await db
      .delete(placeReactions)
      .where(
        and(
          eq(placeReactions.placeId, place.id),
          actor?.userId
            ? eq(placeReactions.userId, actor.userId)
            : eq(placeReactions.visitorId, actor?.visitorId ?? ""),
        ),
      );
  }

  const summary = await refreshPlaceReactionSummary(place.id);
  summary.viewerReaction = reaction;

  return {
    ok: true,
    source: "database",
    reaction: summary.viewerReaction,
    likeCount: summary.likeCount,
    dislikeCount: summary.dislikeCount,
    message: getPlaceReactionMessage(summary.viewerReaction),
    placeId: placeSlug,
  };
}

async function refreshPlacePricingSummary(placeId: string, changedAt: Date) {
  const db = getDb();
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
      latitude: null,
      longitude: null,
      status: "pending_review",
      primaryCategorySlug: input.categorySlug,
      representativePriceAmount: input.priceItems[representativeIndex].amount,
      representativePriceLabel: input.priceItems[representativeIndex].label,
      likeCount: 0,
      dislikeCount: 0,
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
        isActive: true,
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
    message: "장소 등록 요청이 접수되었습니다. 검토 후 공개 목록에 반영됩니다.",
    mock: false,
    source: "database",
    preview: {
      id: createdPlace.slug,
      name: input.name,
      categorySlug: input.categorySlug,
      roadAddress: input.roadAddress,
      district: input.district,
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
  actor: PlaceCommentActor,
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
      userId: actor?.userId ?? null,
      visitorId: actor?.visitorId ?? null,
      body: input.body,
      status: "visible",
    })
    .returning({
      id: comments.id,
      createdAt: comments.createdAt,
    });

  return {
    ok: true,
    message: "코멘트를 등록했습니다.",
    source: "database",
    mock: false,
    item: {
      id: createdComment.id,
      authorLabel: actor?.userId
        ? toAuthorLabel(actor.name ?? null, actor.email ?? null, "나")
        : "익명",
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
      visitorId: comments.visitorId,
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

  const canDeleteAsOwner =
    (Boolean(existingComment.userId) && existingComment.userId === viewer.userId) ||
    (Boolean(existingComment.visitorId) &&
      existingComment.visitorId === viewer.visitorId);

  if (viewer.role !== "admin" && !canDeleteAsOwner) {
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
  reporterUserId?: string | null,
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
      reporterUserId: reporterUserId ?? null,
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

async function getDatabaseAdminPlacePriceDetail(
  slug: string,
): Promise<AdminPlacePriceDetailResult> {
  const db = getDb();
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
      source: "database",
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
    source: "database",
  };
}

async function updateDatabasePriceItem(
  itemId: string,
  input: AdminPriceItemUpdateInput,
  adminUserId?: string | null,
): Promise<AdminPriceItemUpdateResult> {
  const db = getDb();
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
      source: "database",
      item: null,
      placeId: null,
    };
  }

  const normalizedLabel = normalizePriceLabel(input.label);
  const [duplicateItem] = await db
    .select({
      id: priceItems.id,
    })
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
      source: "database",
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

  await refreshPlacePricingSummary(existingItem.placeId, changedAt);

  await db.insert(adminActions).values({
    adminUserId: adminUserId ?? null,
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
    source: "database",
    item: toAdminPriceItemRecord(updatedItem),
    placeId: existingItem.placeSlug,
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
      primaryCategorySlug: places.primaryCategorySlug,
      representativePriceAmount: places.representativePriceAmount,
      representativePriceLabel: places.representativePriceLabel,
      likeCount: places.likeCount,
      dislikeCount: places.dislikeCount,
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
      primaryCategorySlug: places.primaryCategorySlug,
      representativePriceAmount: places.representativePriceAmount,
      representativePriceLabel: places.representativePriceLabel,
      likeCount: places.likeCount,
      dislikeCount: places.dislikeCount,
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

function getMockPlaceDetail(id: string, viewer: PlaceViewer = null): PlaceDetailResult {
  const place = getPlaceById(id);
  const viewerKey = getReactionViewerKey(viewer);

  return {
    item: place
      ? {
          ...place,
          ...getMockReactionSummary(id, viewerKey),
        }
      : null,
    source: "mock",
  };
}

function getMockAdminPlacePriceDetail(id: string): AdminPlacePriceDetailResult {
  const place = getPlaceById(id);

  if (!place) {
    return {
      item: null,
      source: "mock",
    };
  }

  return {
    item: {
      id: place.id,
      name: place.name,
      district: place.district,
      representativePriceAmount: place.representativePriceAmount,
      representativePriceLabel: place.representativePriceLabel,
      verificationStatus: place.verificationStatus,
      priceItems: place.priceItems.map((item) => ({
        ...item,
        verifiedReportCount: item.verificationStatus === "verified" ? 2 : 0,
        isRepresentative: item.label === place.representativePriceLabel,
        isActive: true,
      })),
    },
    source: "mock",
  };
}

function listMockMapPlaces(query: PlaceQuery = {}): PlacePreviewListResult {
  const allItems = getFilteredPlaces(query).map(toMapPreviewRecord);
  const bounds =
    allItems.length > 0
      ? getBoundsFromPlaces(allItems)
      : query.bounds ?? getMapBounds();
  const items = getCappedMapListItems(allItems);
  const mapMarkers = getTileSummarizedMapMarkers(
    allItems,
    bounds,
    query.query ?? null,
    query.zoom ?? null,
  );

  return {
    items,
    mapMarkers,
    bounds,
    count: allItems.length,
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

export async function listMapPlaces(
  query: PlaceQuery = {},
): Promise<PlacePreviewListResult> {
  if (!isDatabaseEnabled()) {
    return listMockMapPlaces(query);
  }

  try {
    return await listDatabaseMapPlaces(query);
  } catch (error) {
    console.error(
      "Failed to load map places from database. Falling back to mock data.",
      error,
    );
    return listMockMapPlaces(query);
  }
}

export async function getPlaceDetail(id: string, viewer: PlaceViewer = null) {
  if (!isDatabaseEnabled()) {
    return getMockPlaceDetail(id, viewer);
  }

  try {
    return await getDatabasePlaceDetail(id, viewer);
  } catch (error) {
    console.error("Failed to load place detail from database. Falling back to mock data.", error);
    return getMockPlaceDetail(id, viewer);
  }
}

export async function setPlaceReaction(
  placeSlug: string,
  reaction: PlaceReactionType | null,
  actor: PlaceReactionActor,
) {
  if (!getReactionActorKey(actor)) {
    return {
      ok: false,
      source: isDatabaseEnabled() ? ("database" as const) : ("mock" as const),
      reaction: null,
      likeCount: 0,
      dislikeCount: 0,
      message: "반응 대상을 확인하지 못했습니다.",
      placeId: placeSlug,
    };
  }

  if (!isDatabaseEnabled()) {
    return setMockPlaceReaction(placeSlug, reaction, actor);
  }

  try {
    return await setDatabasePlaceReaction(placeSlug, reaction, actor);
  } catch (error) {
    console.error("Failed to update place reaction.", error);

    return {
      ok: false,
      source: "database" as const,
      reaction: null,
      likeCount: 0,
      dislikeCount: 0,
      message: "반응 업데이트에 실패했습니다.",
      placeId: placeSlug,
    };
  }
}

export async function createPlaceSubmission(
  input: PlaceSubmissionInput,
  createdByUserId?: string | null,
) {
  if (!isDatabaseEnabled()) {
    return {
      ok: true,
      message: "장소 등록 요청이 접수되었습니다. 검토 후 공개 목록에 반영됩니다.",
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
      message: "장소 등록 요청이 접수되었습니다. 검토 후 공개 목록에 반영됩니다.",
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
  actor: PlaceCommentActor,
) {
  if (!isDatabaseEnabled()) {
    return {
      ok: true,
      message: "코멘트를 등록했습니다.",
      source: "mock" as const,
      mock: true,
      item: {
        id: `mock-comment-${Date.now()}`,
        authorLabel: actor?.userId ? "나" : "익명",
        body: input.body,
        createdAt: formatDate(new Date()),
        canDelete: true,
      },
    };
  }

  try {
    return await createDatabasePlaceComment(slug, input, actor);
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
      message: "코멘트를 삭제했습니다.",
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
  reporterUserId?: string | null,
) {
  if (!isDatabaseEnabled()) {
    return {
      ok: true,
      message: "가격 제보가 접수되었습니다. 검토 후 상세 화면에 반영됩니다.",
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

export async function getAdminPlacePriceDetail(id: string) {
  if (!isDatabaseEnabled()) {
    return getMockAdminPlacePriceDetail(id);
  }

  try {
    return await getDatabaseAdminPlacePriceDetail(id);
  } catch (error) {
    console.error("Failed to load admin place price detail.", error);

    return getMockAdminPlacePriceDetail(id);
  }
}

export async function updatePriceItem(
  itemId: string,
  input: AdminPriceItemUpdateInput,
  adminUserId?: string | null,
) {
  if (!isDatabaseEnabled()) {
    return {
      ok: true,
      message: input.isActive
        ? "목업 가격 항목을 업데이트했습니다."
        : "목업 가격 항목을 숨겼습니다.",
      source: "mock" as const,
      item: {
        id: itemId,
        label: input.label,
        amount: input.amount,
        unitLabel: input.unitLabel || undefined,
        verificationStatus: input.verificationStatus,
        verifiedReportCount: input.verificationStatus === "verified" ? 2 : 0,
        reportedAt: formatDate(new Date()),
        isRepresentative: input.isRepresentative,
        isActive: input.isActive,
      },
      placeId: null,
    };
  }

  try {
    return await updateDatabasePriceItem(itemId, input, adminUserId);
  } catch (error) {
    console.error("Failed to update price item.", error);

    return {
      ok: false,
      message: "가격 항목 업데이트에 실패했습니다.",
      source: "database" as const,
      item: null,
      placeId: null,
    };
  }
}
