"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";

import type { ClusterDisplayMarker, MapDisplayMarker } from "@/features/map/naver-map-display-markers";
import { getPreviewBounds } from "@/features/map/naver-map-display-markers";
import {
  formatMarkerCount,
  getClusterMarkerVisual,
  getPlaceMarkerVisual,
} from "@/features/map/naver-map-marker-visuals";
import {
  getLocalFallbackTiles,
  getPointFromTilePoint,
  getTilePoint,
  LOCAL_FALLBACK_MAX_ZOOM,
  LOCAL_FALLBACK_MIN_ZOOM,
  LOCAL_FALLBACK_TILE_SIZE,
  LOCAL_FALLBACK_TILE_ZOOM,
  type TilePoint,
} from "@/features/map/naver-map-local-tiles";
import {
  getMapCenter,
  isLocalMapFallbackHost,
} from "@/features/map/naver-map-panel-helpers";
import type { PlacePreviewRecord } from "@/features/places/types";

type LocalFallbackCenter = {
  latitude: number;
  longitude: number;
};

type LocalFallbackDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startCenterTile: TilePoint;
};

function getClusterMarkerSizeClass(placeCount: number) {
  if (placeCount >= 100) {
    return "altteulmap-cluster-marker--lg";
  }

  if (placeCount >= 20) {
    return "altteulmap-cluster-marker--md";
  }

  return "altteulmap-cluster-marker--sm";
}

function getPlaceMarkerToneClass(
  marker: Extract<MapDisplayMarker, { kind: "place" }>,
) {
  if (marker.isActive) {
    return "altteulmap-marker-icon--active";
  }

  return marker.place.verificationStatus === "verified"
    ? "altteulmap-marker-icon--verified"
    : "altteulmap-marker-icon--unverified";
}

