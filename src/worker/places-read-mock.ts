import type {
  PlaceQuery,
  WorkerMapPlacesResult,
  WorkerPlaceDetailResult,
  WorkerPlaceViewer,
} from "@/worker/places-read-types";
import { toPlacePreviewRecord } from "@/worker/places-read-mappers";
import {
  getCappedMapListItems,
  toMapPlaceMarkerRecord,
} from "@/worker/places-read-markers";

export async function listMockMapPlaces(
  query: PlaceQuery = {},
): Promise<WorkerMapPlacesResult> {
  const { getFilteredPlaces, getMapBounds } = await import(
    "@/features/places/queries"
  );
  const allItems = getFilteredPlaces(query).map((place) =>
    toPlacePreviewRecord({
      internalId: place.id,
      slug: place.id,
      name: place.name,
      businessName: place.businessName ?? null,
      description: place.description,
      note: place.note,
      roadAddress: place.address,
      district: place.district,
      latitude: place.latitude,
      longitude: place.longitude,
      primaryCategorySlug: place.categorySlug,
      representativePriceAmount: place.representativePriceAmount,
      representativePriceLabel: place.representativePriceLabel,
      likeCount: place.likeCount,
      dislikeCount: place.dislikeCount,
      verifiedPriceItemCount: place.verificationStatus === "verified" ? 1 : 0,
      lastPriceUpdatedAt: new Date(place.lastPriceUpdatedAt),
    }),
  );
  const items = getCappedMapListItems(allItems);
  const mapMarkers = items.map(toMapPlaceMarkerRecord);

  return {
    items,
    mapMarkers,
    markerMode: "place",
    bounds: items.length > 0 ? getMapBounds() : query.bounds ?? null,
    count: allItems.length,
    source: "mock",
    cacheStatus: "bypass",
  };
}

export async function getMockPlaceDetail(
  slug: string,
  viewer: WorkerPlaceViewer,
): Promise<WorkerPlaceDetailResult> {
  const { getPlaceById } = await import("@/features/places/queries");
  const place = getPlaceById(slug);

  if (!place) {
    return {
      item: null,
      source: "mock",
    };
  }

  return {
    item: {
      ...place,
      comments: place.comments.map((comment) => ({
        ...comment,
        canDelete: viewer?.role === "admin" || comment.canDelete,
      })),
    },
    source: "mock",
  };
}
