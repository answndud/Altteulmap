"use client";

import { startTransition, useEffect, useState } from "react";

import { BookmarkToggleButton } from "@/features/bookmarks/bookmark-toggle-button";
import { getCategoryBySlug } from "@/features/categories/catalog";
import { NaverMapPanel } from "@/features/map/naver-map-panel";
import type { MapViewport } from "@/features/map/naver-map-sdk";
import { PlaceDetailSheet } from "@/features/places/place-detail-sheet";
import type { PlaceReactionUpdate } from "@/features/places/place-reaction-buttons";
import { formatKrw } from "@/features/places/queries";
import type {
  PlaceBounds,
  PlaceRecord,
  PlaceSearchScope,
  PlaceSort,
} from "@/features/places/types";

type MapExplorerProps = {
  authenticated: boolean;
  bookmarkedPlaceIds: string[];
  bookmarkLoginHref: string;
  category: string | null;
  currentMapHref: string;
  initialBounds: PlaceBounds;
  maxPrice: number | null;
  places: PlaceRecord[];
  query: string | null;
  searchScope: PlaceSearchScope;
  selectedCategoryLabel: string | null;
  sort: PlaceSort;
};

type MapPlacesResponse = {
  bounds: PlaceBounds;
  count: number;
  filters: {
    bounds: PlaceBounds | null;
    category: string | null;
    maxPrice: number | null;
    query: string | null;
    searchScope: PlaceSearchScope;
    sort: PlaceSort;
  };
  items: PlaceRecord[];
};

type PlaceListProps = {
  bookmarkedPlaceIds: string[];
  bookmarkLoginHref: string;
  itemTestIdPrefix?: string;
  likeCountTestIdPrefix?: string;
  listTestId?: string;
  places: PlaceRecord[];
  query: string | null;
  searchScope: PlaceSearchScope;
  selectedPlaceId: string | null;
  onSelectPlace: (placeId: string) => void;
};

function isActivationKey(key: string) {
  return key === "Enter" || key === " ";
}

function getListDescription(params: {
  query: string | null;
  searchScope: PlaceSearchScope;
  viewport: MapViewport | null;
}) {
  if (params.query) {
    return params.searchScope === "global"
      ? `전체 검색 결과 · ${params.query}`
      : `지도 안에서 · ${params.query}`;
  }

  return params.viewport ? "현재 보이는 영역" : "기본 결과";
}

