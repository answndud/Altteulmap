import { useMemo } from "react";

import type { NaverMapPanelProps } from "@/features/map/naver-map-panel";
import type { MapViewport } from "@/features/map/naver-map-sdk";
import type {
  PlaceBounds,
  PlaceMapMarkerRecord,
  PlacePreviewRecord,
  PlaceSearchScope,
} from "@/features/places/types";

type MapRoutePanelState = {
  status: "loading" | "success" | "error";
  data: {
    bounds: PlaceBounds | null;
    count: number;
  } | null;
};

type UseMapRoutePanelPropsInput = {
  activeCategory: string | null;
  isManualRefreshPending: boolean;
  mapMarkers: PlaceMapMarkerRecord[];
  query: string;
  searchScope: PlaceSearchScope;
  selectedCategoryLabel: string | null;
  selectedPlace: PlacePreviewRecord | null;
  state: MapRoutePanelState;
  viewport: MapViewport | null;
  onClusterFocusViewport: (
    viewport: MapViewport,
    previewPlaces?: PlacePreviewRecord[],
  ) => void;
  onRefreshViewportPlaces: () => void;
  onSelectPlace: (place: PlacePreviewRecord) => void;
  onViewportChange: (viewport: MapViewport) => void;
};

export function useMapRoutePanelProps({
  activeCategory,
  isManualRefreshPending,
  mapMarkers,
  onClusterFocusViewport,
  onRefreshViewportPlaces,
  onSelectPlace,
  onViewportChange,
  query,
  searchScope,
  selectedCategoryLabel,
  selectedPlace,
  state,
  viewport,
}: UseMapRoutePanelPropsInput): NaverMapPanelProps {
  return useMemo(
    () => ({
      activePlaceId: selectedPlace?.id ?? null,
      focusPlacesKey:
        query && searchScope === "global"
          ? `${query}:${activeCategory ?? "all"}`
          : null,
      initialBounds: state.data?.bounds ?? null,
      isLoading: state.status === "loading",
      mapMarkers,
      placeCount: state.data?.count ?? 0,
      refreshAction:
        searchScope === "viewport" && viewport
          ? {
              isVisible: true,
              isLoading: isManualRefreshPending,
              onRefresh: onRefreshViewportPlaces,
            }
          : null,
      selectedCategoryLabel,
      onClusterFocusViewport,
      onSelectPlace,
      onViewportChange,
    }),
    [
      activeCategory,
      isManualRefreshPending,
      mapMarkers,
      onClusterFocusViewport,
      onRefreshViewportPlaces,
      onSelectPlace,
      onViewportChange,
      query,
      searchScope,
      selectedCategoryLabel,
      selectedPlace?.id,
      state.data?.bounds,
      state.data?.count,
      state.status,
      viewport,
    ],
  );
}
