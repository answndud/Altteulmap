import type { MapViewport } from "@/features/map/naver-map-sdk";
import type {
  PlaceBounds,
  PlaceSearchScope,
} from "@/features/places/types";

export const SEOUL_BOOTSTRAP_BOUNDS: PlaceBounds = {
  minLat: 37.4133,
  maxLat: 37.7151,
  minLng: 126.7341,
  maxLng: 127.2693,
};
export const SEOUL_BOOTSTRAP_ZOOM = 11;
export const VIEWPORT_FETCH_DEBOUNCE_MS = 320;
export const CLUSTER_FOCUS_VIEWPORT_LOCK_MS = 360;

export function buildMapApiPath(
  searchParams: URLSearchParams,
  viewport?: MapViewport | null,
) {
  const apiParams = new URLSearchParams();
  const category = searchParams.get("category");
  const query = searchParams.get("q")?.trim() || "";
  const scope = searchParams.get("scope") === "global" ? "global" : "viewport";

  if (category) {
    apiParams.set("category", category);
  }

  if (query) {
    apiParams.set("query", query);
    apiParams.set("scope", scope);
  }

  if (scope === "viewport" && viewport) {
    const snappedBounds = isBootstrapBounds(viewport.bounds)
      ? viewport.bounds
      : snapViewportBounds(viewport.bounds, viewport.zoom);

    apiParams.set("minLat", String(snappedBounds.minLat));
    apiParams.set("maxLat", String(snappedBounds.maxLat));
    apiParams.set("minLng", String(snappedBounds.minLng));
    apiParams.set("maxLng", String(snappedBounds.maxLng));
    apiParams.set("zoom", String(Math.round(viewport.zoom)));
  }

  const queryString = apiParams.toString();

  return queryString ? `/api/places/map?${queryString}` : "/api/places/map";
}

export function isBootstrapBounds(bounds: PlaceBounds) {
  return (
    bounds.minLat === SEOUL_BOOTSTRAP_BOUNDS.minLat &&
    bounds.maxLat === SEOUL_BOOTSTRAP_BOUNDS.maxLat &&
    bounds.minLng === SEOUL_BOOTSTRAP_BOUNDS.minLng &&
    bounds.maxLng === SEOUL_BOOTSTRAP_BOUNDS.maxLng
  );
}

export function getViewportBoundsSnapFactor(zoom: number) {
  if (zoom <= 12) {
    return 200;
  }

  if (zoom <= 14) {
    return 500;
  }

  return 1_000;
}

export function snapViewportBounds(bounds: PlaceBounds, zoom: number): PlaceBounds {
  const snapFactor = getViewportBoundsSnapFactor(zoom);

  return {
    minLat: Math.floor(bounds.minLat * snapFactor) / snapFactor,
    maxLat: Math.ceil(bounds.maxLat * snapFactor) / snapFactor,
    minLng: Math.floor(bounds.minLng * snapFactor) / snapFactor,
    maxLng: Math.ceil(bounds.maxLng * snapFactor) / snapFactor,
  };
}

export function createBootstrapViewport(): MapViewport {
  return {
    bounds: SEOUL_BOOTSTRAP_BOUNDS,
    center: {
      lat: (SEOUL_BOOTSTRAP_BOUNDS.minLat + SEOUL_BOOTSTRAP_BOUNDS.maxLat) / 2,
      lng: (SEOUL_BOOTSTRAP_BOUNDS.minLng + SEOUL_BOOTSTRAP_BOUNDS.maxLng) / 2,
    },
    zoom: SEOUL_BOOTSTRAP_ZOOM,
  };
}

export function createMapHref(params: {
  category?: string | null;
  query?: string | null;
  scope?: PlaceSearchScope;
}) {
  const search = new URLSearchParams();
  const query = params.query?.trim();

  if (query) {
    search.set("q", query);
    search.set("scope", params.scope ?? "global");
  }

  if (params.category) {
    search.set("category", params.category);
  }

  const queryString = search.toString();

  return queryString ? `/?${queryString}` : "/";
}
