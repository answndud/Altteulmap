"use client";

import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react";

import {
  loadNaverMapSdk,
  type MapStatus,
  type NaverMapInstance,
} from "@/features/map/naver-map-sdk";
import {
  getCenterFromBounds,
  getMapCenter,
  getMapZoom,
} from "@/features/map/naver-map-panel-helpers";
import type { NaverMapContainerSize } from "@/features/map/use-naver-map-container-size";
import type {
  PlaceBounds,
  PlaceMapMarkerRecord,
} from "@/features/places/types";

type UseNaverMapInitializationOptions = {
  containerSize: NaverMapContainerSize;
  emitViewportChange: () => unknown;
  failMap: (message: string, error?: unknown) => void;
  initialBounds?: PlaceBounds | null;
  mapContainerRef: RefObject<HTMLDivElement | null>;
  mapInstanceRef: MutableRefObject<NaverMapInstance | null>;
  mapMarkers: PlaceMapMarkerRecord[];
  naverMapKeyId: string;
  setStatus: Dispatch<SetStateAction<MapStatus>>;
  shouldBootMap: boolean;
};

export function useNaverMapInitialization({
  containerSize,
  emitViewportChange,
  failMap,
  initialBounds,
  mapContainerRef,
  mapInstanceRef,
  mapMarkers,
  naverMapKeyId,
  setStatus,
  shouldBootMap,
}: UseNaverMapInitializationOptions) {
  useEffect(() => {
    if (
      !naverMapKeyId ||
      !shouldBootMap ||
      !mapContainerRef.current ||
      containerSize.width === 0 ||
      containerSize.height === 0 ||
      mapInstanceRef.current
    ) {
      return;
    }

    let cancelled = false;
    let resizeTimeoutId: number | null = null;

    loadNaverMapSdk(naverMapKeyId)
      .then((naver) => {
        if (cancelled || !mapContainerRef.current) {
          return;
        }

        try {
          const maps = naver?.maps;

          if (!maps?.Map || !maps?.LatLng || !maps?.LatLngBounds || !maps?.Event) {
            throw new Error("NAVER Maps SDK primitives are unavailable.");
          }

          const center = initialBounds
            ? getCenterFromBounds(initialBounds)
            : getMapCenter(mapMarkers);
          const centerLatLng = new maps.LatLng(center.lat, center.lng);
          const nextZoom = getMapZoom(mapMarkers.length);
          const map = new maps.Map(mapContainerRef.current, {
            center: centerLatLng,
            zoom: nextZoom,
            mapDataControl: false,
            scaleControl: false,
            logoControl: false,
          });

          mapInstanceRef.current = map;

          if (initialBounds) {
            const southWest = new maps.LatLng(
              initialBounds.minLat,
              initialBounds.minLng,
            );
            const northEast = new maps.LatLng(
              initialBounds.maxLat,
              initialBounds.maxLng,
            );

            map.fitBounds?.(new maps.LatLngBounds(southWest, northEast));
          }

          const syncViewport = () => {
            map.autoResize?.();
            emitViewportChange();
          };

          maps.Event.addListener(map, "idle", () => {
            emitViewportChange();
          });

          window.requestAnimationFrame(syncViewport);
          window.setTimeout(syncViewport, 0);
          resizeTimeoutId = window.setTimeout(syncViewport, 180);
          setStatus("ready");
        } catch (error) {
          if (!cancelled) {
            failMap("Failed to initialize NAVER Maps.", error);
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          failMap("Failed to initialize NAVER Maps.", error);
        }
      });

    return () => {
      cancelled = true;

      if (resizeTimeoutId !== null) {
        window.clearTimeout(resizeTimeoutId);
      }
    };
  }, [
    containerSize.height,
    containerSize.width,
    emitViewportChange,
    failMap,
    initialBounds,
    mapContainerRef,
    mapInstanceRef,
    mapMarkers,
    naverMapKeyId,
    setStatus,
    shouldBootMap,
  ]);
}
