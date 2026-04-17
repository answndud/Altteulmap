"use client";

import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getCategoryBySlug } from "@/features/categories/catalog";
import {
  DEFAULT_MAP_CENTER,
  getLoadedNaverMapSdk,
  getNaverMapKeyId,
  getViewportFromMap,
  loadNaverMapSdk,
  type MapStatus,
  type MapViewport,
  type NaverMapInstance,
  type NaverMarkerInstance,
} from "@/features/map/naver-map-sdk";
import type {
  PlaceBounds,
  PlaceMapClusterMarkerRecord,
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
  onViewportChange?: (viewport: MapViewport) => void;
};

type PlaceDisplayMarker = {
  kind: "place";
  id: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
  place: PlacePreviewRecord;
};

type ClusterDisplayMarker = PlaceMapClusterMarkerRecord;

type MapDisplayMarker = PlaceDisplayMarker | ClusterDisplayMarker;

type IdleDeadlineLike = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type IdleWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (
      callback: (deadline: IdleDeadlineLike) => void,
      options?: { timeout: number },
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

const MAP_BOOT_DELAY_MS = 900;
const MAP_BOOT_IDLE_TIMEOUT_MS = 400;

function getMapZoom(placeCount: number) {
  return placeCount > 1 ? 13 : 15;
}

function getCenterFromBounds(bounds: PlaceBounds) {
  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lng: (bounds.minLng + bounds.maxLng) / 2,
  };
}

