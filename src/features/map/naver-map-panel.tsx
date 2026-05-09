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
  getNaverMapKeyId,
  getViewportFromMap,
  loadNaverMapSdk,
  type MapStatus,
  type MapViewport,
  type NaverMapInstance,
  type NaverMarkerInstance,
} from "@/features/map/naver-map-sdk";
import {
  getCenterFromBounds,
  getMapCenter,
  getMapZoom,
  isLocalMapFallbackHost,
} from "@/features/map/naver-map-panel-helpers";
import {
  createClusterMarkerIcon,
  createMapMarkerIcon,
  formatMarkerCount,
} from "@/features/map/naver-map-marker-visuals";
import {
  getClusterFocusZoom,
  getClusterViewport,
  getDisplayMarkers,
  isPlaceInsideViewport,
  serializeViewport,
  type ClusterDisplayMarker,
} from "@/features/map/naver-map-display-markers";
import { PreviewMap } from "@/features/map/naver-map-preview";
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

function NaverMapFallback({
  isLoading = false,
  mapMarkers,
  placeCount,
  selectedCategoryLabel,
  activePlaceId,
  onSelectPlace,
  onClusterFocusViewport,
}: {
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
}) {
  const displayMarkers = useMemo(
    () => getDisplayMarkers(mapMarkers, activePlaceId ?? null),
    [activePlaceId, mapMarkers],
  );

  return (
    <section
      className="relative isolate overflow-hidden rounded-[0.875rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)]"
      data-testid="map-panel-shell"
    >
      <div className="relative isolate z-0 h-[42rem] lg:h-[calc(100dvh-11rem)] lg:min-h-[50rem]">
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
        <div className="altteulmap-map-overlay absolute left-4 top-4 z-10 max-w-[17rem] px-3.5 py-3 text-sm text-[var(--altteul-text-primary)]">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-[var(--altteul-text-strong)]">임시 미리보기</p>
            <span className="altteulmap-badge whitespace-nowrap px-2.5 py-1 text-[11px] font-medium">
              {isLoading && mapMarkers.length === 0
                ? "불러오는 중"
                : `${placeCount ?? mapMarkers.length}곳`}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--altteul-text-secondary)]">
            지도를 불러오지 못해 임시 미리보기로 먼저 표시합니다.
          </p>
        </div>
      </div>
    </section>
  );
}

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
  const buildTimeNaverMapKeyId = getNaverMapKeyId();
  const shouldUseLocalTileFallback = isLocalMapFallbackHost();
  const [runtimeNaverMapKeyId, setRuntimeNaverMapKeyId] = useState(
    buildTimeNaverMapKeyId,
  );
  const naverMapKeyId = shouldUseLocalTileFallback ? "" : runtimeNaverMapKeyId;
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [shouldBootMap, setShouldBootMap] = useState(false);
  const [status, setStatus] = useState<MapStatus>("loading");
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
    const viewport = getViewportFromMap(mapInstanceRef.current);

    if (!viewport) {
      return null;
    }

    const nextKey = serializeViewport(viewport);

    if (lastViewportKeyRef.current === nextKey) {
      return viewport;
    }

    lastViewportKeyRef.current = nextKey;
    onViewportChange?.(viewport);
    return viewport;
  }, [onViewportChange]);

  useEffect(() => {
    if (shouldUseLocalTileFallback) {
      setRuntimeNaverMapKeyId("");
      setStatus("missing-key");
      setShouldBootMap(false);
      return;
    }

    if (buildTimeNaverMapKeyId) {
      setRuntimeNaverMapKeyId(buildTimeNaverMapKeyId);
      setStatus("loading");
      setShouldBootMap(true);
      return;
    }

    let isDisposed = false;

    fetch("/api/config/public", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          return "";
        }

        const payload = (await response.json()) as { naverMapKeyId?: string };

        return payload.naverMapKeyId?.trim() ?? "";
      })
      .then((keyId) => {
        if (isDisposed) {
          return;
        }

        setRuntimeNaverMapKeyId(keyId);
        setStatus(keyId ? "loading" : "missing-key");
        setShouldBootMap(Boolean(keyId));
      })
      .catch(() => {
        if (!isDisposed) {
          setRuntimeNaverMapKeyId("");
          setStatus("missing-key");
        }
      });

    return () => {
      isDisposed = true;
    };
  }, [buildTimeNaverMapKeyId, shouldUseLocalTileFallback]);
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
    if (!mapInstanceRef.current) {
      setLocationMessage("지도가 준비된 뒤 현재 위치를 사용할 수 있습니다.");
      return;
    }

    if (!navigator.geolocation) {
      setLocationMessage("이 브라우저에서는 현재 위치를 지원하지 않습니다.");
      return;
    }

    setIsLocating(true);
    setLocationMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const naver = getLoadedNaverMapSdk();
        const LatLng = naver?.maps?.LatLng;
        const Marker = naver?.maps?.Marker;

        if (!LatLng || !Marker || !mapInstanceRef.current) {
          setIsLocating(false);
          setLocationMessage("현재 위치를 지도에 반영하지 못했습니다.");
          return;
        }

        const point = new LatLng(
          position.coords.latitude,
          position.coords.longitude,
        );

        currentLocationMarkerRef.current?.setMap?.(null);
        currentLocationMarkerRef.current = new Marker({
          map: mapInstanceRef.current,
          position: point,
          title: "현재 위치",
        });

        mapInstanceRef.current.setCenter?.(point);
        mapInstanceRef.current.setZoom?.(15);
        mapInstanceRef.current.panTo?.(point);

        setIsLocating(false);
        setLocationMessage("현재 위치 주변으로 이동했습니다.");
        window.setTimeout(() => {
          emitViewportChange();
        }, 100);
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "위치 권한이 없어 현재 위치를 사용할 수 없습니다."
            : "현재 위치를 가져오지 못했습니다.";

        setIsLocating(false);
        setLocationMessage(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
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

  useEffect(() => {
    const container = mapContainerRef.current;

    if (!container) {
      return;
    }

    const updateSize = () => {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!naverMapKeyId) {
      return;
    }

    const handleSdkRuntimeError = (event: ErrorEvent) => {
      const filename = event.filename ?? "";
      const isNaverMapsRuntimeError =
        filename.includes("oapi.map.naver.com/openapi/v3/maps.js") ||
        filename.includes("map.naver.com/openapi/v3/maps.js");

      if (!isNaverMapsRuntimeError) {
        return;
      }

      event.preventDefault();
      failMap(
        "NAVER Maps SDK runtime error.",
        event.error ?? new Error(event.message),
      );
    };

    window.addEventListener("error", handleSdkRuntimeError);

    return () => {
      window.removeEventListener("error", handleSdkRuntimeError);
    };
  }, [failMap, naverMapKeyId]);

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
    mapMarkers,
    naverMapKeyId,
    shouldBootMap,
  ]);

  useEffect(() => {
    if (
      status !== "ready" ||
      !mapInstanceRef.current ||
      !pendingClusterFocusRef.current
    ) {
      return;
    }

    const nextCluster = pendingClusterFocusRef.current;
    pendingClusterFocusRef.current = null;
    focusCluster(nextCluster);
  }, [focusCluster, status]);

  useEffect(() => {
    if (
      status !== "ready" ||
      !mapInstanceRef.current ||
      !pendingLocateCurrentPositionRef.current
    ) {
      return;
    }

    pendingLocateCurrentPositionRef.current = false;
    runLocateCurrentPosition();
  }, [runLocateCurrentPosition, status]);

  useEffect(() => {
    if (status !== "ready" || !mapInstanceRef.current) {
      return;
    }

    const maps = getLoadedNaverMapSdk()?.maps;

    if (!maps?.Marker || !maps?.LatLng || !maps?.Event) {
      failMap("NAVER Maps marker primitives are unavailable.");
      return;
    }

    try {
      markerInstancesRef.current.forEach((marker) => marker.setMap?.(null));
      markerInstancesRef.current = displayMarkers.map((markerItem) => {
        const title =
          markerItem.kind === "cluster"
            ? `${formatMarkerCount(markerItem.placeCount)}곳`
            : markerItem.place.name;
        const marker = new maps.Marker({
          map: mapInstanceRef.current,
          position: new maps.LatLng(markerItem.latitude, markerItem.longitude),
          title,
          zIndex: markerItem.kind === "cluster" ? 10 : markerItem.zIndex,
          icon:
            markerItem.kind === "cluster"
              ? createClusterMarkerIcon(markerItem.placeCount, { maps })
              : createMapMarkerIcon(
                  markerItem.place,
                  markerItem.isActive,
                  { maps },
                  { x: markerItem.offsetX, y: markerItem.offsetY },
                ),
        });

        maps.Event.addListener(marker, "click", () => {
          if (markerItem.kind === "cluster") {
            focusCluster(markerItem);
            return;
          }

          emitPlaceSelect(markerItem.place);
        });

        return marker;
      });
    } catch (error) {
      failMap("Failed to render NAVER map markers.", error);
    }
  }, [displayMarkers, emitPlaceSelect, failMap, focusCluster, status]);

  useEffect(() => {
    if (status !== "ready" || !activePlace || !mapInstanceRef.current) {
      return;
    }

    const LatLng = getLoadedNaverMapSdk()?.maps?.LatLng;

    if (!LatLng) {
      failMap("NAVER Maps LatLng API is unavailable.");
      return;
    }

    try {
      const currentViewport = getViewportFromMap(mapInstanceRef.current);

      if (isPlaceInsideViewport(activePlace, currentViewport)) {
        return;
      }

      mapInstanceRef.current.panTo?.(
        new LatLng(activePlace.latitude, activePlace.longitude),
      );
    } catch (error) {
      failMap("Failed to move the NAVER map viewport.", error);
    }
  }, [activePlace, failMap, status]);

  useEffect(() => {
    if (
      status !== "ready" ||
      !mapInstanceRef.current ||
      !focusPlacesKey ||
      mapMarkers.length === 0
    ) {
      return;
    }

    if (lastFocusPlacesKeyRef.current === focusPlacesKey) {
      return;
    }

    const LatLng = getLoadedNaverMapSdk()?.maps?.LatLng;

    if (!LatLng) {
      failMap("NAVER Maps LatLng API is unavailable.");
      return;
    }

    try {
      const focusCenter = getMapCenter(mapMarkers);
      const point = new LatLng(focusCenter.lat, focusCenter.lng);

      lastFocusPlacesKeyRef.current = focusPlacesKey;
      mapInstanceRef.current.setCenter?.(point);
      mapInstanceRef.current.setZoom?.(getMapZoom(mapMarkers.length));
      mapInstanceRef.current.panTo?.(point);
      window.setTimeout(() => {
        emitViewportChange();
      }, 100);
    } catch (error) {
      failMap("Failed to focus the NAVER map viewport.", error);
    }
  }, [emitViewportChange, failMap, focusPlacesKey, mapMarkers, status]);

  useEffect(() => {
    if (status !== "ready" || !mapInstanceRef.current) {
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
  }, [containerSize.height, containerSize.width, emitViewportChange, status]);

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
