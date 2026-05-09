"use client";

import { useEffect, type MutableRefObject } from "react";

import type { NaverMapInstance } from "@/features/map/naver-map-sdk";
import type { NaverMapContainerSize } from "@/features/map/use-naver-map-container-size";

type UseNaverMapWindowResizeSyncOptions = {
  containerSize: NaverMapContainerSize;
  emitViewportChange: () => unknown;
  isReady: boolean;
  mapInstanceRef: MutableRefObject<NaverMapInstance | null>;
};

export function useNaverMapWindowResizeSync({
  containerSize,
  emitViewportChange,
  isReady,
  mapInstanceRef,
}: UseNaverMapWindowResizeSyncOptions) {
  useEffect(() => {
    if (!isReady || !mapInstanceRef.current) {
      return;
    }

    const syncViewport = () => {
      mapInstanceRef.current?.autoResize?.();
      emitViewportChange();
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);

    return () => {
      window.removeEventListener("resize", syncViewport);
    };
  }, [
    containerSize.height,
    containerSize.width,
    emitViewportChange,
    isReady,
    mapInstanceRef,
  ]);
}
