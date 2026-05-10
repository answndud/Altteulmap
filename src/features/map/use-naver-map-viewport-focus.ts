"use client";

import { useEffect, type MutableRefObject } from "react";

import {
  focusNaverMapPlaces,
  panNaverMapToActivePlace,
} from "@/features/map/naver-map-focus";
import type { NaverMapInstance } from "@/features/map/naver-map-sdk";
import type {
  PlaceMapMarkerRecord,
  PlaceMapPlaceMarkerRecord,
} from "@/features/places/types";

type UseNaverMapViewportFocusOptions = {
  activePlace: PlaceMapPlaceMarkerRecord | null;
  emitViewportChange: () => unknown;
  failMap: (message: string, error?: unknown) => void;
  focusPlacesKey: string | null | undefined;
  isReady: boolean;
  lastFocusPlacesKeyRef: MutableRefObject<string | null>;
  mapInstanceRef: MutableRefObject<NaverMapInstance | null>;
  mapMarkers: PlaceMapMarkerRecord[];
};

export function useNaverMapViewportFocus({
  activePlace,
  emitViewportChange,
  failMap,
  focusPlacesKey,
  isReady,
  lastFocusPlacesKeyRef,
  mapInstanceRef,
  mapMarkers,
}: UseNaverMapViewportFocusOptions) {
  useEffect(() => {
    if (!isReady || !activePlace || !mapInstanceRef.current) {
      return;
    }

    try {
      if (
        !panNaverMapToActivePlace({
          activePlace,
          map: mapInstanceRef.current,
        })
      ) {
        failMap("NAVER Maps LatLng API is unavailable.");
      }
    } catch (error) {
      failMap("Failed to move the NAVER map viewport.", error);
    }
  }, [activePlace, failMap, isReady, mapInstanceRef]);

  useEffect(() => {
    if (!isReady || !mapInstanceRef.current) {
      return;
    }

    try {
      if (
        !focusNaverMapPlaces({
          emitViewportChange,
          focusPlacesKey,
          lastFocusPlacesKeyRef,
          map: mapInstanceRef.current,
          mapMarkers,
        })
      ) {
        failMap("NAVER Maps LatLng API is unavailable.");
      }
    } catch (error) {
      failMap("Failed to focus the NAVER map viewport.", error);
    }
  }, [
    emitViewportChange,
    failMap,
    focusPlacesKey,
    isReady,
    lastFocusPlacesKeyRef,
    mapInstanceRef,
    mapMarkers,
  ]);
}
