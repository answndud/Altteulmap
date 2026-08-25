import type { Hono } from "hono";

import type { PlaceBounds, PlaceSearchScope } from "@/features/places/types";
import {
  getWorkerPlaceDetail,
  listWorkerMapPlaces,
  type WorkerPlaceViewer,
} from "@/worker/places-read-repository";
import { getSessionFromRequest } from "@/worker/auth/session";
import { getVerifiedVisitorIdFromRequest } from "@/worker/public-write-actor";

type AssetFetcher = {
  fetch(request: Request): Promise<Response> | Response;
};

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

async function getMapPreviewEdgeCacheResponse(
  request: Request,
  noStoreHeaders: Record<string, string>,
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
  headers.set("X-Altteulmap-Map-Cache", "edge-hit");

  return new Response(cached.body, {
    status: cached.status,
    statusText: cached.statusText,
    headers,
  });
}

async function putMapPreviewEdgeCache(request: Request, response: Response) {
  if (typeof caches === "undefined" || !response.ok) {
    return;
  }

  const edgeCache = (caches as CacheStorage & { default?: Cache }).default;

  if (!edgeCache) {
    return;
  }

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "public, max-age=12");

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

function getPlaceViewerFromRequest(
  request: Request,
  env: PlacesReadBindings,
): WorkerPlaceViewer {
  const session = getSessionFromRequest(request, env);

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
      const cachedResponse = await getMapPreviewEdgeCacheResponse(
        c.req.raw,
        dependencies.noStoreHeaders,
      );

      if (cachedResponse) {
        return cachedResponse;
      }
    }

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
      },
    );

    if (isEdgeCacheable) {
      await putMapPreviewEdgeCache(c.req.raw, response);
    }

    return response;
  });

  app.get("/api/places/:id", async (c) => {
    const result = await getWorkerPlaceDetail(
      c.env,
      c.req.param("id"),
      getPlaceViewerFromRequest(c.req.raw, c.env),
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

    return c.json(
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
      dependencies.noStoreHeaders,
    );
  });
}
