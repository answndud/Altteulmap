import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useSearchParams } from "react-router-dom";

import { getCategoryBySlug } from "@/features/categories/catalog";
import { createMapHref } from "@/client/features/map/map-query";
import {
  deriveMapMarkers,
  deriveTrendingPlaces,
  mergeSelectedPlaceIntoList,
} from "@/client/features/map/map-route-derived";
import { useMapRoutePlaces } from "@/client/features/map/use-map-route-places";
import { MapCategoryTray } from "@/client/features/map/MapCategoryTray";
import {
  MobilePlaceListSheet,
  type MobileSheetMode,
} from "@/client/features/map/MobilePlaceListSheet";
import {
  PlaceDetailSheet,
  type PlaceReactionUpdate,
} from "@/client/features/map/PlaceDetailSheet";
import { PlaceCard } from "@/client/features/map/PlaceCard";
import { TrendingPlacesSection } from "@/client/features/map/TrendingPlacesSection";
import { NaverMapPanel } from "@/features/map/naver-map-panel";
import { RouteResetDetails } from "@/features/map/route-reset-details";
import type {
  PlaceMapMarkerRecord,
  PlacePreviewRecord,
  PlaceSearchScope,
} from "@/features/places/types";

type BookmarksResponse = {
  items?: Array<{ placeId: string }>;
};

const scopeChipClassName =
  "altteulmap-scope-chip inline-flex min-w-[6.75rem] items-center justify-center whitespace-nowrap rounded-[0.65rem] px-3 py-2 text-xs font-semibold transition sm:text-sm";

function useIsDesktopLayout() {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia("(min-width: 1280px)").matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1280px)");
    const updateDesktopState = () => setIsDesktop(mediaQuery.matches);

    updateDesktopState();
    mediaQuery.addEventListener("change", updateDesktopState);

    return () => {
      mediaQuery.removeEventListener("change", updateDesktopState);
    };
  }, []);

  return isDesktop;
}

