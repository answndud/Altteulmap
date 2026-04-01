"use client";

import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import type { PlaceBounds, PlaceRecord } from "@/features/places/types";

type NaverMapPanelProps = {
  initialBounds?: PlaceBounds | null;
  places: PlaceRecord[];
  selectedCategoryLabel: string | null;
  activePlaceId?: string | null;
  focusPlacesKey?: string | null;
  onSelectPlace?: (placeId: string) => void;
  onViewportChange?: (viewport: MapViewport) => void;
};

function getMapZoom(placeCount: number) {
  return placeCount > 1 ? 13 : 15;
}

function getMapCenter(places: PlaceRecord[]) {
  if (places.length === 0) {
    return DEFAULT_MAP_CENTER;
  }

  const totals = places.reduce(
    (accumulator, place) => ({
      lat: accumulator.lat + place.latitude,
      lng: accumulator.lng + place.longitude,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: totals.lat / places.length,
    lng: totals.lng / places.length,
  };
}

function getCenterFromBounds(bounds: PlaceBounds) {
  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lng: (bounds.minLng + bounds.maxLng) / 2,
  };
}

function getPreviewBounds(places: PlaceRecord[]) {
  if (places.length === 0) {
    return {
      minLat: DEFAULT_MAP_CENTER.lat,
      maxLat: DEFAULT_MAP_CENTER.lat,
      minLng: DEFAULT_MAP_CENTER.lng,
      maxLng: DEFAULT_MAP_CENTER.lng,
    };
  }

  const latitudes = places.map((place) => place.latitude);
  const longitudes = places.map((place) => place.longitude);

  return {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLng: Math.min(...longitudes),
    maxLng: Math.max(...longitudes),
  };
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
  place: PlaceRecord,
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

function createMarkerIconHtml(count: number, isActive: boolean) {
  const background = isActive ? "#d97f4d" : "#ffffff";
  const textColor = isActive ? "#ffffff" : "#7c4a2f";
  const borderColor = isActive ? "#d97f4d" : "#edd3bf";
  const shadowColor = isActive
    ? "rgba(169, 95, 53, 0.34)"
    : "rgba(104, 71, 53, 0.16)";
  const badgeBackground = isActive ? "rgba(255,255,255,0.18)" : "#fff2e8";

  return `
    <div style="display:inline-flex;align-items:center;gap:6px;min-width:50px;height:34px;padding:0 11px;border-radius:9999px;background:${background};color:${textColor};border:1px solid ${borderColor};box-shadow:0 10px 22px ${shadowColor};font-size:12px;font-weight:700;line-height:1;transform:translate(-50%,-50%);">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:9999px;background:${badgeBackground};font-size:11px;">👍</span>
        <span>${formatLikeCount(count)}</span>
    </div>
  `;
}

function createMapMarkerIcon(
  count: number,
  isActive: boolean,
  naver: ReturnType<typeof getLoadedNaverMapSdk>,
) {
  const Point = naver?.maps.Point;
  const Size = naver?.maps.Size;

  if (!Point || !Size) {
    return undefined;
  }

  return {
    content: createMarkerIconHtml(count, isActive),
    size: new Size(68, 34),
    anchor: new Point(34, 17),
  };
}

function PreviewMap({
  places,
  selectedCategoryLabel,
  activePlaceId,
  onSelectPlace,
}: {
  places: PlaceRecord[];
  selectedCategoryLabel: string | null;
  activePlaceId: string | null;
  onSelectPlace: (placeId: string) => void;
}) {
  const bounds = getPreviewBounds(places);
  const latRange = Math.max(bounds.maxLat - bounds.minLat, 0.01);
  const lngRange = Math.max(bounds.maxLng - bounds.minLng, 0.01);

  return (
    <div
      className="relative h-[36rem] bg-[linear-gradient(to_right,#e7e5e4_1px,transparent_1px),linear-gradient(to_bottom,#e7e5e4_1px,transparent_1px)] bg-[size:32px_32px] bg-stone-50 lg:h-[44rem]"
      data-testid="map-panel-preview"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.12),transparent_28%)]" />
      {places.map((place) => {
        const top = ((bounds.maxLat - place.latitude) / latRange) * 70 + 10;
        const left = ((place.longitude - bounds.minLng) / lngRange) * 72 + 8;
        const isActive = activePlaceId === place.id;

        return (
          <button
            key={place.id}
            type="button"
            data-testid={`map-preview-marker-${place.id}`}
            onClick={() => onSelectPlace(place.id)}
            className="absolute"
            style={{
              top: `${top}%`,
              left: `${left}%`,
            }}
          >
            <span
              className={`flex min-w-[3.35rem] items-center justify-center gap-1 rounded-full px-3 py-2 text-xs font-semibold shadow-lg transition ${
                isActive
                  ? "bg-[#dc8b5e] text-white"
                  : "border border-[#edd3bf] bg-white text-[#7c4a2f]"
              }`}
            >
              <span className={`text-[11px] ${isActive ? "" : "opacity-90"}`}>
                👍
              </span>
              <span>{formatLikeCount(place.likeCount)}</span>
            </span>
          </button>
        );
      })}
      <div className="absolute bottom-4 left-4 rounded-2xl bg-white/90 px-4 py-3 text-sm text-stone-700 shadow-sm backdrop-blur">
        {selectedCategoryLabel
          ? `${selectedCategoryLabel} 카테고리만 표시 중`
          : "전체 카테고리 표시 중"}
      </div>
    </div>
  );
}

