"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import type { PlaceRecord } from "@/features/places/types";

type NaverMapPanelProps = {
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
    <div className="relative h-[36rem] bg-[linear-gradient(to_right,#e7e5e4_1px,transparent_1px),linear-gradient(to_bottom,#e7e5e4_1px,transparent_1px)] bg-[size:32px_32px] bg-stone-50 lg:h-[44rem]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.12),transparent_28%)]" />
      {places.map((place, index) => {
        const top = ((bounds.maxLat - place.latitude) / latRange) * 70 + 10;
        const left = ((place.longitude - bounds.minLng) / lngRange) * 72 + 8;
        const isActive = activePlaceId === place.id;

        return (
          <button
            key={place.id}
            type="button"
            onClick={() => onSelectPlace(place.id)}
            className="absolute"
            style={{
              top: `${top}%`,
              left: `${left}%`,
            }}
          >
            <span
              className={`flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-xs font-semibold shadow-lg transition ${
                isActive
                  ? "bg-orange-600 text-white"
                  : "bg-stone-900 text-white"
              }`}
            >
              {index + 1}
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

export function NaverMapPanel({
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
        const LatLng = naver?.maps.LatLng;
        const Marker = naver?.maps.Marker;

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

        const center = getMapCenter(places);
        const centerLatLng = new naver.maps.LatLng(center.lat, center.lng);
        const nextZoom = getMapZoom(places.length);
        const map = new naver.maps.Map(mapContainerRef.current, {
          center: centerLatLng,
          zoom: nextZoom,
          mapDataControl: false,
          scaleControl: false,
          logoControl: false,
        });

        mapInstanceRef.current = map;

        const syncViewport = () => {
          map.autoResize?.();
          emitViewportChange();
        };

        naver.maps.Event.addListener(map, "idle", () => {
          emitViewportChange();
        });

        setHasVisibleMap(false);
        window.requestAnimationFrame(syncViewport);
        window.setTimeout(syncViewport, 0);
        resizeTimeoutId = window.setTimeout(syncViewport, 180);
        setStatus("ready");
      })
      .catch((error) => {
        console.error("Failed to initialize NAVER Maps.", error);

        if (!cancelled) {
          setHasVisibleMap(false);
          setStatus("error");
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

    const naver = getLoadedNaverMapSdk();

    if (!naver?.maps) {
      return;
    }

    markerInstancesRef.current.forEach((marker) => marker.setMap?.(null));
    markerInstancesRef.current = places.map((place) => {
      const marker = new naver.maps.Marker({
        map: mapInstanceRef.current,
        position: new naver.maps.LatLng(place.latitude, place.longitude),
        title: place.name,
      });

      naver.maps.Event.addListener(marker, "click", () => {
        emitPlaceSelect(place.id);
        mapInstanceRef.current?.panTo?.(
          new naver.maps.LatLng(place.latitude, place.longitude),
        );
      });

      return marker;
    });
  }, [emitPlaceSelect, places, status]);

  useEffect(() => {
    if (status !== "ready" || !activePlace || !mapInstanceRef.current) {
      return;
    }

    const LatLng = getLoadedNaverMapSdk()?.maps.LatLng;

    if (!LatLng) {
      return;
    }

    mapInstanceRef.current.panTo?.(
      new LatLng(activePlace.latitude, activePlace.longitude),
    );
  }, [activePlace, status]);

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

    const LatLng = getLoadedNaverMapSdk()?.maps.LatLng;

    if (!LatLng) {
      return;
    }

    const focusCenter = getMapCenter(places);
    const point = new LatLng(focusCenter.lat, focusCenter.lng);

    lastFocusPlacesKeyRef.current = focusPlacesKey;
    mapInstanceRef.current.setCenter?.(point);
    mapInstanceRef.current.setZoom?.(getMapZoom(places.length));
    mapInstanceRef.current.panTo?.(point);
    window.setTimeout(() => {
      emitViewportChange();
    }, 100);
  }, [emitViewportChange, focusPlacesKey, places, status]);

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
      markerInstancesRef.current.forEach((marker) => marker.setMap?.(null));
      markerInstancesRef.current = [];
      currentLocationMarkerRef.current?.setMap?.(null);
      currentLocationMarkerRef.current = null;
      mapInstanceRef.current?.destroy?.();
      mapInstanceRef.current = null;
    };
  }, []);

  const statusLabel =
    status === "ready"
      ? "네이버 지도"
      : status === "loading"
        ? "지도 로딩 중"
        : "프리뷰 모드";
  const statusMessage =
    status === "missing-key"
      ? "NEXT_PUBLIC_NAVER_MAP_KEY_ID가 없어 임시 프리뷰로 표시합니다."
      : status === "error"
        ? "네이버 지도 SDK를 불러오지 못해 임시 프리뷰로 표시합니다."
        : showPreview
          ? "네이버 지도 SDK를 불러오는 중입니다."
          : null;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">지도 탐색</h2>
          <p className="text-sm text-stone-500">{statusLabel}</p>
        </div>
        <div className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-600">
          {places.length}곳
        </div>
      </div>

      <div className="relative h-[36rem] lg:h-[44rem]">
        <div
          ref={mapContainerRef}
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
            className="rounded-full border border-stone-300 bg-white/95 px-4 py-2 text-sm font-medium text-stone-800 shadow-sm backdrop-blur transition hover:bg-white disabled:cursor-not-allowed disabled:text-stone-400"
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
