import {
  MobilePlaceListSheet,
  type MobileSheetMode,
} from "./MobilePlaceListSheet";
import {
  PlaceDetailSheet,
  type PlaceReactionUpdate,
} from "./PlaceDetailSheet";
import type { PlacePreviewRecord } from "@/features/places/types";

type MapMobilePlacesState =
  | { status: "loading"; data: { count: number } | null; error: null }
  | { status: "success"; data: { count: number }; error: null }
  | { status: "error"; data: { count: number } | null; error: string };

export function MapMobileSurfaces({
  bookmarkedPlaceIds,
  displayedPlaces,
  isDesktopLayout,
  loginHref,
  mobileListMode,
  onBookmarkUpdate,
  onCloseSelectedPlace,
  onMobileListModeChange,
  onReactionUpdate,
  onSelectPlaceFromMobileList,
  selectedPlace,
  state,
}: {
  bookmarkedPlaceIds: Set<string>;
  displayedPlaces: PlacePreviewRecord[];
  isDesktopLayout: boolean;
  loginHref: string;
  mobileListMode: MobileSheetMode;
  onBookmarkUpdate: (placeId: string, bookmarked: boolean) => void;
  onCloseSelectedPlace: () => void;
  onMobileListModeChange: (mode: MobileSheetMode) => void;
  onReactionUpdate: (update: PlaceReactionUpdate) => void;
  onSelectPlaceFromMobileList: (place: PlacePreviewRecord) => void;
  selectedPlace: PlacePreviewRecord | null;
  state: MapMobilePlacesState;
}) {
  return (
    <>
      {!selectedPlace ? (
        <MobilePlaceListSheet
          bookmarkedPlaceIds={bookmarkedPlaceIds}
          loginHref={loginHref}
          mode={mobileListMode}
          onBookmarkUpdate={onBookmarkUpdate}
          onModeChange={onMobileListModeChange}
          onSelectPlace={onSelectPlaceFromMobileList}
          places={displayedPlaces}
          state={state}
          totalPlaceCount={state.data?.count ?? 0}
        />
      ) : null}

      {selectedPlace && !isDesktopLayout ? (
        <div className="xl:hidden">
          <PlaceDetailSheet
            bookmarked={bookmarkedPlaceIds.has(selectedPlace.id)}
            loginHref={loginHref}
            place={selectedPlace}
            onBookmarkUpdate={onBookmarkUpdate}
            onClose={onCloseSelectedPlace}
            onReactionUpdate={onReactionUpdate}
          />
        </div>
      ) : null}
    </>
  );
}
