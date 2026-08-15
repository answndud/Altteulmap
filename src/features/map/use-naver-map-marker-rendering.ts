"use client";

import { useEffect, type MutableRefObject } from "react";

import type {
  ClusterDisplayMarker,
  MapDisplayMarker,
} from "@/features/map/naver-map-display-markers";
import { renderNaverMapMarkers } from "@/features/map/naver-map-markers";
import {
  getLoadedNaverMapSdk,
  type NaverMapInstance,
  type NaverMarkerInstance,
} from "@/features/map/naver-map-sdk";
import type { PlacePreviewRecord } from "@/features/places/types";

type UseNaverMapMarkerRenderingOptions = {
  displayMarkers: MapDisplayMarker[];
  failMap: (message: string, error?: unknown) => void;
  isReady: boolean;
  mapInstanceRef: MutableRefObject<NaverMapInstance | null>;
  markerInstancesRef: MutableRefObject<NaverMarkerInstance[]>;
  onClusterClick: (marker: ClusterDisplayMarker) => void;
  onPlaceClick: (place: PlacePreviewRecord) => void;
};

export function useNaverMapMarkerRendering({
  displayMarkers,
  failMap,
  isReady,
  mapInstanceRef,
  markerInstancesRef,
  onClusterClick,
  onPlaceClick,
}: UseNaverMapMarkerRenderingOptions) {
  useEffect(() => {
    if (!isReady || !mapInstanceRef.current) {
      return;
    }

    const maps = getLoadedNaverMapSdk()?.maps;

    if (!maps?.Marker || !maps?.LatLng || !maps?.Event) {
      failMap("NAVER Maps marker primitives are unavailable.");
      return;
    }

    try {
      const nextMarkerInstances = renderNaverMapMarkers({
        displayMarkers,
        map: mapInstanceRef.current,
        maps,
        onClusterClick,
        onPlaceClick,
      });
      markerInstancesRef.current.forEach((marker) => marker.setMap?.(null));
      markerInstancesRef.current = nextMarkerInstances;
    } catch (error) {
      failMap("Failed to render NAVER map markers.", error);
    }
  }, [
    displayMarkers,
    failMap,
    isReady,
    mapInstanceRef,
    markerInstancesRef,
    onClusterClick,
    onPlaceClick,
  ]);
}
