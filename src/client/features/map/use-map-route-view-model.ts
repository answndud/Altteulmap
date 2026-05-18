import { useMemo } from "react";

import { getCategoryBySlug } from "@/features/categories/catalog";
import type {
  PlaceBounds,
  PlaceMapMarkerMode,
  PlaceMapMarkerRecord,
  PlacePreviewRecord,
  PlaceSearchScope,
} from "@/features/places/types";

import {
  deriveMapMarkers,
  deriveTrendingPlaces,
  mergeSelectedPlaceIntoList,
} from "./map-route-derived";

type MapPlacesResponse = {
  bounds: PlaceBounds | null;
  count: number;
  items: PlacePreviewRecord[];
  mapMarkers: PlaceMapMarkerRecord[];
  markerMode: PlaceMapMarkerMode;
  returnedCount: number;
};

type MapPlacesLoadState =
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: MapPlacesResponse; error: null }
  | { status: "error"; data: null; error: string };

export function useMapRouteViewModel({
  optimisticClusterPlaces,
  query,
  selectedPlace,
  state,
}: {
  optimisticClusterPlaces: PlacePreviewRecord[] | null;
  query: string;
  selectedPlace: PlacePreviewRecord | null;
  state: MapPlacesLoadState;
}) {
  const places = useMemo(() => state.data?.items ?? [], [state.data?.items]);
  const mapMarkers = useMemo<PlaceMapMarkerRecord[]>(() => {
    return deriveMapMarkers(
      state.data?.mapMarkers ?? [],
      optimisticClusterPlaces,
    );
  }, [optimisticClusterPlaces, state.data?.mapMarkers]);
  const displayedPlaces = useMemo(() => {
    return mergeSelectedPlaceIntoList(places, selectedPlace);
  }, [places, selectedPlace]);
  const trendingPlaces = useMemo(() => {
    return deriveTrendingPlaces(displayedPlaces, query);
  }, [displayedPlaces, query]);
  const totalPlaceCount = state.status === "success" ? state.data.count : 0;
  const visiblePlaceCount =
    state.status === "success" ? state.data.returnedCount : 0;
  const isServerTrimmed =
    state.status === "success" && state.data.count > state.data.returnedCount;

  return {
    displayedPlaces,
    isServerTrimmed,
    mapMarkers,
    places,
    totalPlaceCount,
    trendingPlaces,
    visiblePlaceCount,
  };
}

export function useMapRouteSearchModel(searchParams: URLSearchParams) {
  const query = searchParams.get("q")?.trim() || "";
  const activeCategory = searchParams.get("category");
  const searchScope: PlaceSearchScope =
    query && searchParams.get("scope") === "global" ? "global" : "viewport";
  const selectedCategory = getCategoryBySlug(activeCategory);
  const selectedCategoryLabel = selectedCategory?.name ?? null;

  return {
    activeCategory,
    query,
    searchScope,
    selectedCategory,
    selectedCategoryLabel,
  };
}