function PlaceList({
  bookmarkedPlaceIds,
  bookmarkLoginHref,
  itemTestIdPrefix = "place-list-item",
  likeCountTestIdPrefix = "place-list-like-count",
  listTestId = "place-list",
  places,
  query,
  searchScope,
  selectedPlaceId,
  onSelectPlace,
}: PlaceListProps) {
  if (places.length === 0) {
    return (
      <div className="rounded-[1.35rem] border border-dashed border-stone-300 bg-white p-6 text-center text-sm leading-7 text-stone-500">
        <p className="font-medium text-stone-900">
          {query
            ? `"${query}" 검색 결과가 없습니다.`
            : "현재 조건에 맞는 데이터가 없습니다."}
        </p>
        <p className="mt-2">
          {query
            ? searchScope === "global"
              ? "전체 검색에서도 결과를 찾지 못했습니다. 다른 키워드로 다시 찾아보세요."
              : "현재 지도 영역에서는 결과가 없습니다. 전체 검색으로 바꾸거나 지도를 이동해보세요."
            : "지도를 이동하거나 필터를 완화해서 다시 확인해보세요."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid={listTestId}>
      {places.map((place) => {
        const category = getCategoryBySlug(place.categorySlug);
        const isActive = selectedPlaceId === place.id;

        return (
          <article
            key={place.id}
            role="button"
            tabIndex={0}
            data-testid={`${itemTestIdPrefix}-${place.id}`}
            onClick={() => onSelectPlace(place.id)}
            onKeyDown={(event) => {
              if (isActivationKey(event.key)) {
                event.preventDefault();
                onSelectPlace(place.id);
              }
            }}
            className={`rounded-[1.35rem] border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
              isActive
                ? "border-[#e4c2a8] bg-[#fff7ef] shadow-sm"
                : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
                  {category?.parentName ?? "기타"}
                </p>
                <h3 className="mt-1 truncate text-base font-semibold text-stone-900">
                  {place.name}
                </h3>
                <p className="mt-1 truncate text-xs text-stone-500">
                  {category?.name ?? "기타"}
                </p>
                <p className="mt-1 truncate text-xs text-stone-400">
                  {place.district}
                </p>
              </div>
              <div className="shrink-0">
                <BookmarkToggleButton
                  placeId={place.id}
                  initialBookmarked={bookmarkedPlaceIds.includes(place.id)}
                  loginHref={bookmarkLoginHref}
                  compact
                />
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-stone-500">
                  {place.representativePriceLabel}
                </p>
                <p className="mt-1 text-lg font-semibold text-stone-900">
                  {formatKrw(place.representativePriceAmount)}원
                </p>
              </div>
              <div className="text-right">
                <p
                  className="text-xs font-medium text-[#a06a48]"
                  data-testid={`${likeCountTestIdPrefix}-${place.id}`}
                >
                  👍 {place.likeCount}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  갱신 {place.lastPriceUpdatedAt}
                </p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function buildMapQuery(params: {
  bounds: PlaceBounds | null;
  category: string | null;
  maxPrice: number | null;
  query: string | null;
  searchScope: PlaceSearchScope;
  sort: PlaceSort;
}) {
  const search = new URLSearchParams();

  if (params.bounds) {
    search.set("minLat", String(params.bounds.minLat));
    search.set("maxLat", String(params.bounds.maxLat));
    search.set("minLng", String(params.bounds.minLng));
    search.set("maxLng", String(params.bounds.maxLng));
  }

  if (params.category) {
    search.set("category", params.category);
  }

  if (params.query) {
    search.set("query", params.query);
    search.set("scope", params.searchScope);
  }

  if (params.maxPrice) {
    search.set("maxPrice", String(params.maxPrice));
  }

  if (params.sort !== "price") {
    search.set("sort", params.sort);
  }

  return search.toString();
}

function serializeBounds(bounds: PlaceBounds | null) {
  if (!bounds) {
    return "global";
  }

  return [
    bounds.minLat.toFixed(4),
    bounds.maxLat.toFixed(4),
    bounds.minLng.toFixed(4),
    bounds.maxLng.toFixed(4),
  ].join(":");
}

export function MapExplorer({
  authenticated,
  bookmarkedPlaceIds,
  bookmarkLoginHref,
  category,
  currentMapHref,
  initialBounds,
  maxPrice,
  places,
  query,
  searchScope,
  selectedCategoryLabel,
  sort,
}: MapExplorerProps) {
  const [visiblePlaces, setVisiblePlaces] = useState(places);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [isFetchingPlaces, setIsFetchingPlaces] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isMobileListOpen, setIsMobileListOpen] = useState(false);
  const activeBounds = searchScope === "viewport" ? viewport?.bounds ?? null : null;
  const boundsKey = serializeBounds(activeBounds);
  const resolvedSelectedPlaceId = visiblePlaces.some(
    (place) => place.id === selectedPlaceId,
  )
    ? selectedPlaceId
    : null;
  const selectedPlace =
    visiblePlaces.find((place) => place.id === resolvedSelectedPlaceId) ?? null;
  const listDescription = getListDescription({
    query,
    searchScope,
    viewport,
  });

  useEffect(() => {
    setVisiblePlaces(places);
  }, [places]);

  useEffect(() => {
    if (searchScope === "viewport" && !activeBounds) {
      return;
    }

    const controller = new AbortController();
    const search = buildMapQuery({
      bounds: activeBounds,
      category,
      maxPrice,
      query,
      searchScope,
      sort,
    });

    fetch(`/api/places/map?${search}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("지도 영역의 장소를 불러오지 못했습니다.");
        }

        return (await response.json()) as MapPlacesResponse;
      })
      .then((result) => {
        startTransition(() => {
          setVisiblePlaces(result.items);
          setIsFetchingPlaces(false);
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setFetchError(
          error instanceof Error
            ? error.message
            : "지도 영역의 장소를 불러오지 못했습니다.",
        );
        setIsFetchingPlaces(false);
      });

    return () => {
      controller.abort();
    };
  }, [activeBounds, boundsKey, category, maxPrice, query, searchScope, sort]);

  const handlePlaceSelect = (placeId: string) => {
    setSelectedPlaceId(placeId);
    setIsMobileListOpen(false);
  };

  const handleViewportChange = (nextViewport: MapViewport) => {
    setViewport(nextViewport);

    if (searchScope === "viewport") {
      setIsFetchingPlaces(true);
      setFetchError(null);
    }
  };

  const handlePlaceReactionChange = (nextState: PlaceReactionUpdate) => {
    setVisiblePlaces((currentPlaces) =>
      currentPlaces.map((place) =>
        place.id === nextState.placeId
          ? {
              ...place,
              likeCount: nextState.likeCount,
              dislikeCount: nextState.dislikeCount,
              viewerReaction: nextState.viewerReaction,
            }
          : place,
      ),
    );
  };

  return (
    <div className="relative mt-8">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.95fr)_16.5rem]">
        <div className="relative">
          <NaverMapPanel
            initialBounds={initialBounds}
            places={visiblePlaces}
            selectedCategoryLabel={selectedCategoryLabel}
            activePlaceId={resolvedSelectedPlaceId}
            focusPlacesKey={
              query && searchScope === "global"
                ? `${query}:${category ?? "all"}:${maxPrice ?? "all"}:${sort}`
                : null
            }
            onSelectPlace={handlePlaceSelect}
            onViewportChange={handleViewportChange}
          />

          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center xl:hidden">
            <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-stone-200 bg-white/95 p-2 shadow-lg backdrop-blur">
              <button
                type="button"
                onClick={() => setIsMobileListOpen(true)}
                data-testid="mobile-place-list-open"
                className="altteulmap-accent-solid whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium"
              >
                목록 보기
              </button>
              <span className="whitespace-nowrap rounded-full bg-stone-100 px-3 py-2 text-xs text-stone-600">
                {visiblePlaces.length}곳
              </span>
            </div>
          </div>
        </div>

        <section className="hidden max-h-[44rem] flex-col overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm xl:flex">
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-4">
            <div>
              <h2 className="text-base font-semibold text-stone-900">장소 목록</h2>
              <p className="text-xs text-stone-500">{listDescription}</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="whitespace-nowrap rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">
                {visiblePlaces.length}곳
              </p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {fetchError ? (
              <div className="mb-3 rounded-[1.15rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {fetchError}
              </div>
            ) : null}
            {isFetchingPlaces ? (
              <div className="mb-3 rounded-[1.15rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-500">
                현재 지도 영역의 장소를 불러오는 중입니다.
              </div>
            ) : null}
            <PlaceList
              bookmarkedPlaceIds={bookmarkedPlaceIds}
              bookmarkLoginHref={bookmarkLoginHref}
              places={visiblePlaces}
              query={query}
              searchScope={searchScope}
              selectedPlaceId={resolvedSelectedPlaceId}
              onSelectPlace={handlePlaceSelect}
            />
          </div>
        </section>
      </div>

      {isMobileListOpen ? (
        <div className="fixed inset-0 z-40 xl:hidden">
          <button
            type="button"
            aria-label="목록 닫기"
            onClick={() => setIsMobileListOpen(false)}
            className="absolute inset-0 bg-stone-950/35"
          />
          <section
            role="dialog"
            aria-modal="true"
            data-testid="mobile-place-list-sheet"
            className="absolute inset-x-0 bottom-0 max-h-[72vh] overflow-hidden rounded-t-[2rem] border-t border-stone-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-4">
              <div>
                <h2 className="text-base font-semibold text-stone-900">장소 목록</h2>
                <p className="text-xs text-stone-500">{listDescription}</p>
              </div>
              <div className="flex items-center gap-2">
                <p className="whitespace-nowrap rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">
                  {visiblePlaces.length}곳
                </p>
                <button
                  type="button"
                  onClick={() => setIsMobileListOpen(false)}
                  data-testid="mobile-place-list-close"
                  className="whitespace-nowrap rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700"
                >
                  닫기
                </button>
              </div>
            </div>
            <div className="max-h-[calc(72vh-4.5rem)] overflow-y-auto p-3">
              {fetchError ? (
                <div className="mb-3 rounded-[1.15rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {fetchError}
                </div>
              ) : null}
              {isFetchingPlaces ? (
                <div className="mb-3 rounded-[1.15rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-500">
                  현재 지도 영역의 장소를 불러오는 중입니다.
                </div>
              ) : null}
              <PlaceList
                bookmarkedPlaceIds={bookmarkedPlaceIds}
                bookmarkLoginHref={bookmarkLoginHref}
                itemTestIdPrefix="mobile-place-list-item"
                likeCountTestIdPrefix="mobile-place-list-like-count"
                listTestId="mobile-place-list"
                places={visiblePlaces}
                query={query}
                searchScope={searchScope}
                selectedPlaceId={resolvedSelectedPlaceId}
                onSelectPlace={handlePlaceSelect}
              />
            </div>
          </section>
        </div>
      ) : null}

      <PlaceDetailSheet
        authenticated={authenticated}
        bookmarkedPlaceIds={bookmarkedPlaceIds}
        currentMapHref={currentMapHref}
        placeId={resolvedSelectedPlaceId}
        previewPlace={selectedPlace}
        onClose={() => setSelectedPlaceId(null)}
        onOpenPlace={handlePlaceSelect}
        onPlaceReactionChange={handlePlaceReactionChange}
      />
    </div>
  );
}