function getMapCenter(items: Array<{ latitude: number; longitude: number }>) {
  if (items.length === 0) {
    return DEFAULT_MAP_CENTER;
  }

  const totals = items.reduce(
    (accumulator, item) => ({
      lat: accumulator.lat + item.latitude,
      lng: accumulator.lng + item.longitude,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: totals.lat / items.length,
    lng: totals.lng / items.length,
  };
}

function getPreviewBounds(
  items: Array<{ latitude: number; longitude: number }>,
) {
  if (items.length === 0) {
    return {
      minLat: DEFAULT_MAP_CENTER.lat,
      maxLat: DEFAULT_MAP_CENTER.lat,
      minLng: DEFAULT_MAP_CENTER.lng,
      maxLng: DEFAULT_MAP_CENTER.lng,
    };
  }

  const latitudes = items.map((item) => item.latitude);
  const longitudes = items.map((item) => item.longitude);

  return {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLng: Math.min(...longitudes),
    maxLng: Math.max(...longitudes),
  };
}

function createPlaceDisplayMarker(
  place: PlaceMapPlaceMarkerRecord,
  isActive: boolean,
): PlaceDisplayMarker {
  return {
    kind: "place",
    id: place.id,
    latitude: place.latitude,
    longitude: place.longitude,
    isActive,
    place,
  };
}

function getDisplayMarkers(
  mapMarkers: PlaceMapMarkerRecord[],
  activePlaceId: string | null,
) {
  return mapMarkers.map((marker) =>
    marker.kind === "cluster"
      ? marker
      : createPlaceDisplayMarker(marker, marker.id === activePlaceId),
  ) satisfies MapDisplayMarker[];
}

function serializeViewport(viewport: MapViewport) {
  return [
    viewport.center.lat.toFixed(4),
    viewport.center.lng.toFixed(4),
    viewport.zoom.toFixed(2),
    viewport.bounds.minLat.toFixed(4),
    viewport.bounds.maxLat.toFixed(4),
    viewport.bounds.minLng.toFixed(4),
    viewport.bounds.maxLng.toFixed(4),
  ].join(":");
}

function isPlaceInsideViewport(
  place: Pick<PlacePreviewRecord, "latitude" | "longitude">,
  viewport: MapViewport | null,
  padding = 0.0003,
) {
  if (!viewport) {
    return false;
  }

  return (
    place.latitude >= viewport.bounds.minLat - padding &&
    place.latitude <= viewport.bounds.maxLat + padding &&
    place.longitude >= viewport.bounds.minLng - padding &&
    place.longitude <= viewport.bounds.maxLng + padding
  );
}

function formatLikeCount(count: number) {
  return new Intl.NumberFormat("ko-KR").format(count);
}

type PlaceMarkerGroupKey =
  | "food"
  | "life-services"
  | "shopping"
  | "health"
  | "study-work"
  | "fallback";

type PlaceMarkerTheme = {
  fill: string;
  activeFill: string;
  stroke: string;
  activeStroke: string;
  coreRing: string;
  coreDot: string;
};

const PLACE_MARKER_THEMES: Record<PlaceMarkerGroupKey, PlaceMarkerTheme> = {
  food: {
    fill: "#dc603e",
    activeFill: "#c44d2d",
    stroke: "rgba(126, 47, 25, 0.24)",
    activeStroke: "rgba(112, 38, 19, 0.32)",
    coreRing: "#8e3821",
    coreDot: "#dc603e",
  },
  "life-services": {
    fill: "#4f78bf",
    activeFill: "#3e61a6",
    stroke: "rgba(40, 65, 109, 0.22)",
    activeStroke: "rgba(31, 53, 92, 0.3)",
    coreRing: "#35558f",
    coreDot: "#4f78bf",
  },
  shopping: {
    fill: "#b25a72",
    activeFill: "#95445a",
    stroke: "rgba(106, 47, 64, 0.22)",
    activeStroke: "rgba(88, 35, 50, 0.3)",
    coreRing: "#7a3849",
    coreDot: "#b25a72",
  },
  health: {
    fill: "#2f8d69",
    activeFill: "#1f7454",
    stroke: "rgba(24, 87, 63, 0.22)",
    activeStroke: "rgba(17, 71, 50, 0.3)",
    coreRing: "#195a41",
    coreDot: "#2f8d69",
  },
  "study-work": {
    fill: "#4f647d",
    activeFill: "#3b5067",
    stroke: "rgba(43, 58, 74, 0.22)",
    activeStroke: "rgba(34, 46, 60, 0.3)",
    coreRing: "#314457",
    coreDot: "#4f647d",
  },
  fallback: {
    fill: "#9a613f",
    activeFill: "#7d4a2b",
    stroke: "rgba(95, 56, 34, 0.22)",
    activeStroke: "rgba(79, 44, 24, 0.3)",
    coreRing: "#693b21",
    coreDot: "#9a613f",
  },
};

const CLUSTER_MARKER_THEME = {
  background:
    "linear-gradient(180deg, rgba(228, 236, 247, 0.97) 0%, rgba(212, 224, 240, 0.95) 100%)",
  border: "rgba(88, 110, 143, 0.24)",
  ring: "rgba(183, 198, 223, 0.94)",
  text: "#334155",
  shadow: "0 7px 16px rgba(71, 85, 105, 0.14)",
} as const;

function getPlaceMarkerGroupKey(
  categorySlug: string | null | undefined,
): PlaceMarkerGroupKey {
  const parentSlug = getCategoryBySlug(categorySlug)?.parentSlug;

  switch (parentSlug) {
    case "food":
    case "life-services":
    case "shopping":
    case "health":
    case "study-work":
      return parentSlug;
    default:
      return "fallback";
  }
}

function getPlaceMarkerVisual(
  categorySlug: string | null | undefined,
  isActive: boolean,
) {
  const theme = PLACE_MARKER_THEMES[getPlaceMarkerGroupKey(categorySlug)];

  return {
    canvasWidth: isActive ? 48 : 44,
    canvasHeight: isActive ? 58 : 54,
    pinSize: isActive ? 34 : 30,
    coreSize: isActive ? 16 : 14,
    dotSize: isActive ? 6 : 5,
    fill: isActive ? theme.activeFill : theme.fill,
    stroke: isActive ? theme.activeStroke : theme.stroke,
    coreRing: theme.coreRing,
    coreDot: theme.coreDot,
    outline: "rgba(255, 255, 255, 0.98)",
    shadow: `0 0 0 3px rgba(255,255,255,0.94), 0 0 0 4.5px ${
      isActive ? theme.activeStroke : theme.stroke
    }, 0 ${isActive ? 18 : 14}px ${isActive ? 32 : 26}px rgba(15,23,42,${
      isActive ? "0.26" : "0.2"
    })`,
  };
}

function getClusterMarkerVisual(placeCount: number) {
  if (placeCount >= 100) {
    return {
      hitSize: 52,
      badgeSize: 38,
      fontSize: 12,
      ringInset: 2.5,
    };
  }

  if (placeCount >= 20) {
    return {
      hitSize: 46,
      badgeSize: 34,
      fontSize: 11,
      ringInset: 2.5,
    };
  }

  return {
    hitSize: 40,
    badgeSize: 30,
    fontSize: 10,
    ringInset: 2,
  };
}

function createPlaceMarkerIconHtml(
  categorySlug: string | null | undefined,
  isActive: boolean,
) {
  const visual = getPlaceMarkerVisual(categorySlug, isActive);

  return `
    <div style="width:${visual.canvasWidth}px;height:${visual.canvasHeight}px;display:flex;align-items:flex-end;justify-content:center;">
      <span style="position:relative;display:block;width:${visual.pinSize}px;height:${visual.pinSize}px;border-radius:${visual.pinSize}px ${visual.pinSize}px ${visual.pinSize}px 0;background:${visual.fill};border:2px solid ${visual.outline};box-shadow:${visual.shadow};transform:rotate(-45deg);">
        <span style="position:absolute;left:50%;top:50%;width:${visual.coreSize}px;height:${visual.coreSize}px;border-radius:999px;background:#ffffff;border:2px solid ${visual.coreRing};transform:translate(-50%,-50%) rotate(45deg);">
          <span style="position:absolute;left:50%;top:50%;width:${visual.dotSize}px;height:${visual.dotSize}px;border-radius:999px;background:${visual.coreDot};transform:translate(-50%,-50%);"></span>
        </span>
      </span>
    </div>
  `;
}

function createMapMarkerIcon(
  categorySlug: string | null | undefined,
  isActive: boolean,
  naver: ReturnType<typeof getLoadedNaverMapSdk>,
) {
  const Point = naver?.maps.Point;
  const Size = naver?.maps.Size;

  if (!Point || !Size) {
    return undefined;
  }

  const visual = getPlaceMarkerVisual(categorySlug, isActive);

  return {
    content: createPlaceMarkerIconHtml(categorySlug, isActive),
    size: new Size(visual.canvasWidth, visual.canvasHeight),
    anchor: new Point(visual.canvasWidth / 2, visual.canvasHeight),
  };
}

function createClusterIconHtml(placeCount: number) {
  const visual = getClusterMarkerVisual(placeCount);

  return `
    <div style="width:${visual.hitSize}px;height:${visual.hitSize}px;display:flex;align-items:center;justify-content:center;">
      <span style="display:flex;align-items:center;justify-content:center;width:${visual.badgeSize}px;height:${visual.badgeSize}px;border-radius:999px;background:${CLUSTER_MARKER_THEME.background};border:1px solid ${CLUSTER_MARKER_THEME.border};box-shadow:${CLUSTER_MARKER_THEME.shadow}, inset 0 0 0 ${visual.ringInset}px ${CLUSTER_MARKER_THEME.ring};color:${CLUSTER_MARKER_THEME.text};font-size:${visual.fontSize}px;font-weight:600;line-height:1;letter-spacing:0;font-variant-numeric:tabular-nums;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);">
        ${formatLikeCount(placeCount)}
      </span>
    </div>
  `;
}

function createClusterMarkerIcon(
  placeCount: number,
  naver: ReturnType<typeof getLoadedNaverMapSdk>,
) {
  const Point = naver?.maps.Point;
  const Size = naver?.maps.Size;

  if (!Point || !Size) {
    return undefined;
  }

  const visual = getClusterMarkerVisual(placeCount);

  return {
    content: createClusterIconHtml(placeCount),
    size: new Size(visual.hitSize, visual.hitSize),
    anchor: new Point(visual.hitSize / 2, visual.hitSize / 2),
  };
}

function PreviewMap({
  markers,
  selectedCategoryLabel,
  onSelectPlace,
  onActivateCluster,
}: {
  markers: MapDisplayMarker[];
  selectedCategoryLabel: string | null;
  onSelectPlace: (place: PlacePreviewRecord) => void;
  onActivateCluster?: (marker: ClusterDisplayMarker) => void;
}) {
  const bounds = getPreviewBounds(markers);
  const latRange = Math.max(bounds.maxLat - bounds.minLat, 0.01);
  const lngRange = Math.max(bounds.maxLng - bounds.minLng, 0.01);
  const hasClusterMarkers = markers.some((marker) => marker.kind === "cluster");

  return (
    <div
      className="relative h-[34rem] bg-[linear-gradient(to_right,#e7e5e4_1px,transparent_1px),linear-gradient(to_bottom,#e7e5e4_1px,transparent_1px)] bg-[size:32px_32px] bg-stone-50 lg:h-[43rem]"
      data-testid="map-panel-preview"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.12),transparent_28%)]" />
      {markers.map((marker) => {
        const top = ((bounds.maxLat - marker.latitude) / latRange) * 70 + 10;
        const left = ((marker.longitude - bounds.minLng) / lngRange) * 72 + 8;

        if (marker.kind === "cluster") {
          const clusterVisual = getClusterMarkerVisual(marker.placeCount);

          return (
            <button
              key={marker.id}
              type="button"
              data-testid={`map-preview-marker-${marker.id}`}
              onClick={() => onActivateCluster?.(marker)}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-[1.03]"
              style={{
                top: `${top}%`,
                left: `${left}%`,
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
                {formatLikeCount(marker.placeCount)}
              </span>
            </button>
          );
        }

        const placeVisual = getPlaceMarkerVisual(
          marker.place.categorySlug,
          marker.isActive,
        );

        return (
          <button
            key={marker.id}
            type="button"
            data-testid={`map-preview-marker-${marker.id}`}
            onClick={() => onSelectPlace(marker.place)}
            className="absolute -translate-x-1/2 -translate-y-full transition-transform hover:scale-[1.04]"
            style={{
              top: `${top}%`,
              left: `${left}%`,
            }}
          >
            <span
              className="flex items-end justify-center"
              style={{
                width: `${placeVisual.canvasWidth}px`,
                height: `${placeVisual.canvasHeight}px`,
              }}
            >
              <span
                className="relative block"
                style={{
                  width: `${placeVisual.pinSize}px`,
                  height: `${placeVisual.pinSize}px`,
                  borderRadius: `${placeVisual.pinSize}px ${placeVisual.pinSize}px ${placeVisual.pinSize}px 0`,
                  background: placeVisual.fill,
                  border: `2px solid ${placeVisual.outline}`,
                  boxShadow: placeVisual.shadow,
                  transform: "rotate(-45deg)",
                }}
              >
                <span
                  className="absolute left-1/2 top-1/2 block rounded-full bg-white"
                  style={{
                    width: `${placeVisual.coreSize}px`,
                    height: `${placeVisual.coreSize}px`,
                    border: `2px solid ${placeVisual.coreRing}`,
                    transform: "translate(-50%, -50%) rotate(45deg)",
                  }}
                >
                  <span
                    className="absolute left-1/2 top-1/2 block rounded-full"
                    style={{
                      width: `${placeVisual.dotSize}px`,
                      height: `${placeVisual.dotSize}px`,
                      background: placeVisual.coreDot,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                </span>
              </span>
            </span>
          </button>
        );
      })}
      <div className="altteulmap-map-overlay absolute bottom-4 left-4 max-w-[17rem] px-3.5 py-3 text-sm text-stone-700">
        <p className="font-medium text-stone-900">
          {selectedCategoryLabel
            ? `${selectedCategoryLabel} 카테고리`
            : "전체 카테고리"}
        </p>
        <p className="mt-1 text-xs leading-5 text-stone-600">
          {hasClusterMarkers
            ? "가까운 장소는 숫자 클러스터로 묶어 보여줍니다."
            : "선택한 조건의 개별 장소를 바로 표시합니다."}
        </p>
      </div>
    </div>
  );
}

function NaverMapFallback({
  isLoading = false,
  mapMarkers,
  placeCount,
  selectedCategoryLabel,
  activePlaceId,
  onSelectPlace,
}: {
  isLoading?: boolean;
  mapMarkers: PlaceMapMarkerRecord[];
  placeCount?: number;
  selectedCategoryLabel: string | null;
  activePlaceId?: string | null;
  onSelectPlace: (place: PlacePreviewRecord) => void;
}) {
  const displayMarkers = useMemo(
    () => getDisplayMarkers(mapMarkers, activePlaceId ?? null),
    [activePlaceId, mapMarkers],
  );

  return (
    <section
      className="altteulmap-panel relative isolate overflow-hidden"
      data-testid="map-panel-shell"
    >
      <div className="relative isolate z-0 h-[34rem] lg:h-[43rem]">
        <PreviewMap
          markers={displayMarkers}
          selectedCategoryLabel={selectedCategoryLabel}
          onSelectPlace={onSelectPlace}
        />
        <div className="altteulmap-map-overlay absolute left-4 top-4 z-10 max-w-[17rem] px-3.5 py-3 text-sm text-stone-700">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium text-stone-900">임시 미리보기</p>
            <span className="altteulmap-badge whitespace-nowrap px-2.5 py-1 text-[11px] font-medium">
              {isLoading && mapMarkers.length === 0
                ? "불러오는 중"
                : `${placeCount ?? mapMarkers.length}곳`}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-stone-600">
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
  const naverMapKeyId = getNaverMapKeyId();
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [shouldBootMap, setShouldBootMap] = useState(false);
  const [status, setStatus] = useState<MapStatus>(
    naverMapKeyId ? "loading" : "missing-key",
  );
  const [hasVisibleMap, setHasVisibleMap] = useState(false);
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
  const showPreview = status !== "ready" || !hasVisibleMap;

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
      setHasVisibleMap(false);
      setStatus("error");
    },
    [clearMapInstance],
  );
  const emitViewportChange = useCallback(() => {
    const viewport = getViewportFromMap(mapInstanceRef.current);

    if (!viewport) {
      return;
    }

    const nextKey = serializeViewport(viewport);

    if (lastViewportKeyRef.current === nextKey) {
      return;
    }

    lastViewportKeyRef.current = nextKey;
    onViewportChange?.(viewport);
  }, [onViewportChange]);
  const focusCluster = useCallback(
    (marker: ClusterDisplayMarker) => {
      if (status !== "ready" || !mapInstanceRef.current) {
        return;
      }

      const maps = getLoadedNaverMapSdk()?.maps;

      if (!maps?.LatLng || !maps?.LatLngBounds) {
        failMap("NAVER Maps LatLng API is unavailable.");
        return;
      }

      try {
        const southWest = new maps.LatLng(
          marker.bounds.minLat,
          marker.bounds.minLng,
        );
        const northEast = new maps.LatLng(
          marker.bounds.maxLat,
          marker.bounds.maxLng,
        );
        const clusterBounds = new maps.LatLngBounds(southWest, northEast);
        const nextCenter = new maps.LatLng(marker.latitude, marker.longitude);
        const latSpan = Math.abs(marker.bounds.maxLat - marker.bounds.minLat);
        const lngSpan = Math.abs(marker.bounds.maxLng - marker.bounds.minLng);

        if (latSpan < 0.0004 && lngSpan < 0.0004) {
          const currentZoom = mapInstanceRef.current.getZoom?.() ?? 13;
          mapInstanceRef.current.setCenter?.(nextCenter);
          mapInstanceRef.current.setZoom?.(Math.min(currentZoom + 2, 17));
          mapInstanceRef.current.panTo?.(nextCenter);
        } else {
          mapInstanceRef.current.fitBounds?.(clusterBounds);
        }

        window.setTimeout(() => {
          emitViewportChange();
        }, 100);
      } catch (error) {
        failMap("Failed to focus the NAVER map cluster.", error);
      }
    },
    [emitViewportChange, failMap, status],
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
      requestMapBoot();

      if (status !== "ready" || !mapInstanceRef.current) {
        pendingClusterFocusRef.current = marker;
        return;
      }

      focusCluster(marker);
    },
    [focusCluster, requestMapBoot, status],
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
    if (!naverMapKeyId || shouldBootMap) {
      return;
    }

    const idleWindow = window as IdleWindow;
    let isDisposed = false;
    let idleCallbackId: number | null = null;

    const bootMap = () => {
      if (isDisposed) {
        return;
      }

      setShouldBootMap(true);
    };

    const timeoutId = window.setTimeout(() => {
      if (typeof idleWindow.requestIdleCallback === "function") {
        idleCallbackId = idleWindow.requestIdleCallback(
          () => {
            bootMap();
          },
          { timeout: MAP_BOOT_IDLE_TIMEOUT_MS },
        );
        return;
      }

      bootMap();
    }, MAP_BOOT_DELAY_MS);

    return () => {
      isDisposed = true;
      window.clearTimeout(timeoutId);

      if (
        idleCallbackId !== null &&
        typeof idleWindow.cancelIdleCallback === "function"
      ) {
        idleWindow.cancelIdleCallback(idleCallbackId);
      }
    };
  }, [naverMapKeyId, shouldBootMap]);

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

          setHasVisibleMap(false);
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
    if (status !== "ready") {
      return;
    }

    const container = mapContainerRef.current;

    if (!container) {
      return;
    }

    const hasLoadedMapImage = () =>
      Array.from(container.querySelectorAll("img")).some((image) => {
        if (!(image instanceof HTMLImageElement)) {
          return false;
        }

        const isMapAsset =
          image.src.includes("map.naver.net") ||
          image.src.includes(".pstatic.net/styles/") ||
          image.src.includes(".pstatic.net/static/maps/") ||
          image.src.includes("pstatic.net/maps") ||
          image.src.includes("static.naver.net/maps");

        return isMapAsset && image.complete && image.naturalWidth > 1;
      });

    const syncVisibility = () => {
      if (hasLoadedMapImage()) {
        setHasVisibleMap(true);
        return true;
      }

      return false;
    };

    if (syncVisibility()) {
      return;
    }

    const mutationObserver = new MutationObserver(() => {
      if (syncVisibility()) {
        mutationObserver.disconnect();
      }
    });

    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src"],
    });

    const visibilityIntervalId = window.setInterval(() => {
      if (syncVisibility()) {
        window.clearInterval(visibilityIntervalId);
        mutationObserver.disconnect();
      }
    }, 300);

    const visibilityTimeoutId = window.setTimeout(() => {
      window.clearInterval(visibilityIntervalId);
      mutationObserver.disconnect();
    }, 8000);

    return () => {
      window.clearInterval(visibilityIntervalId);
      window.clearTimeout(visibilityTimeoutId);
      mutationObserver.disconnect();
    };
  }, [containerSize.height, containerSize.width, mapMarkers, status]);

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
            ? `${formatLikeCount(markerItem.placeCount)}곳`
            : markerItem.place.name;
        const marker = new maps.Marker({
          map: mapInstanceRef.current,
          position: new maps.LatLng(markerItem.latitude, markerItem.longitude),
          title,
          icon:
            markerItem.kind === "cluster"
              ? createClusterMarkerIcon(markerItem.placeCount, { maps })
              : createMapMarkerIcon(
                  markerItem.place.categorySlug,
                  markerItem.isActive,
                  { maps },
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
    status === "missing-key"
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
      <div className="relative isolate z-0 h-[34rem] lg:h-[43rem]">
        <div
          ref={mapContainerRef}
          data-testid="map-panel"
          className="altteulmap-naver-map relative z-0 h-full w-full overflow-hidden bg-stone-100"
        />

        {showPreview ? (
          <div
            className="absolute inset-0"
            onPointerDownCapture={requestMapBoot}
            onKeyDownCapture={requestMapBoot}
          >
            <PreviewMap
              markers={displayMarkers}
              selectedCategoryLabel={selectedCategoryLabel}
              onSelectPlace={selectPlace}
              onActivateCluster={handlePreviewClusterActivate}
            />
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-3">
          <div className="pointer-events-auto grid max-w-[15.5rem] gap-2 sm:max-w-[18rem]">
            <div className="altteulmap-map-overlay px-3.5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="altteulmap-section-kicker text-[10px]">지도</p>
                  <h2 className="mt-1 text-sm font-semibold text-stone-900 sm:text-base">
                    주변 가격 보기
                  </h2>
                </div>
                <span className="altteulmap-badge shrink-0 whitespace-nowrap px-2.5 py-1 text-[11px] font-medium">
                  {placeCountLabel}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-stone-600">
                {selectedCategoryLabel
                  ? `${selectedCategoryLabel} 카테고리 기준으로 보고 있습니다.`
                  : "대표 가격과 최근 제보를 함께 확인합니다."}
              </p>
            </div>

            {statusMessage ? (
              <div className="altteulmap-map-overlay-subtle px-3 py-2 text-xs leading-5 text-stone-600">
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
                className="altteulmap-accent-solid altteulmap-button w-fit whitespace-nowrap px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70"
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
              className="altteulmap-map-overlay-subtle inline-flex whitespace-nowrap px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-white disabled:cursor-not-allowed disabled:text-stone-400"
            >
              {isLocating ? "위치 확인 중" : "현재 위치"}
            </button>

            {locationMessage ? (
              <div className="altteulmap-map-overlay-subtle max-w-[13rem] px-3 py-2 text-right text-xs leading-5 text-stone-600">
                {locationMessage}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
