import { DEFAULT_MAP_CENTER } from "@/features/map/naver-map-sdk";
import type { PlaceBounds } from "@/features/places/types";

export function getMapZoom(placeCount: number) {
  return placeCount > 1 ? 13 : 15;
}

export function getCenterFromBounds(bounds: PlaceBounds) {
  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lng: (bounds.minLng + bounds.maxLng) / 2,
  };
}

export function getMapCenter(
  items: Array<{ latitude: number; longitude: number }>,
) {
  if (items.length === 0) {
    return DEFAULT_MAP_CENTER;
  }

  const totals = items.reduce(
    (accumulator, item) => ({
      lat: accumulator.lat + item.latitude,
      lng: accumulator.lng + item.longitude,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: totals.lat / items.length,
    lng: totals.lng / items.length,
  };
}

export function isLocalMapFallbackHost() {
  if (typeof window === "undefined") {
    return false;
  }

  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}
