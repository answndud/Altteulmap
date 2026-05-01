import type { PlacePreviewRecord } from "@/features/places/types";

export const PLACE_SHARE_SOURCES = [
  "detail",
  "detail_sheet",
  "list",
  "trending",
] as const;

export type PlaceShareSource = (typeof PLACE_SHARE_SOURCES)[number];

type PlaceShareSummary = Pick<
  PlacePreviewRecord,
  | "id"
  | "name"
  | "district"
  | "address"
  | "representativePriceAmount"
  | "representativePriceLabel"
>;

function formatKrw(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

export function createPlaceSharePath(
  placeId: string,
  source: PlaceShareSource,
) {
  const search = new URLSearchParams({
    ref: "share",
    source,
  });

  return `/place/${placeId}?${search.toString()}`;
}

export function createPlaceShareTitle(place: PlaceShareSummary) {
  return `${place.name} · ${place.district} · ${formatKrw(place.representativePriceAmount)}원`;
}

export function createPlaceShareText(place: PlaceShareSummary) {
  return `${place.representativePriceLabel} ${formatKrw(place.representativePriceAmount)}원 · ${place.address}`;
}

export function createPlaceSharePayload(
  place: PlaceShareSummary,
  source: PlaceShareSource,
) {
  return {
    path: createPlaceSharePath(place.id, source),
    title: createPlaceShareTitle(place),
    text: createPlaceShareText(place),
  };
}

export function createPlaceShareDescription(
  place: PlaceShareSummary,
  categoryName?: string | null,
) {
  return [
    createPlaceShareTitle(place),
    categoryName,
    createPlaceShareText(place),
  ]
    .filter((item): item is string => Boolean(item))
    .join(" · ");
}

export function isPlaceShareSource(value: string | null | undefined): value is PlaceShareSource {
  if (!value) {
    return false;
  }

  return PLACE_SHARE_SOURCES.includes(value as PlaceShareSource);
}

export function getPlaceShareSourceLabel(source: PlaceShareSource) {
  switch (source) {
    case "detail":
      return "상세 페이지";
    case "detail_sheet":
      return "상세 시트";
    case "list":
      return "지도 목록";
    case "trending":
      return "인기 장소";
  }
}
