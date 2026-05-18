import { useCallback, useRef } from "react";

import type { PlaceReactionUpdate } from "@/client/features/map/PlaceDetailSheet";
import type { MobileSheetMode } from "@/client/features/map/MobilePlaceListSheet";
import type { PlacePreviewRecord } from "@/features/places/types";

type UpdatePlaceInResults = (
  placeId: string,
  updatePlace: (place: PlacePreviewRecord) => PlacePreviewRecord,
) => void;

type UpdateReactionState = (
  update: PlaceReactionUpdate,
  updatePlaceInResults: UpdatePlaceInResults,
) => void;

type UseMapRouteActionHandlersInput = {
  onMobileListModeChange: (mode: MobileSheetMode) => void;
  onSelectPlace: (place: PlacePreviewRecord) => void;
  updatePlaceInResults: UpdatePlaceInResults;
  updateReactionState: UpdateReactionState;
};

export function useMapRouteActionHandlers({
  onMobileListModeChange,
  onSelectPlace,
  updatePlaceInResults,
  updateReactionState,
}: UseMapRouteActionHandlersInput) {
  const mapSectionRef = useRef<HTMLElement | null>(null);

  const updateReaction = useCallback(
    (update: PlaceReactionUpdate) => {
      updateReactionState(update, updatePlaceInResults);
    },
    [updatePlaceInResults, updateReactionState],
  );

  const selectPlaceAndFocusMap = useCallback(
    (place: PlacePreviewRecord) => {
      onSelectPlace(place);
      window.requestAnimationFrame(() => {
        mapSectionRef.current?.scrollIntoView({
          block: "start",
          behavior: "smooth",
        });
      });
    },
    [onSelectPlace],
  );

  const selectPlaceFromMobileList = useCallback(
    (place: PlacePreviewRecord) => {
      onSelectPlace(place);
      onMobileListModeChange("hidden");
    },
    [onMobileListModeChange, onSelectPlace],
  );

  return {
    mapSectionRef,
    selectPlaceAndFocusMap,
    selectPlaceFromMobileList,
    updateReaction,
  };
}
