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
  CLUSTER_MARKER_THEME,
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

function LocalFallbackTileLayer({
  center,
  zoom,
}: {
  center: { latitude: number; longitude: number };
  zoom: number;
}) {
  const tiles = getLocalFallbackTiles(center, zoom);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--altteul-bg-surface)]">
      {tiles.map((tile) => (
        <img
          key={tile.key}
          src={tile.url}
          alt=""
          draggable={false}
          className="pointer-events-none absolute h-64 w-64 select-none"
          style={{
            left: tile.left,
            top: tile.top,
          }}
        />
      ))}
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
          zoom={localFallbackZoom}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--altteul-primary)_7%,transparent),transparent_30%),radial-gradient(circle_at_bottom_left,color-mix(in_oklch,var(--altteul-accent)_6%,transparent),transparent_28%)]" />
      )}
      {markers.map((marker) => {
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
              (markerTilePoint.y - centerTilePoint.y) *
                LOCAL_FALLBACK_TILE_SIZE
            : ((bounds.maxLat - marker.latitude) / latRange) * 70 + 10;
        const left =
          shouldShowLocalTiles && enableLocalWheelZoom
            ? localFallbackViewportSize.width / 2 +
              (markerTilePoint.x - centerTilePoint.x) *
                LOCAL_FALLBACK_TILE_SIZE
            : ((marker.longitude - bounds.minLng) / lngRange) * 72 + 8;
        const markerPositionUnit =
          shouldShowLocalTiles && enableLocalWheelZoom ? "px" : "%";

        if (marker.kind === "cluster") {
          const clusterVisual = getClusterMarkerVisual(marker.placeCount);

          return (
            <button
              key={marker.id}
              type="button"
              data-testid={`map-preview-marker-${marker.id}`}
              onClick={() => onActivateCluster?.(marker)}
              className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-[1.03]"
              style={{
                top: `${top}${markerPositionUnit}`,
                left: `${left}${markerPositionUnit}`,
                width: `${clusterVisual.hitSize}px`,
                height: `${clusterVisual.hitSize}px`,
              }}
            >
              <span
                className="flex items-center justify-center rounded-full"
                style={{
                  width: `${clusterVisual.badgeSize}px`,
                  height: `${clusterVisual.badgeSize}px`,
                  background: CLUSTER_MARKER_THEME.background,
                  border: `1px solid ${CLUSTER_MARKER_THEME.border}`,
                  boxShadow: `${CLUSTER_MARKER_THEME.shadow}, inset 0 0 0 ${clusterVisual.ringInset}px ${CLUSTER_MARKER_THEME.ring}`,
                  color: CLUSTER_MARKER_THEME.text,
                  fontSize: `${clusterVisual.fontSize}px`,
                  fontWeight: 600,
                  letterSpacing: "0",
                  fontVariantNumeric: "tabular-nums",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                }}
              >
                {formatMarkerCount(marker.placeCount)}
              </span>
            </button>
          );
        }

        const placeVisual = getPlaceMarkerVisual(marker.place, marker.isActive);
        const transformPrefix =
          marker.offsetX === 0 && marker.offsetY === 0
            ? ""
            : `translate(${marker.offsetX}px, ${marker.offsetY}px) `;

        return (
          <button
            key={marker.id}
            type="button"
            data-testid={`map-preview-marker-${marker.id}`}
            onClick={() => onSelectPlace(marker.place)}
            aria-label={`${marker.place.name} ${placeVisual.label}`}
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full transition-transform hover:scale-[1.035]"
            style={{
              top: `${top}${markerPositionUnit}`,
              left: `${left}${markerPositionUnit}`,
              zIndex: marker.zIndex,
              transform: `${transformPrefix}translate(-50%, -100%)`,
            }}
          >
            <span
              className="relative flex items-start justify-center pt-0.5"
              style={{
                width: `${placeVisual.canvasWidth}px`,
                height: `${placeVisual.canvasHeight}px`,
              }}
            >
              <span
                aria-hidden="true"
                className="absolute left-1/2 block"
                style={{
                  top: `${placeVisual.height - 1}px`,
                  width: `${placeVisual.tailSize}px`,
                  height: `${placeVisual.tailSize}px`,
                  background: placeVisual.tailBackground,
                  borderRight: `1.5px solid ${placeVisual.tailBorder}`,
                  borderBottom: `1.5px solid ${placeVisual.tailBorder}`,
                  boxShadow: "0 5px 10px rgba(15, 23, 42, 0.12)",
                  transform: "translateX(-50%) rotate(45deg)",
                }}
              />
              <span
                className="relative z-[1] flex items-center justify-center whitespace-nowrap rounded-full"
                style={{
                  width: `${placeVisual.width}px`,
                  height: `${placeVisual.height}px`,
                  background: placeVisual.background,
                  border: `1.5px solid ${placeVisual.border}`,
                  boxShadow: placeVisual.shadow,
                  color: placeVisual.text,
                  fontSize: `${placeVisual.fontSize}px`,
                  fontWeight: placeVisual.fontWeight,
                  letterSpacing: "0",
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {placeVisual.label}
              </span>
            </span>
          </button>
        );
      })}
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
