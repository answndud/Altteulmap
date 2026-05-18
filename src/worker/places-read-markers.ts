import type {
  PlaceBounds,
  PlaceMapMarkerMode,
  PlaceMapMarkerRecord,
  PlaceMapPlaceMarkerRecord,
  PlacePreviewRecord,
} from "@/features/places/types";

const MAP_LIST_RESPONSE_LIMIT = 120;
const MAP_CLUSTER_PREVIEW_PLACE_LIMIT = 40;

export function getBoundsFromPlaces(
  items: Array<Pick<PlacePreviewRecord, "latitude" | "longitude">>,
): PlaceBounds {
  const latitudes = items.map((place) => place.latitude);
  const longitudes = items.map((place) => place.longitude);

  return {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLng: Math.min(...longitudes),
    maxLng: Math.max(...longitudes),
  };
}

export function getCappedMapListItems(items: PlacePreviewRecord[]) {
  return items.slice(0, MAP_LIST_RESPONSE_LIMIT);
}

export function toMapPlaceMarkerRecord(
  place: PlacePreviewRecord,
): PlaceMapPlaceMarkerRecord {
  return {
    kind: "place",
    ...place,
  };
}

export function getMapMarkerLimit(zoom: number | null, query: string | null) {
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

export function getMapMarkerMode(
  itemCount: number,
  zoom: number | null,
  query: string | null,
): PlaceMapMarkerMode {
  if (query?.trim()) {
    return "place";
  }

  return itemCount <= getMapMarkerLimit(zoom, query) ? "place" : "cluster";
}

export function getPlaceOnlyMapMarkers(
  items: PlacePreviewRecord[],
  zoom: number | null,
  query: string | null,
) {
  return items
    .slice(0, getMapMarkerLimit(zoom, query))
    .map(toMapPlaceMarkerRecord);
}

function getStableClusterCellSize(
  zoom: number | null,
  query: string | null,
) {
  if (query?.trim()) {
    return { latSpan: 0.018, lngSpan: 0.025 };
  }

  if (!zoom || zoom <= 10) {
    return { latSpan: 0.11, lngSpan: 0.14 };
  }

  if (zoom <= 11) {
    return { latSpan: 0.075, lngSpan: 0.1 };
  }

  if (zoom <= 12) {
    return { latSpan: 0.055, lngSpan: 0.075 };
  }

  if (zoom <= 13) {
    return { latSpan: 0.04, lngSpan: 0.055 };
  }

  if (zoom <= 14) {
    return { latSpan: 0.028, lngSpan: 0.038 };
  }

  return { latSpan: 0.018, lngSpan: 0.025 };
}

export function getClusterOnlyMapMarkers(
  items: PlacePreviewRecord[],
  _bounds: PlaceBounds,
  query: string | null,
  zoom: number | null,
): PlaceMapMarkerRecord[] {
  const { latSpan, lngSpan } = getStableClusterCellSize(zoom, query);
  const cells = new Map<string, PlacePreviewRecord[]>();

  for (const place of items) {
    const rowIndex = Math.floor(place.latitude / latSpan);
    const columnIndex = Math.floor(place.longitude / lngSpan);
    const cellKey = `${rowIndex}:${columnIndex}`;
    const bucket = cells.get(cellKey) ?? [];

    bucket.push(place);
    cells.set(cellKey, bucket);
  }

  return [...cells.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([cellKey, bucket]) => {
      return {
        kind: "cluster",
        id: `cluster:${cellKey}`,
        latitude:
          bucket.reduce((sum, place) => sum + place.latitude, 0) /
          bucket.length,
        longitude:
          bucket.reduce((sum, place) => sum + place.longitude, 0) /
          bucket.length,
        bounds: getBoundsFromPlaces(bucket),
        placeCount: bucket.length,
        previewPlaces:
          bucket.length <= MAP_CLUSTER_PREVIEW_PLACE_LIMIT ? bucket : undefined,
      };
    });
}
