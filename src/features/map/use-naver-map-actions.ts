"use client";

import { useCallback, useState, type MutableRefObject } from "react";

import {
  getClusterFocusZoom,
  getClusterViewport,
  type ClusterDisplayMarker,
} from "@/features/map/naver-map-display-markers";
import { locateCurrentPositionOnNaverMap } from "@/features/map/naver-map-location";
import {
  getLoadedNaverMapSdk,
  type MapViewport,
  type NaverMapInstance,
  type NaverMarkerInstance,
} from "@/features/map/naver-map-sdk";
import type { PlacePreviewRecord } from "@/features/places/types";

type UseNaverMapActionsOptions = {
  currentLocationMarkerRef: MutableRefObject<NaverMarkerInstance | null>;
  emitViewportChange: () => unknown;
  failMap: (message: string, error?: unknown) => void;
  isReady: boolean;
  mapInstanceRef: MutableRefObject<NaverMapInstance | null>;
  markerInstancesRef: MutableRefObject<NaverMarkerInstance[]>;
  onClusterFocusViewport?: (
    viewport: MapViewport,
    previewPlaces?: PlacePreviewRecord[],
  ) => void;
  pendingClusterFocusRef: MutableRefObject<ClusterDisplayMarker | null>;
  pendingLocateCurrentPositionRef: MutableRefObject<boolean>;
  requestMapBoot: () => boolean;
};

export function useNaverMapActions({
  currentLocationMarkerRef,
  emitViewportChange,
  failMap,
  isReady,
  mapInstanceRef,
  markerInstancesRef,
  onClusterFocusViewport,
  pendingClusterFocusRef,
  pendingLocateCurrentPositionRef,
  requestMapBoot,
}: UseNaverMapActionsOptions) {
  const [isLocating, setIsLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  const focusCluster = useCallback(
    (marker: ClusterDisplayMarker) => {
      if (!isReady || !mapInstanceRef.current) {
        return;
      }

      const maps = getLoadedNaverMapSdk()?.maps;

      if (!maps?.LatLng) {
        failMap("NAVER Maps LatLng API is unavailable.");
        return;
      }

      try {
        const nextCenter = new maps.LatLng(marker.latitude, marker.longitude);
        const currentZoom = mapInstanceRef.current.getZoom?.() ?? 13;
        const nextZoom = Math.min(getClusterFocusZoom(marker, currentZoom), 17);

        onClusterFocusViewport?.(
          getClusterViewport(marker, nextZoom),
          marker.previewPlaces,
        );
        mapInstanceRef.current.setCenter?.(nextCenter);
        mapInstanceRef.current.setZoom?.(nextZoom);
        mapInstanceRef.current.panTo?.(nextCenter);

        markerInstancesRef.current.forEach((markerInstance) =>
          markerInstance.setMap?.(null),
        );
        markerInstancesRef.current = [];
      } catch (error) {
        failMap("Failed to focus the NAVER map cluster.", error);
      }
    },
    [failMap, isReady, mapInstanceRef, markerInstancesRef, onClusterFocusViewport],
  );

  const runLocateCurrentPosition = useCallback(() => {
    locateCurrentPositionOnNaverMap({
      currentLocationMarkerRef,
      emitViewportChange,
      mapInstanceRef,
      setIsLocating,
      setLocationMessage,
    });
  }, [currentLocationMarkerRef, emitViewportChange, mapInstanceRef]);

  const clearLocationMessage = useCallback(() => {
    setLocationMessage(null);
  }, []);

  const handlePreviewClusterActivate = useCallback(
    (marker: ClusterDisplayMarker) => {
      const canBootMap = requestMapBoot();

      if (!isReady || !mapInstanceRef.current) {
        pendingClusterFocusRef.current = marker;

        if (!canBootMap) {
          onClusterFocusViewport?.(
            getClusterViewport(marker, 16),
            marker.previewPlaces,
          );
        }

        return;
      }

      focusCluster(marker);
    },
    [
      focusCluster,
      isReady,
      mapInstanceRef,
      onClusterFocusViewport,
      pendingClusterFocusRef,
      requestMapBoot,
    ],
  );

  const locateCurrentPosition = useCallback(() => {
    const canBootMap = requestMapBoot();

    if (!isReady || !mapInstanceRef.current) {
      if (canBootMap) {
        pendingLocateCurrentPositionRef.current = true;
        setLocationMessage("지도를 준비한 뒤 현재 위치를 찾습니다.");
      } else {
        setLocationMessage("지도 설정이 아직 준비되지 않아 현재 위치를 사용할 수 없습니다.");
      }

      return;
    }

    pendingLocateCurrentPositionRef.current = false;
    runLocateCurrentPosition();
  }, [
    isReady,
    mapInstanceRef,
    pendingLocateCurrentPositionRef,
    requestMapBoot,
    runLocateCurrentPosition,
  ]);

  return {
    clearLocationMessage,
    focusCluster,
    handlePreviewClusterActivate,
    isLocating,
    locateCurrentPosition,
    locationMessage,
    runLocateCurrentPosition,
  };
}
