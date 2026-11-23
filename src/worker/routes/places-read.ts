import type { AssetFetcher } from "@/worker/http/bindings";
import type { Hono } from "hono";

import type { PlaceBounds, PlaceSearchScope } from "@/features/places/types";
import {
  getWorkerPlaceDetail,
  listWorkerMapPlaces,
  type WorkerPlaceViewer,
} from "@/worker/places/places-read-repository";
import { getSessionFromRequest } from "@/worker/auth/session";
import { getVerifiedVisitorIdFromRequest } from "@/worker/abuse/public-write-actor";

type PlacesReadBindings = {
  ASSETS: AssetFetcher;
  AUTH_SECRET?: string;
  DATABASE_URL?: string;
  HYPERDRIVE?: {
    connectionString?: string;
  };
  USE_MOCK_DATA?: string;
};

type PlacesReadVariables = {
  requestId: string;
};

type PlacesReadRouteDependencies = {
  databaseUnavailableResponse(message: string): Response;
  getMockComments(placeId: string, visitorId: string | null): unknown[];
  isWorkerDatabaseUnavailableError(error: unknown): boolean;
  noStoreHeaders: Record<string, string>;
};

const MAX_MAP_QUERY_LENGTH = 120;

function parseFiniteNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseMapBounds(searchParams: URLSearchParams): PlaceBounds | null {
  const minLat = parseFiniteNumber(searchParams.get("minLat"));
  const maxLat = parseFiniteNumber(searchParams.get("maxLat"));
  const minLng = parseFiniteNumber(searchParams.get("minLng"));
  const maxLng = parseFiniteNumber(searchParams.get("maxLng"));

  if (minLat === null || maxLat === null || minLng === null || maxLng === null) {
    return null;
  }

  if (
    minLat < -90 ||
    maxLat > 90 ||
    minLng < -180 ||
    maxLng > 180 ||
    minLat > maxLat ||
    minLng > maxLng ||
    maxLat - minLat > 30 ||
    maxLng - minLng > 60
  ) {
    return null;
  }

  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
  };
}

function isMapPreviewEdgeCacheable({
  bounds,
  query,
  searchScope,
}: {
  bounds: PlaceBounds | null;
  query: string | null;
  searchScope: PlaceSearchScope;
}) {
  return searchScope === "viewport" && Boolean(bounds) && !query;
}

// 첫 화면(서울 bootstrap bounds)은 모든 방문자가 같은 URL을 요청하고, 한국 방문자는 같은 콜로로 들어오므로
// 캐시 적중률이 높다. 가격 승인이 반영되기까지 최대 이 시간만큼 지연될 수 있다.
const MAP_EDGE_CACHE_SECONDS = 60;
// 쿠키 없는 익명 상세만 캐시한다. 반응·코멘트 삭제 권한처럼 사용자별 값이 없어 모두에게 같은 응답이다.
const DETAIL_EDGE_CACHE_SECONDS = 20;

function isAnonymousDetailEdgeCacheable(request: Request) {
  return !request.headers.get("cookie");
}

async function getEdgeCacheResponse(
  request: Request,
  noStoreHeaders: Record<string, string>,
  statusHeader: string,
) {
  if (typeof caches === "undefined") {
    return null;
  }

  const edgeCache = (caches as CacheStorage & { default?: Cache }).default;

  if (!edgeCache) {
    return null;
  }

  const cached = await edgeCache.match(request).catch(() => null);

  if (!cached) {
    return null;
  }

  const headers = new Headers(cached.headers);
  headers.set("Cache-Control", noStoreHeaders["Cache-Control"]);
  headers.set(statusHeader, "edge-hit");

  return new Response(cached.body, {
    status: cached.status,
    statusText: cached.statusText,
    headers,
  });
}

async function putEdgeCache(
  request: Request,
  response: Response,
  maxAgeSeconds: number,
) {
  if (typeof caches === "undefined" || !response.ok) {
    return;
  }

  const edgeCache = (caches as CacheStorage & { default?: Cache }).default;

  if (!edgeCache) {
    return;
  }

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", `public, max-age=${maxAgeSeconds}`);

  await edgeCache
    .put(
      request,
      new Response(response.clone().body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      }),
    )
    .catch((error: unknown) => {
      console.debug("Failed to put map preview response into edge cache.", error);
    });
}

function isUuid(value: string | null | undefined) {
  return Boolean(
    value?.match(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    ),
  );
}

async function getPlaceViewerFromRequest(
  request: Request,
  env: PlacesReadBindings,
): Promise<WorkerPlaceViewer> {
  const session = await getSessionFromRequest(request, env);

  if (session) {
    return {
      role: session.user.role,
      userId: isUuid(session.user.id) ? session.user.id : null,
    };
  }

  const visitorId = getVerifiedVisitorIdFromRequest(request, env);

  if (!visitorId) {
    return null;
  }

  return {
    role: "guest",
    visitorId,
  };
}

