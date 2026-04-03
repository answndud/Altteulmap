"use client";

import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { BookmarkToggleButton } from "@/features/bookmarks/bookmark-toggle-button";
import { getCategoryBySlug } from "@/features/categories/catalog";
import { NaverMapPanel } from "@/features/map/naver-map-panel";
import type { MapViewport } from "@/features/map/naver-map-sdk";
import { PlaceDetailSheet } from "@/features/places/place-detail-sheet";
import type { PlaceReactionUpdate } from "@/features/places/place-reaction-buttons";
import { formatKrw } from "@/features/places/queries";
import type {
  PlaceBounds,
  PlaceMapMarkerRecord,
  PlacePreviewRecord,
  PlaceSearchScope,
} from "@/features/places/types";

const PLACE_LIST_RENDER_LIMIT = 120;
const MOBILE_CLUSTER_OVERVIEW_MAX_ZOOM = 10.75;

type MapExplorerProps = {
  bookmarkedPlaceIds: string[];
  bookmarkLoginHref: string;
  category: string | null;
  currentMapHref: string;
  initialBounds: PlaceBounds;
  initialCount: number;
  mapMarkers: PlaceMapMarkerRecord[];
  prefetchedOnServer: boolean;
  places: PlacePreviewRecord[];
  query: string | null;
  searchScope: PlaceSearchScope;
  selectedCategoryLabel: string | null;
};

type MapPlacesResponse = {
  bounds: PlaceBounds;
  count: number;
  filters: {
    bounds: PlaceBounds | null;
    category: string | null;
    query: string | null;
    searchScope: PlaceSearchScope;
  };
  items: PlacePreviewRecord[];
  mapMarkers: PlaceMapMarkerRecord[];
  mapMarkerCount: number;
  returnedCount: number;
  truncated: boolean;
};

