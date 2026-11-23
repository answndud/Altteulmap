import { lazy, Suspense, useMemo } from "react";

import type { PlaceMapPlaceMarkerRecord, PlacePreviewRecord } from "@/features/places/types";

const NaverMapPanel = lazy(() =>
  import("@/features/map/naver-map-panel").then((module) => ({
    default: module.NaverMapPanel,
  })),
);

const BOUNDS_PADDING_DEGREES = 0.004;

/** 상세 화면의 위치 확인용 작은 지도. 지도 SDK가 없으면 목록 지도와 같은 미리보기로 대체된다. */
export function PlaceLocationMap({ place }: { place: PlacePreviewRecord }) {
  const markers = useMemo<PlaceMapPlaceMarkerRecord[]>(
    () => [{ ...place, kind: "place" }],
    [place],
  );
  const bounds = useMemo(
    () => ({
      minLat: place.latitude - BOUNDS_PADDING_DEGREES,
      maxLat: place.latitude + BOUNDS_PADDING_DEGREES,
      minLng: place.longitude - BOUNDS_PADDING_DEGREES,
      maxLng: place.longitude + BOUNDS_PADDING_DEGREES,
    }),
    [place.latitude, place.longitude],
  );

  return (
    <section
      className="altteulmap-detail-map"
      aria-label={`${place.name} 위치`}
      data-testid="place-location-map"
    >
      <Suspense
        fallback={
          <div className="flex h-56 items-center justify-center bg-[var(--altteul-bg-subtle)] text-sm text-[var(--altteul-text-tertiary)]">
            지도를 준비하는 중입니다.
          </div>
        }
      >
        <NaverMapPanel
          compact
          mapMarkers={markers}
          initialBounds={bounds}
          activePlaceId={place.id}
          selectedCategoryLabel={null}
        />
      </Suspense>
    </section>
  );
}
