import { useEffect, useState } from "react";

import type { PlaceRecord } from "@/features/places/types";

type BookmarkRecord = {
  placeId: string;
  createdAt: string;
};

type BookmarkedPlace = {
  bookmarkCreatedAt: string;
  place: PlaceRecord;
};

type BookmarksResponse = {
  items: BookmarkRecord[];
  count: number;
  source: "database" | "mock";
  userLabel: string;
  mock: boolean;
};

type PlaceDetailResponse = {
  item: PlaceRecord;
  source: "database" | "mock";
  mock: boolean;
};

type BookmarkedPlacesData = {
  items: BookmarkedPlace[];
  source: BookmarksResponse["source"];
  userLabel: string;
};

type BookmarkedPlacesState =
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: BookmarkedPlacesData; error: null }
  | { status: "unauthorized"; data: null; error: string }
  | { status: "error"; data: null; error: string };

async function loadBookmarkedPlaces(signal: AbortSignal) {
  const bookmarkResponse = await fetch("/api/bookmarks", {
    cache: "no-store",
    signal,
  });

  if (bookmarkResponse.status === 401) {
    throw new Error("UNAUTHORIZED");
  }

  if (!bookmarkResponse.ok) {
    throw new Error("북마크 목록을 불러오지 못했습니다.");
  }

  const bookmarks = (await bookmarkResponse.json()) as BookmarksResponse;
  const items = await Promise.all(
    bookmarks.items.map(async (bookmark) => {
      const placeResponse = await fetch(
        `/api/places/${encodeURIComponent(bookmark.placeId)}`,
        {
          cache: "no-store",
          signal,
        },
      );

      if (!placeResponse.ok) {
        return null;
      }

      const place = (await placeResponse.json()) as PlaceDetailResponse;

      return {
        bookmarkCreatedAt: bookmark.createdAt,
        place: place.item,
      } satisfies BookmarkedPlace;
    }),
  );

  return {
    items: items.filter((item): item is BookmarkedPlace => item !== null),
    source: bookmarks.source,
    userLabel: bookmarks.userLabel,
  };
}

export function useBookmarkedPlaces() {
  const [state, setState] = useState<BookmarkedPlacesState>({
    status: "loading",
    data: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    loadBookmarkedPlaces(controller.signal)
      .then((data) => {
        setState({ status: "success", data, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (error instanceof Error && error.message === "UNAUTHORIZED") {
          setState({
            status: "unauthorized",
            data: null,
            error: "로그인이 필요합니다.",
          });
          return;
        }

        setState({
          status: "error",
          data: null,
          error:
            error instanceof Error
              ? error.message
              : "북마크 목록을 불러오지 못했습니다.",
        });
      });

    return () => {
      controller.abort();
    };
  }, []);

  return { setState, state };
}