function NaverMapFallback({
  places,
  selectedCategoryLabel,
  activePlaceId,
  onSelectPlace,
}: {
  places: PlaceRecord[];
  selectedCategoryLabel: string | null;
  activePlaceId: string | null;
  onSelectPlace: (placeId: string) => void;
}) {
  return (
    <section
      className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm"
      data-testid="map-panel-shell"
    >
      <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-stone-900">주변 지도</h2>
        <div className="whitespace-nowrap rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-600">
          {places.length}곳
        </div>
      </div>

      <div className="relative h-[36rem] lg:h-[44rem]">
        <PreviewMap
          places={places}
          selectedCategoryLabel={selectedCategoryLabel}
          activePlaceId={activePlaceId}
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
          places={this.props.places}
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
  places,
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
    places[0]?.id ?? null,
  );
  const naverMapKeyId = getNaverMapKeyId();
  const activePlaceId =
    controlledActivePlaceId === undefined
      ? internalActivePlaceId
      : controlledActivePlaceId;
  const activePlace = useMemo(
    () => places.find((place) => place.id === activePlaceId) ?? null,
    [activePlaceId, places],
  );
  const showPreview = status !== "ready" || !hasVisibleMap;

  const selectPlace = useCallback(
    (placeId: string) => {
      if (controlledActivePlaceId === undefined) {
        setInternalActivePlaceId(placeId);
      }

      onSelectPlace?.(placeId);
    },
    [controlledActivePlaceId, onSelectPlace],
  );
  const emitPlaceSelect = useCallback(
    (placeId: string) => {
      selectPlace(placeId);
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
            : getMapCenter(places);
          const centerLatLng = new maps.LatLng(center.lat, center.lng);
          const nextZoom = getMapZoom(places.length);
          const map = new maps.Map(mapContainerRef.current, {
            center: centerLatLng,
            zoom: nextZoom,
            mapDataControl: false,
            scaleControl: false,
            logoControl: false,
          });

          mapInstanceRef.current = map;

          if (initialBounds && places.length > 1) {
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
    naverMapKeyId,
    places,
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
  }, [containerSize.height, containerSize.width, places, status]);

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
      markerInstancesRef.current = places.map((place) => {
        const isActive = activePlaceId === place.id;
        const marker = new maps.Marker({
          map: mapInstanceRef.current,
          position: new maps.LatLng(place.latitude, place.longitude),
          title: place.name,
          icon: createMapMarkerIcon(place.likeCount, isActive, { maps }),
        });

        maps.Event.addListener(marker, "click", () => {
          emitPlaceSelect(place.id);
        });

        return marker;
      });
    } catch (error) {
      failMap("Failed to render NAVER map markers.", error);
    }
  }, [activePlaceId, emitPlaceSelect, failMap, places, status]);

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
      places.length === 0
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
      const focusCenter = getMapCenter(places);
      const point = new LatLng(focusCenter.lat, focusCenter.lng);

      lastFocusPlacesKeyRef.current = focusPlacesKey;
      mapInstanceRef.current.setCenter?.(point);
      mapInstanceRef.current.setZoom?.(getMapZoom(places.length));
      mapInstanceRef.current.panTo?.(point);
      window.setTimeout(() => {
        emitViewportChange();
      }, 100);
    } catch (error) {
      failMap("Failed to focus the NAVER map viewport.", error);
    }
  }, [emitViewportChange, failMap, focusPlacesKey, places, status]);

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
      className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm"
      data-testid="map-panel-shell"
    >
      <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-stone-900">주변 지도</h2>
        <div className="whitespace-nowrap rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-600">
          {places.length}곳
        </div>
      </div>

      <div className="relative h-[36rem] lg:h-[44rem]">
        <div
          ref={mapContainerRef}
          data-testid="map-panel"
          className="altteulmap-naver-map h-full w-full overflow-hidden bg-stone-100"
        />

        {showPreview ? (
          <div className="absolute inset-0">
            <PreviewMap
              places={places}
              selectedCategoryLabel={selectedCategoryLabel}
              activePlaceId={activePlaceId}
              onSelectPlace={selectPlace}
            />
          </div>
        ) : null}

        <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={locateCurrentPosition}
            disabled={status !== "ready" || isLocating}
            className="whitespace-nowrap rounded-full border border-stone-300 bg-white/95 px-4 py-2 text-sm font-medium text-stone-800 shadow-sm backdrop-blur transition hover:bg-white disabled:cursor-not-allowed disabled:text-stone-400"
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