function getLoginHref() {
  const callbackUrl =
    typeof window === "undefined"
      ? "/"
      : `${window.location.pathname}${window.location.search}`;

  return `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

export function MapRoute() {
  const [searchParams] = useSearchParams();
  const [selectedPlace, setSelectedPlace] = useState<PlacePreviewRecord | null>(
    null,
  );
  const isDesktopLayout = useIsDesktopLayout();
  const [mobileListMode, setMobileListMode] =
    useState<MobileSheetMode>("hidden");
  const mapSectionRef = useRef<HTMLElement | null>(null);
  const [bookmarkedPlaceIds, setBookmarkedPlaceIds] = useState<Set<string>>(
    () => new Set(),
  );
  const query = searchParams.get("q")?.trim() || "";
  const activeCategory = searchParams.get("category");
  const searchScope: PlaceSearchScope =
    query && searchParams.get("scope") === "global" ? "global" : "viewport";
  const selectedCategory = getCategoryBySlug(activeCategory);
  const selectedCategoryLabel = selectedCategory?.name ?? null;
  const loginHref = getLoginHref();
  const resetSelectedPlace = useCallback(() => setSelectedPlace(null), []);
  const {
    handleClusterFocusViewport,
    handleViewportChange,
    isManualRefreshPending,
    optimisticClusterPlaces,
    refreshViewportPlaces,
    state,
    updatePlaceInResults,
    viewport,
  } = useMapRoutePlaces({
    onResetSelectedPlace: resetSelectedPlace,
    searchParams,
    searchScope,
  });

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/bookmarks", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return (await response.json()) as BookmarksResponse;
      })
      .then((payload) => {
        if (!payload?.items) {
          return;
        }

        setBookmarkedPlaceIds(
          new Set(payload.items.map((bookmark) => bookmark.placeId)),
        );
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.debug("Bookmarks are unavailable for this visitor.", error);
        }
      });

    return () => controller.abort();
  }, []);

  const places = useMemo(() => state.data?.items ?? [], [state.data?.items]);
  const mapMarkers = useMemo<PlaceMapMarkerRecord[]>(() => {
    return deriveMapMarkers(
      state.data?.mapMarkers ?? [],
      optimisticClusterPlaces,
    );
  }, [optimisticClusterPlaces, state.data?.mapMarkers]);
  const displayedPlaces = useMemo(() => {
    return mergeSelectedPlaceIntoList(places, selectedPlace);
  }, [places, selectedPlace]);
  const trendingPlaces = useMemo(() => {
    return deriveTrendingPlaces(displayedPlaces, query);
  }, [displayedPlaces, query]);
  const totalPlaceCount = state.status === "success" ? state.data.count : 0;
  const visiblePlaceCount =
    state.status === "success" ? state.data.returnedCount : 0;
  const isServerTrimmed =
    state.status === "success" && state.data.count > state.data.returnedCount;

  const updateBookmark = useCallback((placeId: string, bookmarked: boolean) => {
    setBookmarkedPlaceIds((current) => {
      const next = new Set(current);

      if (bookmarked) {
        next.add(placeId);
      } else {
        next.delete(placeId);
      }

      return next;
    });
  }, []);

  const updateReaction = useCallback((update: PlaceReactionUpdate) => {
    setSelectedPlace((current) =>
      current?.id === update.placeId
        ? {
            ...current,
            dislikeCount: update.dislikeCount,
            likeCount: update.likeCount,
            viewerReaction: update.viewerReaction,
          }
        : current,
    );
    updatePlaceInResults(update.placeId, (place) => ({
      ...place,
      dislikeCount: update.dislikeCount,
      likeCount: update.likeCount,
      viewerReaction: update.viewerReaction,
    }));
  }, [updatePlaceInResults]);
  const selectPlace = useCallback((place: PlacePreviewRecord) => {
    setSelectedPlace(place);
  }, []);
  const selectPlaceAndFocusMap = useCallback((place: PlacePreviewRecord) => {
    setSelectedPlace(place);
    window.requestAnimationFrame(() => {
      mapSectionRef.current?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    });
  }, []);
  const selectPlaceFromMobileList = useCallback((place: PlacePreviewRecord) => {
    setSelectedPlace(place);
    setMobileListMode("hidden");
  }, []);

  return (
    <main className="bg-[var(--altteul-bg-canvas)] px-3 pb-4 pt-3 sm:px-4 sm:py-4 lg:px-5 xl:px-6">
      <div className="mx-auto grid max-w-[112rem] gap-3">
        <section className="grid gap-3 border-b border-[var(--altteul-surface-border)] pb-3 sm:pb-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="altteulmap-section-kicker">탐색</p>
              <h1 className="mt-1 text-xl font-bold text-[var(--altteul-text-strong)] sm:text-[1.55rem]">
                가격이 보이는 동네 지도
              </h1>
              <p className="mt-1 hidden max-w-2xl text-sm leading-6 text-[var(--altteul-text-secondary)] sm:block">
                대표 가격, 검증 상태, 최근 갱신을 기준으로 지금 갈 곳을 빠르게 비교합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {query ? (
                <span className="altteulmap-badge px-3 py-1.5 text-xs font-medium">
                  검색: {query}
                </span>
              ) : null}
              {selectedCategory ? (
                <span className="altteulmap-badge px-3 py-1.5 text-xs font-medium">
                  업종: {selectedCategory.name}
                </span>
              ) : null}
              <span className="altteulmap-badge px-3 py-1.5 text-xs font-medium">
                {searchScope === "global" ? "전체 지역" : "현재 지도 범위"}
              </span>
            </div>
          </div>

          <form action="/" className="grid gap-2.5" data-testid="place-search-form">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <label className="grid min-w-0 gap-1.5">
                <span className="sr-only">장소나 서비스 검색</span>
                <input
                  type="search"
                  name="q"
                  defaultValue={query}
                  placeholder="무엇을 싸게 찾고 있나요? 예: 김밥, 세탁소, 프린트"
                  data-testid="place-search-input"
                  className="altteulmap-input h-11 px-4 text-sm"
                />
              </label>
              {activeCategory ? (
                <input type="hidden" name="category" value={activeCategory} />
              ) : null}
              <button
                type="submit"
                data-testid="place-search-submit"
                className="altteulmap-accent-solid altteulmap-button inline-flex h-11 items-center justify-center px-4 text-sm font-medium sm:px-5"
              >
                검색
              </button>
              {query ? (
                <Link
                  to={createMapHref({ category: activeCategory })}
                  className="altteulmap-button col-span-2 inline-flex h-11 items-center justify-center px-4 text-sm font-medium sm:col-auto"
                >
                  지우기
                </Link>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[var(--altteul-text-secondary)]">검색 범위</span>
                <div className="altteulmap-segmented w-fit">
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      value="viewport"
                      data-testid="search-scope-viewport"
                      defaultChecked={searchScope === "viewport"}
                      className="altteulmap-scope-input sr-only"
                    />
                    <span className={scopeChipClassName}>현재 지도 범위</span>
                  </label>
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      value="global"
                      data-testid="search-scope-global"
                      defaultChecked={searchScope === "global"}
                      className="altteulmap-scope-input sr-only"
                    />
                    <span className={scopeChipClassName}>전체 지역</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
              <RouteResetDetails
                key={`${activeCategory ?? "all"}:${query || "all"}:${searchScope}`}
                className="w-full overflow-hidden rounded-[0.85rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)]"
                summaryClassName="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-sm font-semibold text-[var(--altteul-text-primary)] [&::-webkit-details-marker]:hidden"
                summary={
                  <>
                    <div className="min-w-0">
                      <span>업종 필터</span>
                      <p className="mt-0.5 truncate text-xs font-normal text-[var(--altteul-text-tertiary)]">
                        {selectedCategory
                          ? `${selectedCategory.parentName} · ${selectedCategory.name}`
                          : "전체 업종"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-[var(--altteul-primary-text)]">
                      열기
                    </span>
                  </>
                }
                bodyClassName="border-t border-[var(--altteul-surface-border)] px-3.5 py-3.5"
              >
                <MapCategoryTray
                  activeCategory={activeCategory}
                  activeQuery={query || null}
                  activeSearchScope={searchScope}
                />
              </RouteResetDetails>

              <div className="hidden xl:flex xl:flex-wrap xl:justify-end xl:gap-2">
                <span className="altteulmap-badge whitespace-nowrap px-3 py-1.5 text-xs font-medium">
                  {searchScope === "global" ? "지도 밖 결과 포함" : "보이는 범위 중심"}
                </span>
                <span className="altteulmap-badge whitespace-nowrap px-3 py-1.5 text-xs font-medium">
                  가격 중심 카드
                </span>
              </div>
            </div>
          </form>
        </section>

        <section ref={mapSectionRef} className="relative">
          <NaverMapPanel
            initialBounds={state.data?.bounds ?? null}
            isLoading={state.status === "loading"}
            mapMarkers={mapMarkers}
            placeCount={state.data?.count ?? 0}
            refreshAction={
              searchScope === "viewport" && viewport
                ? {
                    isVisible: true,
                    isLoading: isManualRefreshPending,
                    onRefresh: refreshViewportPlaces,
                  }
                : null
            }
            selectedCategoryLabel={selectedCategoryLabel}
            activePlaceId={selectedPlace?.id ?? null}
            focusPlacesKey={
              query && searchScope === "global"
                ? `${query}:${activeCategory ?? "all"}`
                : null
            }
            onSelectPlace={selectPlace}
            onClusterFocusViewport={handleClusterFocusViewport}
            onViewportChange={handleViewportChange}
          />

          <aside className="hidden content-start gap-3 overflow-auto rounded-[0.875rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)] p-3 shadow-[var(--altteul-shadow-overlay)] xl:absolute xl:right-3 xl:top-3 xl:z-20 xl:grid xl:max-h-[calc(100%-1.5rem)] xl:w-[18rem] 2xl:w-[20rem]">
            {selectedPlace && isDesktopLayout ? (
              <PlaceDetailSheet
                bookmarked={bookmarkedPlaceIds.has(selectedPlace.id)}
                loginHref={loginHref}
                place={selectedPlace}
                onBookmarkUpdate={updateBookmark}
                onClose={() => setSelectedPlace(null)}
                onReactionUpdate={updateReaction}
              />
            ) : null}

            <div className="flex items-center justify-between border-b border-[var(--altteul-surface-border)] pb-3">
              <div>
                <p className="altteulmap-section-kicker text-[11px]">목록</p>
                <h2 className="mt-1 text-base font-semibold text-[var(--altteul-text-strong)]">
                  지도 결과
                </h2>
              </div>
              <span className="altteulmap-badge px-3 py-1 text-xs font-medium">
                {state.status === "success" ? state.data.count : "..."}곳
              </span>
            </div>

            {state.status === "success" && (isServerTrimmed || visiblePlaceCount > 0) ? (
              <div className="flex flex-wrap gap-2 text-xs text-[var(--altteul-text-secondary)]">
                {isServerTrimmed ? (
                  <span className="altteulmap-badge px-2.5 py-1 text-[11px] font-medium">
                    총 {totalPlaceCount}곳 중 {visiblePlaceCount}곳 먼저 표시
                  </span>
                ) : null}
                <span className="altteulmap-badge px-2.5 py-1 text-[11px] font-medium">
                  {searchScope === "global" ? "전체 지역 검색" : "지도 영역 검색"}
                </span>
              </div>
            ) : null}

            {state.status === "loading" ? (
              <div className="rounded-[0.85rem] border border-dashed border-[var(--altteul-surface-border-strong)] bg-[var(--altteul-bg-surface)] p-6 text-center text-sm text-[var(--altteul-text-tertiary)]">
                지도 결과를 불러오는 중입니다.
              </div>
            ) : null}
            {state.status === "error" ? (
              <div className="rounded-[0.85rem] border border-[var(--altteul-warning-border)] bg-[var(--altteul-warning-soft)] px-4 py-3 text-sm text-[var(--altteul-warning-text)]">
                {state.error}
              </div>
            ) : null}
            {state.status === "success" && places.length === 0 ? (
              <div className="rounded-[0.85rem] border border-dashed border-[var(--altteul-surface-border-strong)] bg-[var(--altteul-bg-surface)] p-6 text-center text-sm leading-7 text-[var(--altteul-text-tertiary)]">
                조건에 맞는 장소가 없습니다.
              </div>
            ) : null}
            {state.status === "success" && places.length > 0 ? (
              <div className="grid gap-3 pr-1" data-testid="place-list">
                {displayedPlaces.map((place) => (
                  <PlaceCard
                    key={place.id}
                    bookmarked={bookmarkedPlaceIds.has(place.id)}
                    isSelected={selectedPlace?.id === place.id}
                    loginHref={loginHref}
                    place={place}
                    onBookmarkUpdate={updateBookmark}
                    onSelect={selectPlace}
                  />
                ))}
              </div>
            ) : null}
          </aside>
        </section>

        {!selectedPlace ? (
          <MobilePlaceListSheet
            bookmarkedPlaceIds={bookmarkedPlaceIds}
            loginHref={loginHref}
            mode={mobileListMode}
            onBookmarkUpdate={updateBookmark}
            onModeChange={setMobileListMode}
            onSelectPlace={selectPlaceFromMobileList}
            places={displayedPlaces}
            state={state}
            totalPlaceCount={state.status === "success" ? state.data.count : 0}
          />
        ) : null}

        {selectedPlace && !isDesktopLayout ? (
          <div className="xl:hidden">
            <PlaceDetailSheet
              bookmarked={bookmarkedPlaceIds.has(selectedPlace.id)}
              loginHref={loginHref}
              place={selectedPlace}
              onBookmarkUpdate={updateBookmark}
              onClose={() => setSelectedPlace(null)}
              onReactionUpdate={updateReaction}
            />
          </div>
        ) : null}

        <TrendingPlacesSection
          items={trendingPlaces}
          onSelectPlace={selectPlaceAndFocusMap}
          selectedCategoryLabel={selectedCategoryLabel}
        />
      </div>
    </main>
  );
}
