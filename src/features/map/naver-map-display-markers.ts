import { DEFAULT_MAP_CENTER, type MapViewport } from "@/features/map/naver-map-sdk";
import type {
  PlaceMapClusterMarkerRecord,
  PlaceMapMarkerRecord,
  PlaceMapPlaceMarkerRecord,
  PlacePreviewRecord,
} from "@/features/places/types";

export type PlaceDisplayMarker = {
  kind: "place";
  id: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
  offsetX: number;
  offsetY: number;
  zIndex: number;
  place: PlacePreviewRecord;
};

export type ClusterDisplayMarker = PlaceMapClusterMarkerRecord;

export type MapDisplayMarker = PlaceDisplayMarker | ClusterDisplayMarker;

const PLACE_MARKER_OVERLAP_COORDINATE_PRECISION = 4;

export function getClusterFocusZoom(
  marker: ClusterDisplayMarker,
  currentZoom: number,
) {
  if (marker.placeCount <= 6) {
    return Math.max(currentZoom + 3, 16);
  }

  if (marker.placeCount <= 40) {
    return Math.max(currentZoom + 2, 15);
  }

  return Math.max(currentZoom + 2, 14);
}

export function getPreviewBounds(
  items: Array<{ latitude: number; longitude: number }>,
) {
  if (items.length === 0) {
    return {
      minLat: DEFAULT_MAP_CENTER.lat,
      maxLat: DEFAULT_MAP_CENTER.lat,
      minLng: DEFAULT_MAP_CENTER.lng,
      maxLng: DEFAULT_MAP_CENTER.lng,
    };
  }

  const latitudes = items.map((item) => item.latitude);
  const longitudes = items.map((item) => item.longitude);

  return {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLng: Math.min(...longitudes),
    maxLng: Math.max(...longitudes),
  };
}

function createPlaceDisplayMarker(
  place: PlaceMapPlaceMarkerRecord,
  isActive: boolean,
  offsetX = 0,
  offsetY = 0,
  zIndex = isActive ? 1000 : 100,
): PlaceDisplayMarker {
  return {
    kind: "place",
    id: place.id,
    latitude: place.latitude,
    longitude: place.longitude,
    isActive,
    offsetX,
    offsetY,
    zIndex,
    place,
  };
}

export function getDisplayMarkers(
  mapMarkers: PlaceMapMarkerRecord[],
  activePlaceId: string | null,
) {
  const coordinateGroups = new Map<string, PlaceMapPlaceMarkerRecord[]>();

  mapMarkers.forEach((marker) => {
    if (marker.kind === "cluster") {
      return;
    }

    const coordinateKey = [
      marker.latitude.toFixed(PLACE_MARKER_OVERLAP_COORDINATE_PRECISION),
      marker.longitude.toFixed(PLACE_MARKER_OVERLAP_COORDINATE_PRECISION),
    ].join(":");
    const group = coordinateGroups.get(coordinateKey) ?? [];

    group.push(marker);
    coordinateGroups.set(coordinateKey, group);
  });

  const offsets = new Map<string, { x: number; y: number; zIndex: number }>();

  coordinateGroups.forEach((group) => {
    if (group.length <= 1) {
      return;
    }

    const sortedGroup = [...group].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    const stepAngle = (Math.PI * 2) / sortedGroup.length;
    const radius = Math.min(34, 14 + sortedGroup.length * 4);

    sortedGroup.forEach((marker, index) => {
      const angle = -Math.PI / 2 + stepAngle * index;

      offsets.set(marker.id, {
        x: Math.round(Math.cos(angle) * radius),
        y: Math.round(Math.sin(angle) * radius),
        zIndex: 100 + index,
      });
    });
  });

  return mapMarkers.map((marker) => {
    if (marker.kind === "cluster") {
      return marker;
    }

    const isActive = marker.id === activePlaceId;
    const offset = offsets.get(marker.id) ?? { x: 0, y: 0, zIndex: 100 };

    return createPlaceDisplayMarker(
      marker,
      isActive,
      offset.x,
      offset.y,
      isActive ? 1000 : offset.zIndex,
    );
  }) satisfies MapDisplayMarker[];
}

export function serializeViewport(viewport: MapViewport) {
  return [
    viewport.center.lat.toFixed(4),
    viewport.center.lng.toFixed(4),
    viewport.zoom.toFixed(2),
    viewport.bounds.minLat.toFixed(4),
    viewport.bounds.maxLat.toFixed(4),
    viewport.bounds.minLng.toFixed(4),
    viewport.bounds.maxLng.toFixed(4),
  ].join(":");
}

export function isPlaceInsideViewport(
  place: Pick<PlacePreviewRecord, "latitude" | "longitude">,
  viewport: MapViewport | null,
  padding = 0.0003,
) {
  if (!viewport) {
    return false;
  }

  return (
    place.latitude >= viewport.bounds.minLat - padding &&
    place.latitude <= viewport.bounds.maxLat + padding &&
    place.longitude >= viewport.bounds.minLng - padding &&
    place.longitude <= viewport.bounds.maxLng + padding
  );
}

export function getClusterViewport(
  marker: ClusterDisplayMarker,
  zoom: number,
): MapViewport {
  return {
    bounds: marker.bounds,
    center: {
      lat: marker.latitude,
      lng: marker.longitude,
    },
    zoom,
  };
}
