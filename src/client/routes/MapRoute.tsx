import { useCallback, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useMapDesktopLayout } from "@/client/features/map/use-map-desktop-layout";
import { useMapRouteInteractions } from "@/client/features/map/use-map-route-interactions";
import { useMapRoutePanelProps } from "@/client/features/map/use-map-route-panel-props";
import { useMapRoutePlaces } from "@/client/features/map/use-map-route-places";
import {
  useMapRouteSearchModel,
  useMapRouteViewModel,
} from "@/client/features/map/use-map-route-view-model";
import type { MobileSheetMode } from "@/client/features/map/MobilePlaceListSheet";
import { MapDesktopResultsRail } from "@/client/features/map/MapDesktopResultsRail";
import { MapMobileSurfaces } from "@/client/features/map/MapMobileSurfaces";
import { MapSearchControls } from "@/client/features/map/MapSearchControls";
import type { PlaceReactionUpdate } from "@/client/features/map/PlaceDetailSheet";
import { TrendingPlacesSection } from "@/client/features/map/TrendingPlacesSection";
import { NaverMapPanel } from "@/features/map/naver-map-panel";
import type { PlacePreviewRecord } from "@/features/places/types";
import { createCurrentLoginHref } from "@/lib/auth-navigation";

export function MapRoute() {
  const [searchParams] = useSearchParams();
  const isDesktopLayout = useMapDesktopLayout();
  const [mobileListMode, setMobileListMode] =
    useState<MobileSheetMode>("hidden");
  const mapSectionRef = useRef<HTMLElement | null>(null);
  const loginHref = createCurrentLoginHref();
  const {
    activeCategory,
    query,
    searchScope,
    selectedCategory,
    selectedCategoryLabel,
  } = useMapRouteSearchModel(searchParams);
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
  const {
    displayedPlaces,
    isServerTrimmed,
    mapMarkers,
    places,
    totalPlaceCount,
    trendingPlaces,
    visiblePlaceCount,
  } = useMapRouteViewModel({
    optimisticClusterPlaces,
    query,
    selectedPlace,
    state,
  });
  const mapPanelProps = useMapRoutePanelProps({
    activeCategory,
    isManualRefreshPending,
    mapMarkers,
    onClusterFocusViewport: handleClusterFocusViewport,
    onRefreshViewportPlaces: refreshViewportPlaces,
    onSelectPlace: selectPlace,
    onViewportChange: handleViewportChange,
    query,
    searchScope,
    selectedCategoryLabel,
    selectedPlace,
    state,
    viewport,
  });

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
          <NaverMapPanel {...mapPanelProps} />

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

        <MapMobileSurfaces
          bookmarkedPlaceIds={bookmarkedPlaceIds}
          displayedPlaces={displayedPlaces}
          isDesktopLayout={isDesktopLayout}
          loginHref={loginHref}
          mobileListMode={mobileListMode}
          onBookmarkUpdate={updateBookmark}
          onCloseSelectedPlace={resetSelectedPlace}
          onMobileListModeChange={setMobileListMode}
          onReactionUpdate={updateReaction}
          onSelectPlaceFromMobileList={selectPlaceFromMobileList}
          selectedPlace={selectedPlace}
          state={state}
        />

        <TrendingPlacesSection
          items={trendingPlaces}
          onSelectPlace={selectPlaceAndFocusMap}
          selectedCategoryLabel={selectedCategoryLabel}
        />
      </div>
    </main>
  );
}
