"use client";

import { useEffect, type MutableRefObject } from "react";

import type { ClusterDisplayMarker } from "@/features/map/naver-map-display-markers";
import type { NaverMapInstance } from "@/features/map/naver-map-sdk";

type UseNaverMapPendingActionsOptions = {
  focusCluster: (marker: ClusterDisplayMarker) => void;
  isReady: boolean;
  mapInstanceRef: MutableRefObject<NaverMapInstance | null>;
  pendingClusterFocusRef: MutableRefObject<ClusterDisplayMarker | null>;
  pendingLocateCurrentPositionRef: MutableRefObject<boolean>;
  runLocateCurrentPosition: () => void;
};

export function useNaverMapPendingActions({
  focusCluster,
  isReady,
  mapInstanceRef,
  pendingClusterFocusRef,
  pendingLocateCurrentPositionRef,
  runLocateCurrentPosition,
}: UseNaverMapPendingActionsOptions) {
  useEffect(() => {
    if (!isReady || !mapInstanceRef.current || !pendingClusterFocusRef.current) {
      return;
    }

    const nextCluster = pendingClusterFocusRef.current;
    pendingClusterFocusRef.current = null;
    focusCluster(nextCluster);
  }, [focusCluster, isReady, mapInstanceRef, pendingClusterFocusRef]);

  useEffect(() => {
    if (
      !isReady ||
      !mapInstanceRef.current ||
      !pendingLocateCurrentPositionRef.current
    ) {
      return;
    }

    pendingLocateCurrentPositionRef.current = false;
    runLocateCurrentPosition();
  }, [
    isReady,
    mapInstanceRef,
    pendingLocateCurrentPositionRef,
    runLocateCurrentPosition,
  ]);
}