export function registerPlacesReadRoutes(
  app: Hono<{
    Bindings: PlacesReadBindings;
    Variables: PlacesReadVariables;
  }>,
  dependencies: PlacesReadRouteDependencies,
) {
  app.get("/api/places/map", async (c) => {
    const searchParams = new URL(c.req.url).searchParams;
    const category = searchParams.get("category");
    const query = searchParams.get("query")?.trim() || null;

    if (query && query.length > MAX_MAP_QUERY_LENGTH) {
      return c.json(
        {
          error: {
            code: "QUERY_TOO_LONG",
            message: "검색어는 120자 이하로 입력해 주세요.",
          },
        },
        400,
        dependencies.noStoreHeaders,
      );
    }
    const searchScope: PlaceSearchScope =
      query && searchParams.get("scope") === "global" ? "global" : "viewport";
    const bounds = parseMapBounds(searchParams);
    const hasBoundsParameters = ["minLat", "maxLat", "minLng", "maxLng"].some(
      (key) => searchParams.has(key),
    );

    if (hasBoundsParameters && !bounds) {
      return c.json(
        {
          error: {
            code: "INVALID_BOUNDS",
            message: "지도 검색 범위가 올바르지 않습니다.",
          },
        },
        400,
        dependencies.noStoreHeaders,
      );
    }
    const zoom = parseFiniteNumber(searchParams.get("zoom"));
    const forceRefresh = searchParams.has("refresh");
    const isEdgeCacheable = isMapPreviewEdgeCacheable({
      bounds,
      query,
      searchScope,
    });

    if (isEdgeCacheable) {
      const cachedResponse = await getEdgeCacheResponse(
        c.req.raw,
        dependencies.noStoreHeaders,
        "X-Altteulmap-Map-Cache",
      );

      if (cachedResponse) {
        return cachedResponse;
      }
    }

    const mapDbStartedAt = performance.now();
    const result = await listWorkerMapPlaces(c.env, {
      category,
      query,
      bounds: searchScope === "viewport" ? bounds : null,
      skipCache: forceRefresh,
      zoom: searchScope === "viewport" ? zoom : null,
    }).catch((error: unknown) => {
      if (dependencies.isWorkerDatabaseUnavailableError(error)) {
        return null;
      }

      throw error;
    });

    if (!result) {
      return dependencies.databaseUnavailableResponse("지도 장소 목록을 불러오지 못했습니다.");
    }

    const response = c.json(
      {
        items: result.items,
        mapMarkers: result.mapMarkers,
        markerMode: result.markerMode,
        count: result.count,
        returnedCount: result.items.length,
        mapMarkerCount: result.mapMarkers.length,
        truncated: result.items.length < result.count,
        bounds: result.bounds,
        filters: {
          category,
          query,
          searchScope,
          bounds: searchScope === "viewport" ? bounds : null,
          zoom: searchScope === "viewport" ? zoom : null,
        },
        source: result.source,
        mock: result.source === "mock",
      },
      200,
      {
        ...dependencies.noStoreHeaders,
        "X-Altteulmap-Map-Cache": result.cacheStatus,
        "Server-Timing": `db;dur=${Math.round(performance.now() - mapDbStartedAt)}`,
      },
    );

    if (isEdgeCacheable) {
      await putEdgeCache(c.req.raw, response, MAP_EDGE_CACHE_SECONDS);
    }

    return response;
  });

  app.get("/api/places/:id", async (c) => {
    const isEdgeCacheable = isAnonymousDetailEdgeCacheable(c.req.raw);

    if (isEdgeCacheable) {
      const cachedResponse = await getEdgeCacheResponse(
        c.req.raw,
        dependencies.noStoreHeaders,
        "X-Altteulmap-Detail-Cache",
      );

      if (cachedResponse) {
        return cachedResponse;
      }
    }

    const dbStartedAt = performance.now();
    const result = await getWorkerPlaceDetail(
      c.env,
      c.req.param("id"),
      await getPlaceViewerFromRequest(c.req.raw, c.env),
    ).catch((error: unknown) => {
      if (dependencies.isWorkerDatabaseUnavailableError(error)) {
        return null;
      }

      throw error;
    });

    if (!result) {
      return dependencies.databaseUnavailableResponse("장소 상세 정보를 불러오지 못했습니다.");
    }

    const place = result.item;

    if (!place) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "장소를 찾지 못했습니다.",
          },
        },
        404,
        dependencies.noStoreHeaders,
      );
    }

    const response = c.json(
      {
        item: {
          ...place,
          comments: [
            ...dependencies.getMockComments(
              place.id,
              getVerifiedVisitorIdFromRequest(c.req.raw, c.env),
            ),
            ...place.comments,
          ],
        },
        source: result.source,
        mock: result.source === "mock",
      },
      200,
      {
        ...dependencies.noStoreHeaders,
        // DB 구간 시간을 응답에 남겨 네트워크 지연과 DB 지연을 구분해 측정할 수 있게 한다.
        "Server-Timing": `db;dur=${Math.round(performance.now() - dbStartedAt)}`,
      },
    );

    if (isEdgeCacheable) {
      await putEdgeCache(c.req.raw, response, DETAIL_EDGE_CACHE_SECONDS);
    }

    return response;
  });
}
