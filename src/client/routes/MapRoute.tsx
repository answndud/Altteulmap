import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getCategoryBySlug } from "@/features/categories/catalog";
import {
  deriveMapMarkers,
  deriveTrendingPlaces,
  mergeSelectedPlaceIntoList,
} from "@/client/features/map/map-route-derived";
import { useMapRouteInteractions } from "@/client/features/map/use-map-route-interactions";
import { useMapRoutePlaces } from "@/client/features/map/use-map-route-places";
import {
  MobilePlaceListSheet,
  type MobileSheetMode,
} from "@/client/features/map/MobilePlaceListSheet";
import { MapDesktopResultsRail } from "@/client/features/map/MapDesktopResultsRail";
import { MapSearchControls } from "@/client/features/map/MapSearchControls";
import {
  PlaceDetailSheet,
  type PlaceReactionUpdate,
} from "@/client/features/map/PlaceDetailSheet";
import { TrendingPlacesSection } from "@/client/features/map/TrendingPlacesSection";
import { NaverMapPanel } from "@/features/map/naver-map-panel";
import type {
  PlaceMapMarkerRecord,
  PlacePreviewRecord,
  PlaceSearchScope,
} from "@/features/places/types";

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
  const isDesktopLayout = useIsDesktopLayout();
  const [mobileListMode, setMobileListMode] =
    useState<MobileSheetMode>("hidden");
  const mapSectionRef = useRef<HTMLElement | null>(null);
  const query = searchParams.get("q")?.trim() || "";
  const activeCategory = searchParams.get("category");
  const searchScope: PlaceSearchScope =
    query && searchParams.get("scope") === "global" ? "global" : "viewport";
  const selectedCategory = getCategoryBySlug(activeCategory);
  const selectedCategoryLabel = selectedCategory?.name ?? null;
  const loginHref = getLoginHref();
  const {
    bookmarkedPlaceIds,
    resetSelectedPlace,
    selectedPlace,
    selectPlace,
    updateBookmark,
    updateReactionState,
  } = useMapRouteInteractions();
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

  const updateReaction = useCallback((update: PlaceReactionUpdate) => {
    updateReactionState(update, updatePlaceInResults);
  }, [updatePlaceInResults, updateReactionState]);

  const selectPlaceAndFocusMap = useCallback((place: PlacePreviewRecord) => {
    selectPlace(place);
    window.requestAnimationFrame(() => {
      mapSectionRef.current?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    });
  }, [selectPlace]);
  const selectPlaceFromMobileList = useCallback((place: PlacePreviewRecord) => {
    selectPlace(place);
    setMobileListMode("hidden");
  }, [selectPlace]);

  return (
    <main className="bg-[var(--altteul-bg-canvas)] px-3 pb-4 pt-3 sm:px-4 sm:py-4 lg:px-5 xl:px-6">
      <div className="mx-auto grid max-w-[112rem] gap-3">
        <MapSearchControls
          activeCategory={activeCategory}
          query={query}
          searchScope={searchScope}
          selectedCategory={selectedCategory}
        />

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

          <MapDesktopResultsRail
            bookmarkedPlaceIds={bookmarkedPlaceIds}
            displayedPlaces={displayedPlaces}
            isDesktopLayout={isDesktopLayout}
            isServerTrimmed={isServerTrimmed}
            loginHref={loginHref}
            onBookmarkUpdate={updateBookmark}
            onCloseSelectedPlace={resetSelectedPlace}
            onReactionUpdate={updateReaction}
            onSelectPlace={selectPlace}
            placesLength={places.length}
            searchScope={searchScope}
            selectedPlace={selectedPlace}
            state={state}
            totalPlaceCount={totalPlaceCount}
            visiblePlaceCount={visiblePlaceCount}
          />
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
              onClose={resetSelectedPlace}
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
