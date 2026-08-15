import assert from "node:assert/strict";
import test from "node:test";

import { buildMapApiPath } from "../../src/client/features/map/map-query";
import { buildMapPreviewCacheKey } from "../../src/features/places/map-preview-cache";
import {
  getMapMarkerMode,
  getPlaceOnlyMapMarkers,
} from "../../src/worker/places-read-markers";
import type { PlacePreviewRecord } from "../../src/features/places/types";

const bounds = {
  minLat: 37.5,
  maxLat: 37.6,
  minLng: 126.9,
  maxLng: 127.1,
};

function createPlace(id: string): PlacePreviewRecord {
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
    verificationStatus: "verified",
    lastPriceUpdatedAt: "2026-01-01",
    description: "",
    note: "",
    likeCount: 0,
    dislikeCount: 0,
    viewerReaction: null,
  };
}

test("map preview cache keys separate zoom levels with different cluster geometry", () => {
  const keyAtZoom10 = buildMapPreviewCacheKey({
    bounds,
    markerLimit: 24,
    normalizedQuery: null,
    zoom: 10,
  });
  const keyAtZoom11 = buildMapPreviewCacheKey({
    bounds,
    markerLimit: 24,
    normalizedQuery: null,
    zoom: 11,
  });

  assert.notEqual(keyAtZoom10, keyAtZoom11);
});

test("global searches cluster large result sets instead of silently dropping map markers", () => {
  assert.equal(getMapMarkerMode(40, null, "김밥"), "place");
  assert.equal(getMapMarkerMode(41, null, "김밥"), "cluster");

  const places = Array.from({ length: 40 }, (_, index) =>
    createPlace(String(index)),
  );
  assert.equal(getPlaceOnlyMapMarkers(places, null, "김밥").length, 40);
});

test("map refresh can bypass edge and repository cache and cluster focus can narrow global search", () => {
  const searchParams = new URLSearchParams({
    q: "김밥",
    scope: "global",
  });
  const viewport = {
    center: { lat: 37.56, lng: 126.97 },
    bounds,
    zoom: 15,
  };
  const refreshPath = buildMapApiPath(searchParams, viewport, {
    forceRefresh: true,
  });
  const focusedPath = buildMapApiPath(searchParams, viewport, {
    forceViewportScope: true,
  });

  assert.equal(new URL(`https://example.test${refreshPath}`).searchParams.get("scope"), "global");
  assert.ok(new URL(`https://example.test${refreshPath}`).searchParams.has("refresh"));
  assert.equal(new URL(`https://example.test${focusedPath}`).searchParams.get("scope"), "viewport");
  assert.deepEqual(
    {
      minLat: new URL(`https://example.test${focusedPath}`).searchParams.get("minLat"),
      maxLat: new URL(`https://example.test${focusedPath}`).searchParams.get("maxLat"),
    },
    { minLat: "37.5", maxLat: "37.6" },
  );
});
