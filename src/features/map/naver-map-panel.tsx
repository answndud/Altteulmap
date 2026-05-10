"use client";

import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getLoadedNaverMapSdk,
  type MapViewport,
  type NaverMapInstance,
  type NaverMarkerInstance,
} from "@/features/map/naver-map-sdk";
import { NaverMapFallback } from "@/features/map/naver-map-fallback";
import {
  focusNaverMapPlaces,
  panNaverMapToActivePlace,
} from "@/features/map/naver-map-focus";
import { locateCurrentPositionOnNaverMap } from "@/features/map/naver-map-location";
import { useNaverMapInitialization } from "@/features/map/use-naver-map-initialization";
import { useNaverMapContainerSize } from "@/features/map/use-naver-map-container-size";
import { useNaverMapKeyState } from "@/features/map/use-naver-map-key-state";
import { useNaverMapMarkerRendering } from "@/features/map/use-naver-map-marker-rendering";
import { useNaverMapPendingActions } from "@/features/map/use-naver-map-pending-actions";
import { useNaverMapRuntimeError } from "@/features/map/use-naver-map-runtime-error";
import { useNaverMapWindowResizeSync } from "@/features/map/use-naver-map-window-resize-sync";
import {
  getClusterFocusZoom,
  getClusterViewport,
  getDisplayMarkers,
  type ClusterDisplayMarker,
} from "@/features/map/naver-map-display-markers";
import { PreviewMap } from "@/features/map/naver-map-preview";
import { emitNaverMapViewportChange } from "@/features/map/naver-map-viewport";
import type {
  PlaceBounds,
  PlaceMapMarkerRecord,
  PlaceMapPlaceMarkerRecord,
  PlacePreviewRecord,
} from "@/features/places/types";

type NaverMapPanelProps = {
  initialBounds?: PlaceBounds | null;
  isLoading?: boolean;
  mapMarkers: PlaceMapMarkerRecord[];
  placeCount?: number;
  refreshAction?: {
    isVisible: boolean;
    isLoading: boolean;
    onRefresh: () => void;
  } | null;
  selectedCategoryLabel: string | null;
  activePlaceId?: string | null;
  focusPlacesKey?: string | null;
  onSelectPlace?: (place: PlacePreviewRecord) => void;
  onClusterFocusViewport?: (
    viewport: MapViewport,
    previewPlaces?: PlacePreviewRecord[],
  ) => void;
  onViewportChange?: (viewport: MapViewport) => void;
};

type NaverMapPanelBoundaryState = {
  hasError: boolean;
};

class NaverMapPanelBoundary extends Component<
  NaverMapPanelProps,
  NaverMapPanelBoundaryState
> {
  override state: NaverMapPanelBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  override componentDidCatch(error: unknown) {
    console.error("NAVER map panel crashed. Falling back to preview.", error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <NaverMapFallback
          isLoading={this.props.isLoading}
          mapMarkers={this.props.mapMarkers}
          placeCount={this.props.placeCount}
          selectedCategoryLabel={this.props.selectedCategoryLabel}
          activePlaceId={this.props.activePlaceId ?? null}
          onSelectPlace={this.props.onSelectPlace ?? (() => {})}
          onClusterFocusViewport={this.props.onClusterFocusViewport}
        />
      );
    }

    return <NaverMapPanelContent {...this.props} />;
  }
}

export function NaverMapPanel(props: NaverMapPanelProps) {
  return <NaverMapPanelBoundary {...props} />;
}