type PlaceListProps = {
  bookmarkedPlaceIds: string[];
  bookmarkLoginHref: string;
  isLoading?: boolean;
  itemTestIdPrefix?: string;
  likeCountTestIdPrefix?: string;
  listTestId?: string;
  places: PlacePreviewRecord[];
  query: string | null;
  searchScope: PlaceSearchScope;
  compact?: boolean;
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
  isLoading = false,
  itemTestIdPrefix = "place-list-item",
  likeCountTestIdPrefix = "place-list-like-count",
  listTestId = "place-list",
  places,
  compact = false,
  query,
  searchScope,
  selectedPlaceId,
  onSelectPlace,
}: PlaceListProps) {
  if (isLoading && places.length === 0) {
    return (
      <div className="rounded-[1.35rem] border border-dashed border-stone-300 bg-white p-6 text-center text-sm leading-7 text-stone-500">
        <p className="font-medium text-stone-900">
          현재 지도 영역의 장소를 불러오는 중입니다.
        </p>
        <p className="mt-2">
          첫 화면에서는 필요한 범위만 가져오고 있습니다. 잠시만 기다려 주세요.
        </p>
      </div>
    );
  }

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

  const listGapClassName = compact ? "space-y-2.5" : "space-y-3";

  return (
    <div className={listGapClassName} data-testid={listTestId}>
      {places.map((place) => {
        const category = getCategoryBySlug(place.categorySlug);
        const isActive = selectedPlaceId === place.id;
        const itemPaddingClassName = compact ? "p-2.5" : "p-4";
        const titleSizeClassName = compact ? "text-[0.95rem]" : "text-base";
        const headerGapClassName = compact ? "gap-2" : "gap-3";
        const footerGapClassName = compact ? "mt-2" : "mt-4";

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
            className={`rounded-[1.35rem] border text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
              itemPaddingClassName
            } ${
              isActive
                ? "border-[#e4c2a8] bg-[#fff7ef] shadow-sm"
                : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50"
            }`}
          >
            <div className={`flex items-start justify-between ${headerGapClassName}`}>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
                  {category?.parentName ?? "기타"}
                </p>
                <h3 className={`mt-1 truncate font-semibold text-stone-900 ${titleSizeClassName}`}>
                  {place.name}
                </h3>
                {compact ? null : (
                  <>
                    <p className="mt-1 truncate text-xs text-stone-500">
                      {category?.name ?? "기타"}
                    </p>
                    <p className="mt-1 truncate text-xs text-stone-400">
                      {place.district}
                    </p>
                  </>
                )}
              </div>
              <div className="shrink-0">
                <BookmarkToggleButton
                  key={`${place.id}:${bookmarkedPlaceIds.includes(place.id) ? "on" : "off"}`}
                  placeId={place.id}
                  initialBookmarked={bookmarkedPlaceIds.includes(place.id)}
                  loginHref={bookmarkLoginHref}
                  compact
                />
              </div>
            </div>
            <div
              className={`${
                footerGapClassName
              } flex items-end justify-between gap-3`}
            >
              <div>
                <p className="text-xs text-stone-500">
                  {place.representativePriceLabel}
                </p>
                <p className={`mt-1 font-semibold text-stone-900 ${compact ? "text-base" : "text-lg"}`}>
                  {formatKrw(place.representativePriceAmount)}원
                </p>
              </div>
              <div className="text-right">
                <p
                  className={`font-medium text-[#a06a48] ${compact ? "text-[11px]" : "text-xs"}`}
                  data-testid={`${likeCountTestIdPrefix}-${place.id}`}
                >
                  👍 {place.likeCount}
                </p>
                {compact ? null : (
                  <p className="mt-1 text-xs text-stone-500">
                    갱신 {place.lastPriceUpdatedAt}
                  </p>
                )}
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
  query: string | null;
  searchScope: PlaceSearchScope;
  zoom?: number | null;
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

  if (params.zoom !== null && params.zoom !== undefined) {
    search.set("zoom", String(params.zoom));
  }

  return search.toString();
}

function roundBounds(bounds: PlaceBounds | null) {
  if (!bounds) {
    return null;
  }

  return {
    minLat: Number(bounds.minLat.toFixed(4)),
    maxLat: Number(bounds.maxLat.toFixed(4)),
    minLng: Number(bounds.minLng.toFixed(4)),
    maxLng: Number(bounds.maxLng.toFixed(4)),
  };
}

export function MapExplorer({
  bookmarkedPlaceIds,
  bookmarkLoginHref,
  category,
  currentMapHref,
  initialBounds,
  initialCount,
  mapMarkers,
  prefetchedOnServer,
  places,
  query,
  searchScope,
  selectedCategoryLabel,
}: MapExplorerProps) {
  const [visiblePlaces, setVisiblePlaces] = useState(places);
  const [visibleMapMarkers, setVisibleMapMarkers] = useState(mapMarkers);
  const [totalPlaceCount, setTotalPlaceCount] = useState(initialCount);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [selectedPlacePreview, setSelectedPlacePreview] =
    useState<PlacePreviewRecord | null>(null);
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [isFetchingPlaces, setIsFetchingPlaces] = useState(
    searchScope === "viewport" && !prefetchedOnServer,
  );
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isMobileListOpen, setIsMobileListOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const shouldSkipInitialFetchRef = useRef(prefetchedOnServer);
  const activeBounds =
    searchScope === "viewport"
      ? roundBounds(viewport?.bounds ?? initialBounds)
      : null;
  const hasViewportBounds = activeBounds !== null;
  const requestSearch = buildMapQuery({
    bounds: activeBounds,
    category,
    query,
    searchScope,
    zoom: searchScope === "viewport" ? viewport?.zoom ?? null : null,
  });
  const resolvedSelectedPlaceId = selectedPlaceId;
  const displayPlaces = visiblePlaces.slice(0, PLACE_LIST_RENDER_LIMIT);
  const isServerTrimmed = visiblePlaces.length < totalPlaceCount;
  const isListTrimmed = displayPlaces.length < visiblePlaces.length;
  const displayMapMarkers = useMemo(() => {
    const clusterMarkers = visibleMapMarkers.filter(
      (marker): marker is Extract<PlaceMapMarkerRecord, { kind: "cluster" }> =>
        marker.kind === "cluster",
    );
    const shouldPreferOverviewClusters =
      isMobileViewport &&
      searchScope === "viewport" &&
      !query &&
      resolvedSelectedPlaceId === null &&
      clusterMarkers.length > 0 &&
      (viewport?.zoom ?? Number.POSITIVE_INFINITY) <=
        MOBILE_CLUSTER_OVERVIEW_MAX_ZOOM;

    return shouldPreferOverviewClusters ? clusterMarkers : visibleMapMarkers;
  }, [
    isMobileViewport,
    query,
    resolvedSelectedPlaceId,
    searchScope,
    viewport?.zoom,
    visibleMapMarkers,
  ]);
  const selectedPlace =
    (selectedPlacePreview?.id === resolvedSelectedPlaceId
      ? selectedPlacePreview
      : null) ??
    visiblePlaces.find((place) => place.id === resolvedSelectedPlaceId) ??
    visibleMapMarkers.find(
      (marker): marker is Extract<PlaceMapMarkerRecord, { kind: "place" }> =>
        marker.kind === "place" && marker.id === resolvedSelectedPlaceId,
    ) ??
    null;
  const listDescription = getListDescription({
    query,
    searchScope,
    viewport,
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1279px)");
    const syncMobileViewport = () => {
      setIsMobileViewport(mediaQuery.matches);
    };

    syncMobileViewport();
    mediaQuery.addEventListener("change", syncMobileViewport);

    return () => {
      mediaQuery.removeEventListener("change", syncMobileViewport);
    };
  }, []);

  useEffect(() => {
    if (searchScope === "viewport" && !hasViewportBounds) {
      return;
    }

    if (shouldSkipInitialFetchRef.current) {
      shouldSkipInitialFetchRef.current = false;
      return;
    }

    const controller = new AbortController();
    const fetchTimeoutId = window.setTimeout(() => {
      setIsFetchingPlaces(true);
      setFetchError(null);

      fetch(`/api/places/map?${requestSearch}`, {
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
            setVisibleMapMarkers(result.mapMarkers);
            setTotalPlaceCount(result.count);
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
    }, 180);

    return () => {
      window.clearTimeout(fetchTimeoutId);
      controller.abort();
    };
  }, [hasViewportBounds, prefetchedOnServer, requestSearch, searchScope]);

  const handlePlaceSelect = (placeId: string) => {
    setSelectedPlaceId(placeId);
    setSelectedPlacePreview(
      visiblePlaces.find((place) => place.id === placeId) ?? null,
    );
    setIsMobileListOpen(false);
  };

  const handleMapPlaceSelect = (place: PlacePreviewRecord) => {
    setSelectedPlaceId(place.id);
    setSelectedPlacePreview(place);
    setIsMobileListOpen(false);
  };

  const handleViewportChange = (nextViewport: MapViewport) => {
    setViewport(nextViewport);
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
    setVisibleMapMarkers((currentMarkers) =>
      currentMarkers.map((marker) => {
        if (marker.kind !== "place" || marker.id !== nextState.placeId) {
          return marker;
        }

        return {
          ...marker,
          likeCount: nextState.likeCount,
          dislikeCount: nextState.dislikeCount,
          viewerReaction: nextState.viewerReaction,
        };
      }),
    );
    setSelectedPlacePreview((currentPlace) =>
      currentPlace && currentPlace.id === nextState.placeId
        ? {
            ...currentPlace,
            likeCount: nextState.likeCount,
            dislikeCount: nextState.dislikeCount,
            viewerReaction: nextState.viewerReaction,
          }
        : currentPlace,
    );
  };

  return (
    <div className="relative mt-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2.2fr)_15rem] 2xl:grid-cols-[minmax(0,2.35fr)_15.5rem]">
        <div className="relative">
          <NaverMapPanel
            initialBounds={initialBounds}
            isLoading={isFetchingPlaces && visiblePlaces.length === 0}
            mapMarkers={displayMapMarkers}
            placeCount={totalPlaceCount}
            selectedCategoryLabel={selectedCategoryLabel}
            activePlaceId={resolvedSelectedPlaceId}
            focusPlacesKey={
              query && searchScope === "global"
                ? `${query}:${category ?? "all"}`
                : null
            }
            onSelectPlace={handleMapPlaceSelect}
            onViewportChange={handleViewportChange}
          />

          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center xl:hidden">
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-stone-200 bg-white/95 p-2 shadow-lg backdrop-blur">
              <button
                type="button"
                onClick={() => setIsMobileListOpen(true)}
                data-testid="mobile-place-list-open"
                className="altteulmap-accent-solid altteulmap-button whitespace-nowrap px-4 py-2 text-sm font-medium"
              >
                목록 보기
              </button>
              <span className="altteulmap-badge whitespace-nowrap bg-stone-100 px-3 py-2 text-xs text-stone-600">
                {totalPlaceCount}곳
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
              <p className="altteulmap-badge whitespace-nowrap bg-stone-100 px-3 py-1 text-xs text-stone-600">
                {totalPlaceCount}곳
              </p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {fetchError ? (
              <div className="mb-3 rounded-[1.15rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {fetchError}
              </div>
            ) : null}
            {isServerTrimmed ? (
              <div className="mb-3 rounded-[1.15rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                현재 조건에 맞는 장소는 총 {totalPlaceCount}곳이고, 성능을 위해 {visiblePlaces.length}곳만 먼저 불러왔습니다. 지도를 더 확대하거나 검색 조건을 좁히면 더 자세히 볼 수 있습니다.
              </div>
            ) : null}
            {isFetchingPlaces ? (
              <div className="mb-3 rounded-[1.15rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-500">
                현재 지도 영역의 장소를 불러오는 중입니다.
              </div>
            ) : null}
            {isListTrimmed ? (
              <div className="mb-3 rounded-[1.15rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                목록은 현재 {displayPlaces.length}곳만 먼저 표시합니다. 지도를 더 확대하면 범위를 좁혀 볼 수 있습니다.
              </div>
            ) : null}
            <PlaceList
              bookmarkedPlaceIds={bookmarkedPlaceIds}
              bookmarkLoginHref={bookmarkLoginHref}
              isLoading={isFetchingPlaces}
              places={displayPlaces}
              query={query}
              searchScope={searchScope}
              selectedPlaceId={resolvedSelectedPlaceId}
              onSelectPlace={handlePlaceSelect}
            />
          </div>
        </section>
      </div>

      {isMobileListOpen ? (
        <div className="fixed inset-0 z-[85] xl:hidden">
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
            className="altteulmap-mobile-sheet altteulmap-mobile-sheet-list absolute flex flex-col overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-2xl"
          >
            <div className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 px-4 pb-3 pt-2 backdrop-blur">
              <div className="flex items-center justify-center pb-2">
                <span className="h-1.5 w-12 rounded-full bg-stone-300" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-stone-900">장소 목록</h2>
                  <p className="text-xs text-stone-500">{listDescription}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="altteulmap-badge whitespace-nowrap bg-stone-100 px-3 py-1 text-xs text-stone-600">
                    {totalPlaceCount}곳
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsMobileListOpen(false)}
                    data-testid="mobile-place-list-close"
                    className="altteulmap-button whitespace-nowrap border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
            <div className="altteulmap-mobile-sheet-scroll flex-1 overflow-y-auto p-2.5">
              {fetchError ? (
                <div className="mb-2.5 rounded-[1.15rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {fetchError}
                </div>
              ) : null}
              {isServerTrimmed ? (
                <div className="mb-2.5 rounded-[1.15rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                  현재 조건에 맞는 장소는 총 {totalPlaceCount}곳이고, 성능을 위해 {visiblePlaces.length}곳만 먼저 불러왔습니다.
                </div>
              ) : null}
              {isFetchingPlaces ? (
                <div className="mb-2.5 rounded-[1.15rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-500">
                  현재 지도 영역의 장소를 불러오는 중입니다.
                </div>
              ) : null}
              {isListTrimmed ? (
                <div className="mb-2.5 rounded-[1.15rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                  목록은 현재 {displayPlaces.length}곳만 먼저 표시합니다.
                </div>
              ) : null}
              <PlaceList
                bookmarkedPlaceIds={bookmarkedPlaceIds}
                bookmarkLoginHref={bookmarkLoginHref}
                isLoading={isFetchingPlaces}
                itemTestIdPrefix="mobile-place-list-item"
                likeCountTestIdPrefix="mobile-place-list-like-count"
                listTestId="mobile-place-list"
                places={displayPlaces}
                compact
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
        bookmarkedPlaceIds={bookmarkedPlaceIds}
        currentMapHref={currentMapHref}
        placeId={resolvedSelectedPlaceId}
        previewPlace={selectedPlace}
        onClose={() => {
          setSelectedPlaceId(null);
          setSelectedPlacePreview(null);
        }}
        onPlaceReactionChange={handlePlaceReactionChange}
      />
    </div>
  );
}
