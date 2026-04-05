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
import { PlaceShareButton } from "@/features/places/place-share-button";
import { createPlaceSharePayload } from "@/features/places/share";
import {
  type MobileSheetMode,
  useMobileSheetGesture,
} from "@/features/places/use-mobile-sheet-gesture";
import { formatKrw } from "@/features/places/queries";
import type {
  PlaceBounds,
  PlaceMapMarkerRecord,
  PlaceMapMarkerMode,
  PlacePreviewRecord,
  PlaceSearchScope,
} from "@/features/places/types";

const PLACE_LIST_RENDER_LIMIT = 120;

type MapExplorerProps = {
  bookmarkedPlaceIds: string[];
  bookmarkLoginHref: string;
  category: string | null;
  currentMapHref: string;
  initialBounds: PlaceBounds;
  initialCount: number;
  mapMarkers: PlaceMapMarkerRecord[];
  markerMode: PlaceMapMarkerMode;
  prefetchedOnServer: boolean;
  places: PlacePreviewRecord[];
  query: string | null;
  searchScope: PlaceSearchScope;
  selectedCategoryLabel: string | null;
};

type RefreshActionState = {
  isVisible: boolean;
  isLoading: boolean;
  onRefresh: () => void;
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
  markerMode: PlaceMapMarkerMode;
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

type ListStatusSummaryProps = {
  compact?: boolean;
  displayPlacesCount: number;
  fetchError: string | null;
  hasManualRefreshAction?: boolean;
  isFetchingPlaces: boolean;
  isListTrimmed: boolean;
  isServerTrimmed: boolean;
  totalPlaceCount: number;
  visiblePlacesCount: number;
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

function ListStatusSummary({
  compact = false,
  displayPlacesCount,
  fetchError,
  hasManualRefreshAction = false,
  isFetchingPlaces,
  isListTrimmed,
  isServerTrimmed,
  totalPlaceCount,
  visiblePlacesCount,
}: ListStatusSummaryProps) {
  const statusItems = [
    isFetchingPlaces ? "새 범위를 불러오는 중" : null,
    isServerTrimmed
      ? `총 ${totalPlaceCount}곳 중 ${visiblePlacesCount}곳 먼저 표시`
      : null,
    isListTrimmed ? `목록은 ${displayPlacesCount}곳까지만 표시` : null,
  ].filter((item): item is string => Boolean(item));

  const outerSpacingClassName = compact ? "mb-2.5 space-y-2" : "mb-3 space-y-2";
  const panelPaddingClassName = compact ? "px-3 py-3" : "px-4 py-3";
  const badgeClassName = compact
    ? "altteulmap-badge whitespace-nowrap px-2.5 py-1 text-[11px] text-stone-600"
    : "altteulmap-badge whitespace-nowrap px-3 py-1.5 text-xs text-stone-600";

  if (!fetchError && statusItems.length === 0) {
    return null;
  }

  return (
    <div className={outerSpacingClassName}>
      {fetchError ? (
        <div
          className={`rounded-[1.15rem] border border-amber-200 bg-amber-50 text-sm text-amber-800 ${panelPaddingClassName}`}
        >
          {fetchError}
        </div>
      ) : null}
      {statusItems.length > 0 ? (
        <div
          className={`rounded-[1.15rem] border border-stone-200 bg-stone-50 text-stone-600 ${panelPaddingClassName}`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
            현재 상태
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {statusItems.map((item) => (
              <span key={item} className={badgeClassName}>
                {item}
              </span>
            ))}
          </div>
          {isServerTrimmed || isListTrimmed ? (
            <p className="mt-2 text-xs text-stone-500">
              지도를 더 확대하거나 검색어를 넣으면 더 자세히 볼 수 있습니다.
            </p>
          ) : null}
          {hasManualRefreshAction ? (
            <p className="mt-2 text-xs text-stone-500">
              지도를 움직인 뒤에도 현재 지역 기준으로 다시 불러올 수 있습니다.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
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
              : "현재 지도 영역에서는 결과가 없습니다. 전체 검색으로 바꾸거나 지도를 움직인 뒤 다시 확인해보세요."
            : "지도를 움직인 뒤 오른쪽 상단의 지역 검색으로 현재 영역을 새로 확인해보세요."}
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
        const sharePayload = createPlaceSharePayload(place, "list");

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
            <div
              className="mt-3 flex justify-end"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <PlaceShareButton
                path={sharePayload.path}
                title={sharePayload.title}
                text={sharePayload.text}
                className="altteulmap-button inline-flex whitespace-nowrap border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700 transition hover:bg-stone-100"
                messageClassName="mt-1 text-right text-[11px] text-stone-500"
                testId={`${itemTestIdPrefix}-share-button-${place.id}`}
                messageTestId={`${itemTestIdPrefix}-share-message-${place.id}`}
              />
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
  markerMode,
  prefetchedOnServer,
  places,
  query,
  searchScope,
  selectedCategoryLabel,
}: MapExplorerProps) {
  const [visiblePlaces, setVisiblePlaces] = useState(places);
  const [visibleMapMarkers, setVisibleMapMarkers] = useState(mapMarkers);
  const [visibleMarkerMode, setVisibleMarkerMode] = useState(markerMode);
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
  const [mobileListSheetMode, setMobileListSheetMode] =
    useState<MobileSheetMode>("peek");
  const [manualRefreshTick, setManualRefreshTick] = useState(0);
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
  const displayMapMarkers = useMemo(
    () =>
      visibleMapMarkers.filter((marker) =>
        visibleMarkerMode === "cluster"
          ? marker.kind === "cluster"
          : marker.kind === "place",
      ),
    [visibleMapMarkers, visibleMarkerMode],
  );
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
  const refreshAction: RefreshActionState | null =
    searchScope === "viewport"
      ? {
          isVisible: true,
          isLoading: isFetchingPlaces,
          onRefresh: () => {
            setFetchError(null);
            setManualRefreshTick((current) => current + 1);
          },
        }
      : null;
  const closeMobileList = () => {
    setIsMobileListOpen(false);
    setMobileListSheetMode("peek");
  };
  const expandMobileList = () => {
    setMobileListSheetMode("expanded");
  };
  const collapseMobileList = () => {
    setMobileListSheetMode("peek");
  };
  const mobileListSheetGesture = useMobileSheetGesture({
    enabled: isMobileListOpen,
    mode: mobileListSheetMode,
    onClose: closeMobileList,
    onCollapse: collapseMobileList,
    onExpand: expandMobileList,
  });

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
            setVisibleMarkerMode(result.markerMode);
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
  }, [
    hasViewportBounds,
    manualRefreshTick,
    prefetchedOnServer,
    requestSearch,
    searchScope,
  ]);

  const handlePlaceSelect = (placeId: string) => {
    setSelectedPlaceId(placeId);
    setSelectedPlacePreview(
      visiblePlaces.find((place) => place.id === placeId) ?? null,
    );
    closeMobileList();
  };

  const handleMapPlaceSelect = (place: PlacePreviewRecord) => {
    setSelectedPlaceId(place.id);
    setSelectedPlacePreview(place);
    closeMobileList();
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
    <div className="relative isolate mt-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2.2fr)_15rem] 2xl:grid-cols-[minmax(0,2.35fr)_15.5rem]">
        <div className="relative z-0">
          <NaverMapPanel
            initialBounds={initialBounds}
            isLoading={isFetchingPlaces && visiblePlaces.length === 0}
            mapMarkers={displayMapMarkers}
            placeCount={totalPlaceCount}
            refreshAction={refreshAction}
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
                onClick={() => {
                  setMobileListSheetMode("peek");
                  setIsMobileListOpen(true);
                }}
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
            <ListStatusSummary
              displayPlacesCount={displayPlaces.length}
              fetchError={fetchError}
              hasManualRefreshAction={Boolean(refreshAction)}
              isFetchingPlaces={isFetchingPlaces}
              isListTrimmed={isListTrimmed}
              isServerTrimmed={isServerTrimmed}
              totalPlaceCount={totalPlaceCount}
              visiblePlacesCount={visiblePlaces.length}
            />
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
            onClick={closeMobileList}
            className="absolute inset-0 bg-stone-950/35"
          />
          <section
            role="dialog"
            aria-modal="true"
            data-testid="mobile-place-list-sheet"
            data-sheet-dragging={mobileListSheetGesture.isDragging ? "true" : "false"}
            data-sheet-mode={mobileListSheetMode}
            style={mobileListSheetGesture.style}
            className="altteulmap-mobile-sheet altteulmap-mobile-sheet-list absolute flex flex-col overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-2xl"
          >
            <div className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 px-4 pb-3 pt-2 backdrop-blur">
              <div className="flex items-center justify-center pb-2">
                <div
                  role="presentation"
                  data-testid="mobile-place-list-drag-handle"
                  onPointerCancel={mobileListSheetGesture.handlePointerCancel}
                  onPointerDown={mobileListSheetGesture.handlePointerDown}
                  onPointerMove={mobileListSheetGesture.handlePointerMove}
                  onPointerUp={mobileListSheetGesture.handlePointerUp}
                  className="flex w-full justify-center py-1"
                  style={{ touchAction: "none" }}
                >
                  <span className="h-1.5 w-12 rounded-full bg-stone-300" />
                </div>
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
                    onClick={() =>
                      setMobileListSheetMode((current) =>
                        current === "peek" ? "expanded" : "peek",
                      )
                    }
                    data-testid="mobile-place-list-toggle-size"
                    className="altteulmap-button whitespace-nowrap border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700"
                  >
                    {mobileListSheetMode === "peek" ? "펼치기" : "줄이기"}
                  </button>
                  <button
                    type="button"
                    onClick={closeMobileList}
                    data-testid="mobile-place-list-close"
                    className="altteulmap-button whitespace-nowrap border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
            <div className="altteulmap-mobile-sheet-scroll flex-1 overflow-y-auto p-2.5">
              <ListStatusSummary
                compact
                displayPlacesCount={displayPlaces.length}
                fetchError={fetchError}
                hasManualRefreshAction={Boolean(refreshAction)}
                isFetchingPlaces={isFetchingPlaces}
                isListTrimmed={isListTrimmed}
                isServerTrimmed={isServerTrimmed}
                totalPlaceCount={totalPlaceCount}
                visiblePlacesCount={visiblePlaces.length}
              />
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
