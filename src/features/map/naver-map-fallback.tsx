"use client";

import { useMemo } from "react";

import {
  getClusterViewport,
  getDisplayMarkers,
} from "@/features/map/naver-map-display-markers";
import { PreviewMap } from "@/features/map/naver-map-preview";
import type { MapViewport } from "@/features/map/naver-map-sdk";
import type {
  PlaceMapMarkerRecord,
  PlacePreviewRecord,
} from "@/features/places/types";

type NaverMapFallbackProps = {
  isLoading?: boolean;
  mapMarkers: PlaceMapMarkerRecord[];
  placeCount?: number;
  selectedCategoryLabel: string | null;
  activePlaceId?: string | null;
  onSelectPlace: (place: PlacePreviewRecord) => void;
  onClusterFocusViewport?: (
    viewport: MapViewport,
    previewPlaces?: PlacePreviewRecord[],
  ) => void;
};

export function NaverMapFallback({
  isLoading = false,
  mapMarkers,
  placeCount,
  selectedCategoryLabel,
  activePlaceId,
  onSelectPlace,
  onClusterFocusViewport,
}: NaverMapFallbackProps) {
  const displayMarkers = useMemo(
    () => getDisplayMarkers(mapMarkers, activePlaceId ?? null),
    [activePlaceId, mapMarkers],
  );

  return (
    <section
      className="relative isolate overflow-hidden rounded-[0.875rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)]"
      data-testid="map-panel-shell"
    >
      <div className="altteulmap-map-viewport relative isolate z-0">
        <PreviewMap
          markers={displayMarkers}
          selectedCategoryLabel={selectedCategoryLabel}
          onSelectPlace={onSelectPlace}
          onActivateCluster={(marker) =>
            onClusterFocusViewport?.(
              getClusterViewport(marker, 16),
              marker.previewPlaces,
            )
          }
        />
        <div className="altteulmap-map-overlay absolute left-2 top-2 z-10 max-w-[13rem] px-2.5 py-2 text-sm text-[var(--altteul-text-primary)] sm:left-4 sm:top-4 sm:max-w-[17rem] sm:px-3.5 sm:py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-[var(--altteul-text-strong)]">임시 미리보기</p>
            <span className="altteulmap-badge whitespace-nowrap px-2.5 py-1 text-[11px] font-medium">
              {isLoading && mapMarkers.length === 0
                ? "불러오는 중"
                : `${placeCount ?? mapMarkers.length}곳`}
            </span>
          </div>
          <p className="mt-2 hidden text-xs leading-5 text-[var(--altteul-text-secondary)] sm:block">
            지도를 불러오지 못해 임시 미리보기로 먼저 표시합니다.
          </p>
        </div>
      </div>
    </section>
  );
}
