import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useMapDesktopLayout } from "@/client/features/map/use-map-desktop-layout";
import { useMapRouteActionHandlers } from "@/client/features/map/use-map-route-action-handlers";
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
import { TrendingPlacesSection } from "@/client/features/map/TrendingPlacesSection";
import { NaverMapPanel } from "@/features/map/naver-map-panel";
import { createCurrentLoginHref } from "@/lib/auth-navigation";

export function MapRoute() {
  const [searchParams] = useSearchParams();
  const isDesktopLayout = useMapDesktopLayout();
  const [mobileListMode, setMobileListMode] =
    useState<MobileSheetMode>("hidden");
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
  const {
    mapSectionRef,
    selectPlaceAndFocusMap,
    selectPlaceFromMobileList,
    updateReaction,
  } = useMapRouteActionHandlers({
    onMobileListModeChange: setMobileListMode,
    onSelectPlace: selectPlace,
    updatePlaceInResults,
    updateReactionState,
  });

  return (
    <main className="overflow-x-hidden bg-[var(--altteul-bg-canvas)] px-2 pb-2 pt-2 sm:px-4 sm:py-4 lg:px-5 xl:px-6">
      <div className="mx-auto grid max-w-[112rem] gap-2 sm:gap-3">
        <MapSearchControls
          activeCategory={activeCategory}
          query={query}
          searchScope={searchScope}
          selectedCategory={selectedCategory}
        />

        <section ref={mapSectionRef} className="relative min-h-0">
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

        <div className="hidden md:block">
          <TrendingPlacesSection
            items={trendingPlaces}
            onSelectPlace={selectPlaceAndFocusMap}
            selectedCategoryLabel={selectedCategoryLabel}
          />
        </div>
      </div>
    </main>
  );
}
