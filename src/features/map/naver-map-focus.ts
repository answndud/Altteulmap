import type { MutableRefObject } from "react";

import {
  getLoadedNaverMapSdk,
  getViewportFromMap,
  type NaverMapInstance,
} from "@/features/map/naver-map-sdk";
import {
  isPlaceInsideViewport,
} from "@/features/map/naver-map-display-markers";
import {
  getMapCenter,
  getMapZoom,
} from "@/features/map/naver-map-panel-helpers";
import type {
  PlaceBounds,
  PlaceMapMarkerRecord,
  PlaceMapPlaceMarkerRecord,
} from "@/features/places/types";

type PanToActivePlaceOptions = {
  activePlace: PlaceMapPlaceMarkerRecord | null;
  map: NaverMapInstance | null;
};

export function panNaverMapToActivePlace({
  activePlace,
  map,
}: PanToActivePlaceOptions) {
  if (!activePlace || !map) {
    return true;
  }

  const LatLng = getLoadedNaverMapSdk()?.maps?.LatLng;

  if (!LatLng) {
    return false;
  }

  const currentViewport = getViewportFromMap(map);

  if (isPlaceInsideViewport(activePlace, currentViewport)) {
    return true;
  }

  map.panTo?.(new LatLng(activePlace.latitude, activePlace.longitude));
  return true;
}

type FocusNaverMapPlacesOptions = {
  emitViewportChange: () => unknown;
  focusPlacesKey: string | null | undefined;
  initialBounds: PlaceBounds | null | undefined;
  lastFocusPlacesKeyRef: MutableRefObject<string | null>;
  map: NaverMapInstance | null;
  mapMarkers: PlaceMapMarkerRecord[];
};

export function focusNaverMapPlaces({
  emitViewportChange,
  focusPlacesKey,
  initialBounds,
  lastFocusPlacesKeyRef,
  map,
  mapMarkers,
}: FocusNaverMapPlacesOptions) {
  if (!map || !focusPlacesKey || mapMarkers.length === 0) {
    return true;
  }

  if (lastFocusPlacesKeyRef.current === focusPlacesKey) {
    return true;
  }

  const maps = getLoadedNaverMapSdk()?.maps;
  const LatLng = maps?.LatLng;

  if (!LatLng || !maps) {
    return false;
  }

  lastFocusPlacesKeyRef.current = focusPlacesKey;

  if (initialBounds && maps.LatLngBounds) {
    const southWest = new LatLng(
      initialBounds.minLat,
      initialBounds.minLng,
    );
    const northEast = new LatLng(
      initialBounds.maxLat,
      initialBounds.maxLng,
    );
    map.fitBounds?.(new maps.LatLngBounds(southWest, northEast));
  } else {
    const focusCenter = getMapCenter(mapMarkers);
    const point = new LatLng(focusCenter.lat, focusCenter.lng);
    map.setCenter?.(point);
    map.setZoom?.(getMapZoom(mapMarkers.length));
    map.panTo?.(point);
  }
  window.setTimeout(() => {
    emitViewportChange();
  }, 100);

  return true;
}