function LocalFallbackTileLayer({
  center,
  zoom,
  viewportSize,
}: {
  center: { latitude: number; longitude: number };
  zoom: number;
  viewportSize: { width: number; height: number };
}) {
  const tiles = getLocalFallbackTiles(center, zoom);
  const viewBoxWidth = Math.max(1, viewportSize.width);
  const viewBoxHeight = Math.max(1, viewportSize.height);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--altteul-bg-surface)]">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full select-none"
        preserveAspectRatio="none"
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      >
        {tiles.map((tile) => (
          <image
            key={tile.key}
            href={tile.url}
            height={LOCAL_FALLBACK_TILE_SIZE}
            preserveAspectRatio="none"
            width={LOCAL_FALLBACK_TILE_SIZE}
            x={tile.left}
            y={tile.top}
          />
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 bg-white/10" />
    </div>
  );
}

export function PreviewMap({
  markers,
  selectedCategoryLabel,
  onSelectPlace,
  onActivateCluster,
  enableLocalWheelZoom = false,
}: {
  markers: MapDisplayMarker[];
  selectedCategoryLabel: string | null;
  onSelectPlace: (place: PlacePreviewRecord) => void;
  onActivateCluster?: (marker: ClusterDisplayMarker) => void;
  enableLocalWheelZoom?: boolean;
}) {
  const [localFallbackZoom, setLocalFallbackZoom] = useState(
    LOCAL_FALLBACK_TILE_ZOOM,
  );
  const fallbackCenter = getMapCenter(markers);
  const fallbackInitialCenter = useMemo(
    () => ({
      latitude: fallbackCenter.lat,
      longitude: fallbackCenter.lng,
    }),
    [fallbackCenter.lat, fallbackCenter.lng],
  );
  const [localFallbackCenter, setLocalFallbackCenter] =
    useState<LocalFallbackCenter>(fallbackInitialCenter);
  const previewMapRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<LocalFallbackDragState | null>(null);
  const [localFallbackViewportSize, setLocalFallbackViewportSize] = useState({
    width: 0,
    height: 0,
  });
  const dataBounds = getPreviewBounds(markers);
  const hasClusterMarkers = markers.some((marker) => marker.kind === "cluster");
  const shouldShowLocalTiles = isLocalMapFallbackHost();
  const zoomScale =
    shouldShowLocalTiles && enableLocalWheelZoom
      ? 2 ** (localFallbackZoom - LOCAL_FALLBACK_TILE_ZOOM)
      : 1;
  const latRange =
    Math.max(dataBounds.maxLat - dataBounds.minLat, 0.01) / zoomScale;
  const lngRange =
    Math.max(dataBounds.maxLng - dataBounds.minLng, 0.01) / zoomScale;
  const bounds =
    shouldShowLocalTiles && enableLocalWheelZoom
      ? {
          minLat: localFallbackCenter.latitude - latRange / 2,
          maxLat: localFallbackCenter.latitude + latRange / 2,
          minLng: localFallbackCenter.longitude - lngRange / 2,
          maxLng: localFallbackCenter.longitude + lngRange / 2,
        }
      : dataBounds;
  const centerTilePoint = getTilePoint(localFallbackCenter, localFallbackZoom);
  const markerCanvasWidth =
    shouldShowLocalTiles && enableLocalWheelZoom
      ? Math.max(1, localFallbackViewportSize.width)
      : 100;
  const markerCanvasHeight =
    shouldShowLocalTiles && enableLocalWheelZoom
      ? Math.max(1, localFallbackViewportSize.height)
      : 100;
  const markerDisplayItems = markers
    .map((marker) => {
      const markerTilePoint = getTilePoint(
        {
          latitude: marker.latitude,
          longitude: marker.longitude,
        },
        localFallbackZoom,
      );
      const top =
        shouldShowLocalTiles && enableLocalWheelZoom
          ? localFallbackViewportSize.height / 2 +
            (markerTilePoint.y - centerTilePoint.y) * LOCAL_FALLBACK_TILE_SIZE
          : ((bounds.maxLat - marker.latitude) / latRange) * 70 + 10;
      const left =
        shouldShowLocalTiles && enableLocalWheelZoom
          ? localFallbackViewportSize.width / 2 +
            (markerTilePoint.x - centerTilePoint.x) * LOCAL_FALLBACK_TILE_SIZE
          : ((marker.longitude - bounds.minLng) / lngRange) * 72 + 8;

      return {
        marker,
        top,
        left,
        zIndex: marker.kind === "cluster" ? 10 : marker.zIndex,
      };
    })
    .sort((leftItem, rightItem) => leftItem.zIndex - rightItem.zIndex);
  const zoomLocalFallback = useCallback((deltaY: number) => {
    const direction = deltaY < 0 ? 1 : -1;

    setLocalFallbackZoom((currentZoom) =>
      Math.max(
        LOCAL_FALLBACK_MIN_ZOOM,
        Math.min(LOCAL_FALLBACK_MAX_ZOOM, currentZoom + direction),
      ),
    );
  }, []);

  useEffect(() => {
    if (!shouldShowLocalTiles || !enableLocalWheelZoom) {
      return;
    }

    setLocalFallbackCenter(fallbackInitialCenter);
  }, [enableLocalWheelZoom, fallbackInitialCenter, shouldShowLocalTiles]);

  useEffect(() => {
    const previewMap = previewMapRef.current;

    if (!previewMap) {
      return;
    }

    const updateSize = () => {
      setLocalFallbackViewportSize({
        width: previewMap.clientWidth,
        height: previewMap.clientHeight,
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(previewMap);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const previewMap = previewMapRef.current;

    if (!previewMap || !shouldShowLocalTiles || !enableLocalWheelZoom) {
      return;
    }

    const handleWheel = (event: globalThis.WheelEvent) => {
      if (!shouldShowLocalTiles || !enableLocalWheelZoom) {
        return;
      }

      event.preventDefault();
      zoomLocalFallback(event.deltaY);
    };

    previewMap.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      previewMap.removeEventListener("wheel", handleWheel);
    };
  }, [enableLocalWheelZoom, shouldShowLocalTiles, zoomLocalFallback]);

  const handleLocalPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!shouldShowLocalTiles || !enableLocalWheelZoom || event.button !== 0) {
        return;
      }

      const target = event.target as HTMLElement | null;

      if (target?.closest("button")) {
        return;
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      dragStateRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startCenterTile: getTilePoint(localFallbackCenter, localFallbackZoom),
      };
    },
    [
      enableLocalWheelZoom,
      localFallbackCenter,
      localFallbackZoom,
      shouldShowLocalTiles,
    ],
  );

  const handleLocalPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const dragState = dragStateRef.current;

      if (
        !dragState ||
        dragState.pointerId !== event.pointerId ||
        !shouldShowLocalTiles ||
        !enableLocalWheelZoom
      ) {
        return;
      }

      const deltaX = event.clientX - dragState.startClientX;
      const deltaY = event.clientY - dragState.startClientY;
      const nextCenterTile = {
        x: dragState.startCenterTile.x - deltaX / LOCAL_FALLBACK_TILE_SIZE,
        y: dragState.startCenterTile.y - deltaY / LOCAL_FALLBACK_TILE_SIZE,
      };

      setLocalFallbackCenter(
        getPointFromTilePoint(nextCenterTile, localFallbackZoom),
      );
    },
    [enableLocalWheelZoom, localFallbackZoom, shouldShowLocalTiles],
  );

  const finishLocalPointerDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (dragStateRef.current?.pointerId !== event.pointerId) {
        return;
      }

      dragStateRef.current = null;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [],
  );

  return (
    <div
      ref={previewMapRef}
      className={`${enableLocalWheelZoom ? "pointer-events-auto cursor-grab touch-none active:cursor-grabbing" : "pointer-events-none"} relative h-[42rem] bg-[linear-gradient(to_right,color-mix(in_oklch,var(--altteul-surface-border)_68%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--altteul-surface-border)_68%,transparent)_1px,transparent_1px)] bg-[size:32px_32px] bg-[var(--altteul-bg-surface)] lg:h-[calc(100dvh-11rem)] lg:min-h-[50rem]`}
      data-testid="map-panel-preview"
      data-local-zoom={shouldShowLocalTiles ? localFallbackZoom : undefined}
      data-local-center={
        shouldShowLocalTiles
          ? `${localFallbackCenter.latitude.toFixed(5)},${localFallbackCenter.longitude.toFixed(5)}`
          : undefined
      }
      onPointerDown={handleLocalPointerDown}
      onPointerMove={handleLocalPointerMove}
      onPointerUp={finishLocalPointerDrag}
      onPointerCancel={finishLocalPointerDrag}
    >
      {shouldShowLocalTiles ? (
        <LocalFallbackTileLayer
          center={localFallbackCenter}
          viewportSize={localFallbackViewportSize}
          zoom={localFallbackZoom}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--altteul-primary)_7%,transparent),transparent_30%),radial-gradient(circle_at_bottom_left,color-mix(in_oklch,var(--altteul-accent)_6%,transparent),transparent_28%)]" />
      )}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        preserveAspectRatio="none"
        viewBox={`0 0 ${markerCanvasWidth} ${markerCanvasHeight}`}
      >
        {markerDisplayItems.map(({ left, marker, top }) => {
          if (marker.kind === "cluster") {
            const clusterSizeClass = getClusterMarkerSizeClass(marker.placeCount);
            const clusterVisual = getClusterMarkerVisual(marker.placeCount);

            return (
              <foreignObject
                key={marker.id}
                height={clusterVisual.hitSize}
                width={clusterVisual.hitSize}
                x={left - clusterVisual.hitSize / 2}
                y={top - clusterVisual.hitSize / 2}
              >
                <button
                  type="button"
                  data-testid={`map-preview-marker-${marker.id}`}
                  data-marker-kind="cluster"
                  onClick={() => onActivateCluster?.(marker)}
                  className={`altteulmap-cluster-marker pointer-events-auto h-full w-full transition-transform hover:scale-[1.03] ${clusterSizeClass}`}
                >
                  <span className="altteulmap-cluster-marker__badge">
                    {formatMarkerCount(marker.placeCount)}
                  </span>
                </button>
              </foreignObject>
            );
          }

          const placeVisual = getPlaceMarkerVisual(
            marker.place,
            marker.isActive,
          );
          const placeToneClass = getPlaceMarkerToneClass(marker);

          return (
            <foreignObject
              key={marker.id}
              height={placeVisual.canvasHeight}
              width={placeVisual.canvasWidth}
              x={left - placeVisual.canvasWidth / 2 + marker.offsetX}
              y={top - placeVisual.canvasHeight + marker.offsetY}
            >
              <button
                type="button"
                data-testid={`map-preview-marker-${marker.id}`}
                data-marker-kind="place"
                onClick={() => onSelectPlace(marker.place)}
                aria-label={`${marker.place.name} ${placeVisual.label}`}
                className="pointer-events-auto h-full w-full transition-transform hover:scale-[1.035]"
              >
                <span className={`altteulmap-marker-icon ${placeToneClass}`}>
                  <span
                    aria-hidden="true"
                    className="altteulmap-marker-icon__tail"
                  />
                  <span className="altteulmap-marker-icon__label">
                    {placeVisual.label}
                  </span>
                </span>
              </button>
            </foreignObject>
          );
        })}
      </svg>
      <div className="altteulmap-map-overlay absolute bottom-4 left-4 max-w-[17rem] px-3.5 py-3 text-sm text-[var(--altteul-text-primary)]">
        <p className="font-semibold text-[var(--altteul-text-strong)]">
          {selectedCategoryLabel
            ? `${selectedCategoryLabel} 카테고리`
            : "전체 카테고리"}
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--altteul-text-secondary)]">
          {hasClusterMarkers
            ? "가까운 장소는 숫자 클러스터로 묶어 보여줍니다."
            : "선택한 조건의 개별 장소를 바로 표시합니다."}
        </p>
      </div>
    </div>
  );
}
