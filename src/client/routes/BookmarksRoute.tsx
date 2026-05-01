import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ViteBookmarkToggleButton } from "@/client/components/ViteBookmarkToggleButton";
import { getCategoryBySlug } from "@/features/categories/catalog";
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

type LoadState =
  | { status: "loading"; data: null; error: null }
  | {
      status: "success";
      data: {
        items: BookmarkedPlace[];
        source: BookmarksResponse["source"];
        userLabel: string;
      };
      error: null;
    }
  | { status: "unauthorized"; data: null; error: string }
  | { status: "error"; data: null; error: string };

function formatKrw(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

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

export function BookmarksRoute() {
  const [state, setState] = useState<LoadState>({
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

  return (
    <main className="bg-stone-50 px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-7xl rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div>
          <p className="text-xs font-medium text-orange-600">북마크</p>
          <h1 className="mt-3 text-3xl font-semibold text-stone-900 sm:text-5xl">
            북마크한 장소
          </h1>
          {state.status === "success" ? (
            <p className="mt-3 text-sm text-stone-500">
              {state.data.userLabel} 계정 기준으로 저장한 장소입니다.
            </p>
          ) : null}
        </div>

        {state.status === "loading" ? (
          <div className="mt-8 rounded-[1.25rem] border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-500">
            북마크 목록을 불러오는 중입니다.
          </div>
        ) : null}

        {state.status === "unauthorized" ? (
          <div className="mt-8 rounded-[1.25rem] border border-dashed border-stone-300 bg-stone-50 p-6 text-sm leading-7 text-stone-600 sm:p-8">
            <p className="text-base font-semibold text-stone-900">
              로그인이 필요합니다
            </p>
            <p className="mt-2 max-w-2xl">
              저장한 장소는 계정에 연결됩니다. 로그인 후 북마크를 이어서 확인할 수 있습니다.
            </p>
            <Link
              to="/login?callbackUrl=%2Fbookmarks"
              className="altteulmap-accent-solid altteulmap-button mt-5 inline-flex items-center justify-center px-5 py-3 text-sm font-medium"
            >
              로그인하기
            </Link>
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className="mt-8 rounded-[1.25rem] border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
            {state.error}
          </div>
        ) : null}

        {state.status === "success" && state.data.items.length > 0 ? (
          <div data-testid="bookmark-list" className="mt-8 grid gap-4">
            {state.data.items.map(({ bookmarkCreatedAt, place }) => {
              const category = getCategoryBySlug(place.categorySlug);

              return (
                <article
                  key={place.id}
                  data-testid={`bookmark-item-${place.id}`}
                  className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase text-orange-600">
                        북마크 {bookmarkCreatedAt}
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-stone-900">
                        {place.name}
                      </h2>
                      <p className="mt-2 text-sm text-stone-500">
                        {category?.name ?? "기타"}
                      </p>
                      <p className="mt-1 text-sm text-stone-400">
                        {place.district}
                      </p>
                    </div>
                    <div className="rounded-[1.35rem] bg-white px-4 py-3 text-right">
                      <p className="text-xs uppercase text-stone-500">
                        대표 가격
                      </p>
                      <p className="mt-2 text-lg font-semibold text-stone-900">
                        {formatKrw(place.representativePriceAmount)}원
                      </p>
                      <p className="text-sm text-stone-500">
                        {place.representativePriceLabel}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <ViteBookmarkToggleButton
                      key={`${place.id}:on`}
                      placeId={place.id}
                      initialBookmarked
                      compact
                      onUpdate={(nextBookmarked) => {
                        if (nextBookmarked) {
                          return;
                        }

                        setState((current) =>
                          current.status === "success"
                            ? {
                                ...current,
                                data: {
                                  ...current.data,
                                  items: current.data.items.filter(
                                    (item) => item.place.id !== place.id,
                                  ),
                                },
                              }
                            : current,
                        );
                      }}
                    />
                    <Link
                      to={`/place/${place.id}`}
                      className="altteulmap-accent-solid altteulmap-button whitespace-nowrap px-4 py-2 text-sm font-medium transition"
                    >
                      가격 보기
                    </Link>
                    <Link
                      to={`/?q=${encodeURIComponent(place.name)}&scope=global`}
                      className="altteulmap-button whitespace-nowrap border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
                    >
                      지도에서 찾기
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {state.status === "success" && state.data.items.length === 0 ? (
          <div className="mt-8 rounded-[1.25rem] border border-dashed border-stone-300 bg-stone-50 p-6 text-sm leading-7 text-stone-600 sm:p-8">
            <p className="text-base font-semibold text-stone-900">
              아직 저장한 장소가 없어요
            </p>
            <p className="mt-2 max-w-2xl">
              점심, 세탁, 프린트처럼 자주 확인하는 장소를 북마크하면 다음에
              가격을 더 빨리 볼 수 있습니다.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link
                to="/"
                className="altteulmap-accent-solid altteulmap-button inline-flex items-center justify-center px-5 py-3 text-sm font-medium"
              >
                가격 지도 열기
              </Link>
              <Link
                to="/submit"
                className="altteulmap-button inline-flex items-center justify-center px-5 py-3 text-sm font-medium text-stone-700"
              >
                장소 등록하기
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
