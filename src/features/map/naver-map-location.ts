import type { MutableRefObject } from "react";

import {
  getLoadedNaverMapSdk,
  type NaverMapInstance,
  type NaverMarkerInstance,
} from "@/features/map/naver-map-sdk";

type LocateCurrentPositionOptions = {
  currentLocationMarkerRef: MutableRefObject<NaverMarkerInstance | null>;
  emitViewportChange: () => unknown;
  mapInstanceRef: MutableRefObject<NaverMapInstance | null>;
  setIsLocating: (isLocating: boolean) => void;
  setLocationMessage: (message: string | null) => void;
};

export function locateCurrentPositionOnNaverMap({
  currentLocationMarkerRef,
  emitViewportChange,
  mapInstanceRef,
  setIsLocating,
  setLocationMessage,
}: LocateCurrentPositionOptions) {
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
}