function NaverMapPanelContent({
  initialBounds,
  isLoading = false,
  mapMarkers,
  placeCount,
  refreshAction = null,
  selectedCategoryLabel,
  activePlaceId: controlledActivePlaceId,
  focusPlacesKey,
  onSelectPlace,
  onClusterFocusViewport,
  onViewportChange,
}: NaverMapPanelProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<NaverMapInstance | null>(null);
  const markerInstancesRef = useRef<NaverMarkerInstance[]>([]);
  const currentLocationMarkerRef = useRef<NaverMarkerInstance | null>(null);
  const lastViewportKeyRef = useRef<string | null>(null);
  const lastFocusPlacesKeyRef = useRef<string | null>(null);
  const pendingClusterFocusRef = useRef<ClusterDisplayMarker | null>(null);
  const pendingLocateCurrentPositionRef = useRef(false);
  const containerSize = useNaverMapContainerSize(mapContainerRef);
  const {
    naverMapKeyId,
    shouldBootMap,
    shouldUseLocalTileFallback,
    setShouldBootMap,
    setStatus,
    status,
  } = useNaverMapKeyState();
  const [isLocating, setIsLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [internalActivePlaceId, setInternalActivePlaceId] = useState<string | null>(
    mapMarkers.find((marker) => marker.kind === "place")?.id ?? null,
  );
  const activePlaceId =
    controlledActivePlaceId === undefined
      ? internalActivePlaceId
      : controlledActivePlaceId;
  const activePlace = useMemo(
    () =>
      mapMarkers.find(
        (marker): marker is PlaceMapPlaceMarkerRecord =>
          marker.kind === "place" && marker.id === activePlaceId,
      ) ?? null,
    [activePlaceId, mapMarkers],
  );
  const displayMarkers = useMemo(
    () => getDisplayMarkers(mapMarkers, activePlaceId ?? null),
    [activePlaceId, mapMarkers],
  );
  const showPreview = status !== "ready";

  const selectPlace = useCallback(
    (place: PlacePreviewRecord) => {
      if (naverMapKeyId) {
        setShouldBootMap(true);
      }

      if (controlledActivePlaceId === undefined) {
        setInternalActivePlaceId(place.id);
      }

      onSelectPlace?.(place);
    },
    [controlledActivePlaceId, naverMapKeyId, onSelectPlace],
  );
  const emitPlaceSelect = useCallback(
    (place: PlacePreviewRecord) => {
      selectPlace(place);
    },
    [selectPlace],
  );
  const requestMapBoot = useCallback(() => {
    if (!naverMapKeyId) {
      return false;
    }

    setShouldBootMap(true);
    return true;
  }, [naverMapKeyId]);
  const clearMapInstance = useCallback(() => {
    markerInstancesRef.current.forEach((marker) => marker.setMap?.(null));
    markerInstancesRef.current = [];
    currentLocationMarkerRef.current?.setMap?.(null);
    currentLocationMarkerRef.current = null;
    mapInstanceRef.current?.destroy?.();
    mapInstanceRef.current = null;
    lastViewportKeyRef.current = null;
    lastFocusPlacesKeyRef.current = null;
    pendingClusterFocusRef.current = null;
    pendingLocateCurrentPositionRef.current = false;
  }, []);
  const failMap = useCallback(
    (message: string, error?: unknown) => {
      console.error(message, error);
      clearMapInstance();
      setStatus("error");
    },
    [clearMapInstance],
  );
  const emitViewportChange = useCallback(() => {
    return emitNaverMapViewportChange({
      lastViewportKeyRef,
      map: mapInstanceRef.current,
      onViewportChange,
    });
  }, [onViewportChange]);

  const focusCluster = useCallback(
    (marker: ClusterDisplayMarker) => {
      if (status !== "ready" || !mapInstanceRef.current) {
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
    [failMap, onClusterFocusViewport, status],
  );
  const runLocateCurrentPosition = useCallback(() => {
    locateCurrentPositionOnNaverMap({
      currentLocationMarkerRef,
      emitViewportChange,
      mapInstanceRef,
      setIsLocating,
      setLocationMessage,
    });
  }, [emitViewportChange]);

  const handlePreviewClusterActivate = useCallback(
    (marker: ClusterDisplayMarker) => {
      const canBootMap = requestMapBoot();

      if (status !== "ready" || !mapInstanceRef.current) {
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
    [focusCluster, onClusterFocusViewport, requestMapBoot, status],
  );

  const locateCurrentPosition = useCallback(() => {
    const canBootMap = requestMapBoot();

    if (status !== "ready" || !mapInstanceRef.current) {
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
  }, [requestMapBoot, runLocateCurrentPosition, status]);

  useNaverMapRuntimeError({
    failMap,
    naverMapKeyId,
  });

  useNaverMapInitialization({
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
  });

  useNaverMapPendingActions({
    focusCluster,
    isReady: status === "ready",
    mapInstanceRef,
    pendingClusterFocusRef,
    pendingLocateCurrentPositionRef,
    runLocateCurrentPosition,
  });

  useNaverMapMarkerRendering({
    displayMarkers,
    failMap,
    isReady: status === "ready",
    mapInstanceRef,
    markerInstancesRef,
    onClusterClick: focusCluster,
    onPlaceClick: emitPlaceSelect,
  });

  useEffect(() => {
    if (status !== "ready" || !activePlace || !mapInstanceRef.current) {
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
  }, [activePlace, failMap, status]);

  useEffect(() => {
    if (status !== "ready" || !mapInstanceRef.current) {
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
  }, [emitViewportChange, failMap, focusPlacesKey, mapMarkers, status]);

  useNaverMapWindowResizeSync({
    containerSize,
    emitViewportChange,
    isReady: status === "ready",
    mapInstanceRef,
  });

  useEffect(() => {
    if (!locationMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setLocationMessage(null);
    }, 2800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [locationMessage]);

  useEffect(() => {
    return () => {
      clearMapInstance();
    };
  }, [clearMapInstance]);

  const statusMessage =
    shouldUseLocalTileFallback
      ? "로컬 서버에서는 지도 타일 미리보기로 표시합니다."
      : status === "missing-key"
      ? "지도 설정이 아직 준비되지 않아 임시 미리보기로 표시합니다."
      : status === "error"
        ? "지도를 불러오지 못해 임시 미리보기로 표시합니다."
        : showPreview
          ? shouldBootMap
            ? "지도를 불러오는 중입니다."
            : "지도를 준비하는 중입니다."
          : null;
  const canLocateCurrentPosition =
    Boolean(naverMapKeyId) && (status === "loading" || status === "ready");
  const placeCountLabel =
    isLoading && mapMarkers.length === 0
      ? "불러오는 중"
      : `${placeCount ?? mapMarkers.length}곳`;

  return (
    <section
      className="altteulmap-panel relative isolate overflow-hidden"
      data-testid="map-panel-shell"
    >
      <div className="relative isolate z-0 h-[42rem] lg:h-[calc(100dvh-11rem)] lg:min-h-[50rem]">
        <div
          ref={mapContainerRef}
          data-testid="map-panel"
          className="altteulmap-naver-map relative z-0 h-full w-full overflow-hidden bg-[var(--altteul-bg-subtle)]"
        />

        {showPreview ? (
          <div
            className="pointer-events-none absolute inset-0"
            onPointerDownCapture={requestMapBoot}
            onKeyDownCapture={requestMapBoot}
          >
            <PreviewMap
              markers={displayMarkers}
              selectedCategoryLabel={selectedCategoryLabel}
              onSelectPlace={selectPlace}
              onActivateCluster={handlePreviewClusterActivate}
              enableLocalWheelZoom={shouldUseLocalTileFallback}
            />
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-3 sm:inset-x-4 sm:top-4">
          <div className="pointer-events-auto grid max-w-[13.5rem] gap-2 sm:max-w-[18rem]">
            <div className="altteulmap-map-overlay px-3 py-2.5 sm:px-3.5 sm:py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="altteulmap-section-kicker text-[10px]">지도</p>
                  <h2 className="mt-1 text-sm font-semibold text-[var(--altteul-text-strong)] sm:text-base">
                    가격 지도
                  </h2>
                </div>
                <span className="altteulmap-badge shrink-0 whitespace-nowrap px-2.5 py-1 text-[11px] font-medium">
                  {placeCountLabel}
                </span>
              </div>
              <p className="mt-2 hidden text-xs leading-5 text-[var(--altteul-text-secondary)] sm:block">
                {selectedCategoryLabel
                  ? `${selectedCategoryLabel} 카테고리 기준으로 보고 있습니다.`
                  : "대표 가격과 최근 제보를 함께 확인합니다."}
              </p>
            </div>

            {statusMessage ? (
              <div className="altteulmap-map-overlay-subtle px-3 py-2 text-xs leading-5 text-[var(--altteul-text-secondary)]">
                {statusMessage}
              </div>
            ) : null}

            {refreshAction?.isVisible ? (
              <button
                type="button"
                onClick={() => {
                  requestMapBoot();
                  refreshAction.onRefresh();
                }}
                disabled={refreshAction.isLoading}
                data-testid="map-refresh-button"
                className="altteulmap-accent-solid altteulmap-button w-fit whitespace-nowrap px-3.5 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-70 sm:text-sm"
              >
                {refreshAction.isLoading ? "검색 중" : "이 지역 다시 찾기"}
              </button>
            ) : null}
          </div>

          <div className="pointer-events-auto grid justify-items-end gap-2">
            <button
              type="button"
              onClick={locateCurrentPosition}
              disabled={!canLocateCurrentPosition || isLocating}
              data-testid="map-current-location-button"
              className="altteulmap-map-overlay-subtle inline-flex whitespace-nowrap px-3 py-2 text-xs font-medium text-[var(--altteul-text-primary)] transition hover:bg-[var(--altteul-bg-surface)] disabled:cursor-not-allowed disabled:text-[var(--altteul-text-tertiary)]"
            >
              {isLocating ? "위치 확인 중" : "현재 위치"}
            </button>

            {locationMessage ? (
              <div className="altteulmap-map-overlay-subtle max-w-[13rem] px-3 py-2 text-right text-xs leading-5 text-[var(--altteul-text-secondary)]">
                {locationMessage}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
