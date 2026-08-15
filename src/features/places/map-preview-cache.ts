import type { PlaceBounds, PlaceSort } from "@/features/places/types";

const MAP_PREVIEW_CACHE_TTL_MS = 12_000;
const MAP_PREVIEW_CACHE_MAX_ENTRIES = 48;

type MapPreviewCacheEntry<TValue> = {
  value: TValue;
  expiresAt: number;
};

const globalForMapPreviewCache = globalThis as {
  __altteulmapMapPreviewCache?: Map<string, MapPreviewCacheEntry<unknown>>;
};

function getMapPreviewCacheStore() {
  if (!globalForMapPreviewCache.__altteulmapMapPreviewCache) {
    globalForMapPreviewCache.__altteulmapMapPreviewCache = new Map();
  }

  return globalForMapPreviewCache.__altteulmapMapPreviewCache;
}

export function buildMapPreviewCacheKey({
  bounds,
  category,
  markerLimit,
  normalizedQuery,
  sort,
  zoom,
}: {
  bounds?: PlaceBounds | null;
  category?: string | null;
  markerLimit: number;
  normalizedQuery?: string | null;
  sort?: PlaceSort | null;
  zoom?: number | null;
}) {
  if (!bounds) {
    return null;
  }

  return [
    "map-preview-v2",
    sort ?? "price",
    category ?? "",
    normalizedQuery?.toLowerCase() ?? "",
    markerLimit,
    zoom === null || zoom === undefined ? "" : zoom.toFixed(2),
    bounds.minLat.toFixed(4),
    bounds.maxLat.toFixed(4),
    bounds.minLng.toFixed(4),
    bounds.maxLng.toFixed(4),
  ].join("|");
}

export function getCachedMapPreviewResult<TValue>(key: string) {
  const store = getMapPreviewCacheStore();
  const cached = store.get(key) as MapPreviewCacheEntry<TValue> | undefined;

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }

  return cached.value;
}

export function setCachedMapPreviewResult<TValue>(
  key: string,
  value: TValue,
) {
  const store = getMapPreviewCacheStore();

  store.delete(key);
  store.set(key, {
    value,
    expiresAt: Date.now() + MAP_PREVIEW_CACHE_TTL_MS,
  });

  while (store.size > MAP_PREVIEW_CACHE_MAX_ENTRIES) {
    const oldestKey = store.keys().next().value;

    if (!oldestKey) {
      break;
    }

    store.delete(oldestKey);
  }
}

export function invalidateMapPreviewCache() {
  getMapPreviewCacheStore().clear();
}
