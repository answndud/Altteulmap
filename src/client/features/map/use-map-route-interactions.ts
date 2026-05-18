import { useCallback, useEffect, useState } from "react";

import type { PlaceReactionUpdate } from "./PlaceDetailSheet";
import type { PlacePreviewRecord } from "@/features/places/types";

type BookmarksResponse = {
  items?: Array<{ placeId: string }>;
};

export function useMapRouteInteractions() {
  const [selectedPlace, setSelectedPlace] = useState<PlacePreviewRecord | null>(
    null,
  );
  const [bookmarkedPlaceIds, setBookmarkedPlaceIds] = useState<Set<string>>(
    () => new Set(),
  );

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

  const resetSelectedPlace = useCallback(() => setSelectedPlace(null), []);

  const selectPlace = useCallback((place: PlacePreviewRecord) => {
    setSelectedPlace(place);
  }, []);

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

  const updateReactionState = useCallback(
    (
      update: PlaceReactionUpdate,
      updatePlaceInResults: (
        placeId: string,
        updatePlace: (place: PlacePreviewRecord) => PlacePreviewRecord,
      ) => void,
    ) => {
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
    },
    [],
  );

  return {
    bookmarkedPlaceIds,
    resetSelectedPlace,
    selectedPlace,
    selectPlace,
    updateBookmark,
    updateReactionState,
  };
}
