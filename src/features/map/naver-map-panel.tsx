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
  shellBackground: "rgba(255, 255, 255, 0.96)",
  shellBorder: "rgba(53, 65, 81, 0.16)",
  coreBackground: "#536273",
  coreBorder: "rgba(40, 48, 59, 0.26)",
  text: "#ffffff",
  shadow: "0 16px 32px rgba(15, 23, 42, 0.2)",
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
      outerSize: 70,
      innerSize: 54,
      fontSize: 16,
    };
  }

  if (placeCount >= 20) {
    return {
      outerSize: 62,
      innerSize: 48,
      fontSize: 15,
    };
  }

  return {
    outerSize: 54,
    innerSize: 40,
    fontSize: 14,
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
    <div style="width:${visual.outerSize}px;height:${visual.outerSize}px;display:flex;align-items:center;justify-content:center;">
      <span style="display:flex;align-items:center;justify-content:center;width:${visual.outerSize}px;height:${visual.outerSize}px;border-radius:999px;background:${CLUSTER_MARKER_THEME.shellBackground};border:1px solid ${CLUSTER_MARKER_THEME.shellBorder};box-shadow:${CLUSTER_MARKER_THEME.shadow};">
        <span style="display:flex;align-items:center;justify-content:center;width:${visual.innerSize}px;height:${visual.innerSize}px;border-radius:999px;background:${CLUSTER_MARKER_THEME.coreBackground};border:1px solid ${CLUSTER_MARKER_THEME.coreBorder};color:${CLUSTER_MARKER_THEME.text};font-size:${visual.fontSize}px;font-weight:800;line-height:1;letter-spacing:-0.02em;">
          ${formatLikeCount(placeCount)}
        </span>
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
    size: new Size(visual.outerSize, visual.outerSize),
    anchor: new Point(visual.outerSize / 2, visual.outerSize / 2),
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
      className="relative h-[36rem] bg-[linear-gradient(to_right,#e7e5e4_1px,transparent_1px),linear-gradient(to_bottom,#e7e5e4_1px,transparent_1px)] bg-[size:32px_32px] bg-stone-50 lg:h-[44rem]"
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
              }}
            >
              <span
                className="flex items-center justify-center rounded-full"
                style={{
                  width: `${clusterVisual.outerSize}px`,
                  height: `${clusterVisual.outerSize}px`,
                  background: CLUSTER_MARKER_THEME.shellBackground,
                  border: `1px solid ${CLUSTER_MARKER_THEME.shellBorder}`,
                  boxShadow: CLUSTER_MARKER_THEME.shadow,
                }}
              >
                <span
                  className="flex items-center justify-center rounded-full font-extrabold"
                  style={{
                    width: `${clusterVisual.innerSize}px`,
                    height: `${clusterVisual.innerSize}px`,
                    background: CLUSTER_MARKER_THEME.coreBackground,
                    border: `1px solid ${CLUSTER_MARKER_THEME.coreBorder}`,
                    color: CLUSTER_MARKER_THEME.text,
                    fontSize: `${clusterVisual.fontSize}px`,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {formatLikeCount(marker.placeCount)}
                </span>
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
      <div className="absolute bottom-4 left-4 rounded-2xl bg-white/90 px-4 py-3 text-sm text-stone-700 shadow-sm backdrop-blur">
        {selectedCategoryLabel
          ? `${selectedCategoryLabel} 카테고리만 표시 중`
          : "전체 카테고리 표시 중"}
        {hasClusterMarkers ? " · 가까운 장소는 묶어 표시합니다" : ""}
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
      className="relative isolate overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm"
      data-testid="map-panel-shell"
    >
      <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-stone-900">주변 지도</h2>
        <div className="altteulmap-badge whitespace-nowrap bg-stone-100 px-3 py-1 text-sm text-stone-600">
          {isLoading && mapMarkers.length === 0
            ? "불러오는 중"
            : `${placeCount ?? mapMarkers.length}곳`}
        </div>
      </div>

      <div className="relative isolate z-0 h-[36rem] lg:h-[44rem]">
        <PreviewMap
          markers={displayMarkers}
          selectedCategoryLabel={selectedCategoryLabel}
          onSelectPlace={onSelectPlace}
        />
        <div className="absolute left-4 top-4 z-10 rounded-2xl bg-white/95 px-4 py-3 text-sm text-stone-700 shadow-sm backdrop-blur">
          지도를 불러오지 못해 임시 미리보기로 표시합니다.
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
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [status, setStatus] = useState<MapStatus>(
    getNaverMapKeyId() ? "loading" : "missing-key",
  );
  const [hasVisibleMap, setHasVisibleMap] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [internalActivePlaceId, setInternalActivePlaceId] = useState<string | null>(
    mapMarkers.find((marker) => marker.kind === "place")?.id ?? null,
  );
  const naverMapKeyId = getNaverMapKeyId();
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
      if (controlledActivePlaceId === undefined) {
        setInternalActivePlaceId(place.id);
      }

      onSelectPlace?.(place);
    },
    [controlledActivePlaceId, onSelectPlace],
  );
  const emitPlaceSelect = useCallback(
    (place: PlacePreviewRecord) => {
      selectPlace(place);
    },
    [selectPlace],
  );
  const clearMapInstance = useCallback(() => {
    markerInstancesRef.current.forEach((marker) => marker.setMap?.(null));
    markerInstancesRef.current = [];
    currentLocationMarkerRef.current?.setMap?.(null);
    currentLocationMarkerRef.current = null;
    mapInstanceRef.current?.destroy?.();
    mapInstanceRef.current = null;
    lastViewportKeyRef.current = null;
    lastFocusPlacesKeyRef.current = null;
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

  const locateCurrentPosition = () => {
    if (status !== "ready" || !mapInstanceRef.current) {
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
  };

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
          ? "지도를 불러오는 중입니다."
          : null;

  return (
    <section
      className="relative isolate overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm"
      data-testid="map-panel-shell"
    >
      <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-stone-900">주변 지도</h2>
        <div className="altteulmap-badge whitespace-nowrap bg-stone-100 px-3 py-1 text-sm text-stone-600">
          {isLoading && mapMarkers.length === 0
            ? "불러오는 중"
            : `${placeCount ?? mapMarkers.length}곳`}
        </div>
      </div>

      <div className="relative isolate z-0 h-[36rem] lg:h-[44rem]">
        <div
          ref={mapContainerRef}
          data-testid="map-panel"
          className="altteulmap-naver-map relative z-0 h-full w-full overflow-hidden bg-stone-100"
        />

        {showPreview ? (
          <div className="absolute inset-0">
            <PreviewMap
              markers={displayMarkers}
              selectedCategoryLabel={selectedCategoryLabel}
              onSelectPlace={selectPlace}
              onActivateCluster={focusCluster}
            />
          </div>
        ) : null}

        <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2">
          {refreshAction?.isVisible ? (
            <button
              type="button"
              onClick={refreshAction.onRefresh}
              disabled={refreshAction.isLoading}
              data-testid="map-refresh-button"
              className="altteulmap-accent-solid altteulmap-button whitespace-nowrap px-4 py-2 text-sm font-medium shadow-lg shadow-orange-200/60 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {refreshAction.isLoading ? "검색 중" : "이 지역 검색"}
            </button>
          ) : null}
        </div>

        <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={locateCurrentPosition}
            disabled={status !== "ready" || isLocating}
            data-testid="map-current-location-button"
            className="altteulmap-button whitespace-nowrap border border-stone-300 bg-white/95 px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm backdrop-blur transition hover:bg-white disabled:cursor-not-allowed disabled:text-stone-400"
          >
            {isLocating ? "위치 확인 중" : "현재 위치"}
          </button>

          {locationMessage ? (
            <div className="max-w-[16rem] rounded-2xl bg-white/95 px-4 py-3 text-sm text-stone-700 shadow-sm backdrop-blur">
              {locationMessage}
            </div>
          ) : null}
        </div>

        {statusMessage ? (
          <div className="absolute left-4 top-4 z-10 rounded-2xl bg-white/95 px-4 py-3 text-sm text-stone-700 shadow-sm backdrop-blur">
            {statusMessage}
          </div>
        ) : null}
      </div>
    </section>
  );
}
