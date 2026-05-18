import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveMapMarkers,
  deriveTrendingPlaces,
  mergeSelectedPlaceIntoList,
} from "../../src/client/features/map/map-route-derived";
import type { PlacePreviewRecord } from "../../src/features/places/types";

function createPlace(
  id: string,
  overrides: Partial<PlacePreviewRecord> = {},
): PlacePreviewRecord {
  return {
    id,
    name: `장소 ${id}`,
    categorySlug: "korean",
    address: "서울시 중구",
    district: "서울 중구",
    latitude: 37.56,
    longitude: 126.97,
    representativePriceAmount: 5000,
    representativePriceLabel: "김밥",
    verificationStatus: "unverified",
    lastPriceUpdatedAt: "2026-01-01T00:00:00.000Z",
    description: "",
    note: "",
    likeCount: 0,
    dislikeCount: 0,
    viewerReaction: null,
    ...overrides,
  };
}

test("deriveMapMarkers prefers optimistic cluster places", () => {
  const markerPlace = createPlace("marker");
  const optimisticPlace = createPlace("optimistic");

  assert.deepEqual(deriveMapMarkers([{ ...markerPlace, kind: "place" }], null), [
    { ...markerPlace, kind: "place" },
  ]);
  assert.deepEqual(
    deriveMapMarkers([{ ...markerPlace, kind: "place" }], [optimisticPlace]),
    [{ ...optimisticPlace, kind: "place" }],
  );
});

test("mergeSelectedPlaceIntoList replaces only the selected row", () => {
  const places = [createPlace("a"), createPlace("b", { likeCount: 1 })];
  const selectedPlace = createPlace("b", { likeCount: 3 });

  assert.deepEqual(mergeSelectedPlaceIntoList(places, selectedPlace), [
    places[0],
    selectedPlace,
  ]);
  assert.equal(mergeSelectedPlaceIntoList(places, null), places);
});

test("deriveTrendingPlaces sorts by likes then recent update and hides during query", () => {
  const olderPopular = createPlace("older-popular", {
    likeCount: 5,
    lastPriceUpdatedAt: "2026-01-01T00:00:00.000Z",
  });
  const newerPopular = createPlace("newer-popular", {
    likeCount: 5,
    lastPriceUpdatedAt: "2026-02-01T00:00:00.000Z",
  });
  const lessPopular = createPlace("less-popular", {
    likeCount: 1,
    lastPriceUpdatedAt: "2026-03-01T00:00:00.000Z",
  });

  assert.deepEqual(
    deriveTrendingPlaces([lessPopular, olderPopular, newerPopular], "").map(
      (place) => place.id,
    ),
    ["newer-popular", "older-popular", "less-popular"],
  );
  assert.deepEqual(
    deriveTrendingPlaces([lessPopular, olderPopular, newerPopular], "김밥"),
    [],
  );
});
