"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  DEFAULT_MAP_CENTER,
  getNaverMapKeyId,
  getLoadedNaverMapSdk,
  loadNaverMapSdk,
  type MapPoint,
  type MapStatus,
  type NaverMapInstance,
  type NaverMarkerInstance,
} from "@/features/map/naver-map-sdk";

type AdminPlaceCoordinatePickerProps = {
  placeName: string;
  address: string;
  district: string;
  latitude: string;
  longitude: string;
  onChange: (next: { latitude: string; longitude: string }) => void;
  disabled?: boolean;
};

function formatCoordinate(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "";
  }

  return value.toFixed(6);
}

function parseCoordinatePair(
  latitude: string,
  longitude: string,
): MapPoint | null {
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);

  if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
    return null;
  }

  return {
    lat: parsedLatitude,
    lng: parsedLongitude,
  };
}

export function AdminPlaceCoordinatePicker({
  placeName,
  address,
  district,
  latitude,
  longitude,
  onChange,
  disabled = false,
}: AdminPlaceCoordinatePickerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<NaverMapInstance | null>(null);
  const markerRef = useRef<NaverMarkerInstance | null>(null);
  const naverMapKeyId = getNaverMapKeyId();
  const [status, setStatus] = useState<MapStatus>(
    naverMapKeyId ? "loading" : "missing-key",
  );
  const selectedPoint = useMemo(
    () => parseCoordinatePair(latitude, longitude),
    [latitude, longitude],
  );

  useEffect(() => {
    if (!naverMapKeyId || !mapContainerRef.current) {
      return;
    }

    let cancelled = false;

    loadNaverMapSdk(naverMapKeyId)
      .then((naver) => {
        if (cancelled || !mapContainerRef.current) {
          return;
        }

        const center = selectedPoint ?? DEFAULT_MAP_CENTER;
        const centerLatLng = new naver.maps.LatLng(center.lat, center.lng);

        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new naver.maps.Map(mapContainerRef.current, {
            center: centerLatLng,
            zoom: selectedPoint ? 16 : 13,
            mapDataControl: false,
            scaleControl: false,
            logoControl: false,
          });

          naver.maps.Event.addListener(
            mapInstanceRef.current,
            "click",
            (event?: { coord?: { y?: number; x?: number } }) => {
              if (disabled) {
                return;
              }

              const nextLatitude = event?.coord?.y;
              const nextLongitude = event?.coord?.x;

              if (
                typeof nextLatitude !== "number" ||
                typeof nextLongitude !== "number"
              ) {
                return;
              }

              onChange({
                latitude: formatCoordinate(nextLatitude),
                longitude: formatCoordinate(nextLongitude),
              });
            },
          );
        } else {
          mapInstanceRef.current.setCenter?.(centerLatLng);
          mapInstanceRef.current.setZoom?.(selectedPoint ? 16 : 13);
        }

        setStatus("ready");
      })
      .catch((error) => {
        console.error("Failed to initialize NAVER Maps for admin picker.", error);

        if (!cancelled) {
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [disabled, naverMapKeyId, onChange, selectedPoint]);

  useEffect(() => {
    if (status !== "ready" || !mapInstanceRef.current) {
      return;
    }

    const naver = getLoadedNaverMapSdk();
    const LatLng = naver?.maps.LatLng;

    if (!LatLng) {
      return;
    }

    if (!selectedPoint) {
      markerRef.current?.setMap?.(null);
      markerRef.current = null;
      mapInstanceRef.current.setCenter?.(
        new LatLng(DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng),
      );
      mapInstanceRef.current.setZoom?.(13);
      return;
    }

    markerRef.current?.setMap?.(null);
    markerRef.current = new naver.maps.Marker({
      map: mapInstanceRef.current,
      position: new LatLng(selectedPoint.lat, selectedPoint.lng),
      title: placeName,
    });

    mapInstanceRef.current.panTo?.(new LatLng(selectedPoint.lat, selectedPoint.lng));
    mapInstanceRef.current.setZoom?.(16);
  }, [placeName, selectedPoint, status]);

  useEffect(() => {
    if (status !== "ready" || !mapInstanceRef.current) {
      return;
    }

    const handleResize = () => {
      mapInstanceRef.current?.autoResize?.();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [status]);

  useEffect(() => {
    return () => {
      markerRef.current?.setMap?.(null);
      markerRef.current = null;
      mapInstanceRef.current?.destroy?.();
      mapInstanceRef.current = null;
    };
  }, []);

  const statusMessage =
    status === "missing-key"
      ? "지도 연결이 아직 준비되지 않아 숫자 입력으로만 좌표를 지정할 수 있습니다."
      : status === "error"
        ? "지도를 불러오지 못했습니다. 숫자 입력으로 좌표를 지정해주세요."
        : status === "loading"
          ? "지도를 불러오는 중입니다."
          : "지도를 클릭하면 위도와 경도가 자동 입력됩니다.";

  return (
    <section className="space-y-4 rounded-3xl border border-stone-200 bg-stone-50 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
          Coordinate picker
        </p>
        <h3 className="mt-2 text-lg font-semibold text-stone-900">
          지도에서 승인 좌표 선택
        </h3>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          {placeName} · {district}
          <br />
          {address}
        </p>
      </div>

      <div className="rounded-3xl border border-stone-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-stone-700">
            {status === "ready" ? "네이버 지도" : "프리뷰 안내"}
          </p>
          {selectedPoint ? (
            <button
              type="button"
              onClick={() =>
                onChange({
                  latitude: "",
                  longitude: "",
                })
              }
              disabled={disabled}
              className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              좌표 비우기
            </button>
          ) : null}
        </div>
        <div className="mt-3 overflow-hidden rounded-[1.5rem] border border-stone-200 bg-stone-100">
          <div
            ref={mapContainerRef}
            className={`h-64 w-full ${
              status === "ready"
                ? "bg-stone-100"
                : "bg-[linear-gradient(to_right,#e7e5e4_1px,transparent_1px),linear-gradient(to_bottom,#e7e5e4_1px,transparent_1px)] bg-[size:28px_28px]"
            }`}
          />
        </div>
        <p className="mt-3 text-sm leading-6 text-stone-600">{statusMessage}</p>
      </div>

      <div className="grid gap-3 rounded-3xl border border-stone-200 bg-white p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
            현재 위도
          </p>
          <p className="mt-2 text-sm font-medium text-stone-900">
            {latitude || "미선택"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
            현재 경도
          </p>
          <p className="mt-2 text-sm font-medium text-stone-900">
            {longitude || "미선택"}
          </p>
        </div>
      </div>
    </section>
  );
}
