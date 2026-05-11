import type { PlacePreviewRecord } from "@/features/places/types";

export type PlaceShareSource = "detail" | "detail_sheet" | "list" | "trending";

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

function createPlaceSharePath(
  placeId: string,
  source: PlaceShareSource,
) {
  const search = new URLSearchParams({
    ref: "share",
    source,
  });

  return `/place/${placeId}?${search.toString()}`;
}

function createPlaceShareTitle(place: PlaceShareSummary) {
  return `${place.name} · ${place.district} · ${formatKrw(place.representativePriceAmount)}원`;
}

function createPlaceShareText(place: PlaceShareSummary) {
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
