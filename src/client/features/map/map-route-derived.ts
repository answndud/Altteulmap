import type {
  PlaceMapMarkerRecord,
  PlacePreviewRecord,
} from "@/features/places/types";

export function deriveMapMarkers(
  mapMarkers: PlaceMapMarkerRecord[],
  optimisticClusterPlaces: PlacePreviewRecord[] | null,
): PlaceMapMarkerRecord[] {
  if (optimisticClusterPlaces?.length) {
    return optimisticClusterPlaces.map((place) => ({
      ...place,
      kind: "place",
    }));
  }

  return mapMarkers;
}

export function mergeSelectedPlaceIntoList(
  places: PlacePreviewRecord[],
  selectedPlace: PlacePreviewRecord | null,
) {
  if (!selectedPlace) {
    return places;
  }

  return places.map((place) =>
    place.id === selectedPlace.id ? selectedPlace : place,
  );
}

export function deriveTrendingPlaces(
  places: PlacePreviewRecord[],
  query: string,
) {
  if (query) {
    return [];
  }

  return [...places]
    .sort((left, right) => {
      if (right.likeCount !== left.likeCount) {
        return right.likeCount - left.likeCount;
      }

      return (
        new Date(right.lastPriceUpdatedAt).getTime() -
        new Date(left.lastPriceUpdatedAt).getTime()
      );
    })
    .slice(0, 6);
}
