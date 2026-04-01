"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { BookmarkToggleButton } from "@/features/bookmarks/bookmark-toggle-button";
import { getCategoryBySlug } from "@/features/categories/catalog";
import { PlaceCommentsSection } from "@/features/places/place-comments-section";
import {
  PlaceReactionButtons,
  type PlaceReactionUpdate,
} from "@/features/places/place-reaction-buttons";
import { PlaceShareButton } from "@/features/places/place-share-button";
import { PlacePriceReportForm } from "@/features/places/place-price-report-form";
import { formatKrw } from "@/features/places/queries";
import type { PlaceRecord } from "@/features/places/types";

type PlaceDetailResponse = {
  item: PlaceRecord;
  related: PlaceRecord[];
  source: "database" | "mock";
  mock: boolean;
};

type PlaceDetailSheetProps = {
  authenticated: boolean;
  bookmarkedPlaceIds: string[];
  currentMapHref: string;
  placeId: string | null;
  previewPlace: PlaceRecord | null;
  onClose: () => void;
  onOpenPlace: (placeId: string) => void;
  onPlaceReactionChange?: (nextState: PlaceReactionUpdate) => void;
};

type PlaceDetailState = {
  error: string | null;
  item: PlaceDetailResponse | null;
  placeId: string | null;
};

function createLoginHref(path: string) {
  return `/login?callbackUrl=${encodeURIComponent(path)}`;
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-5 w-24 rounded-full bg-stone-100" />
      <div className="h-8 w-2/3 rounded-2xl bg-stone-100" />
      <div className="h-16 rounded-[1.5rem] bg-stone-100" />
      <div className="h-28 rounded-[1.5rem] bg-stone-100" />
      <div className="space-y-3">
        <div className="h-20 rounded-[1.25rem] bg-stone-100" />
        <div className="h-20 rounded-[1.25rem] bg-stone-100" />
        <div className="h-20 rounded-[1.25rem] bg-stone-100" />
      </div>
    </div>
  );
}

export function PlaceDetailSheet({
  authenticated,
  bookmarkedPlaceIds,
  currentMapHref,
  placeId,
  previewPlace,
  onClose,
  onOpenPlace,
  onPlaceReactionChange,
}: PlaceDetailSheetProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [detailState, setDetailState] = useState<PlaceDetailState>({
    error: null,
    item: null,
    placeId: null,
  });

  useEffect(() => {
    if (!placeId) {
      return;
    }

    const controller = new AbortController();

    fetch(`/api/places/${encodeURIComponent(placeId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("장소 상세를 불러오지 못했습니다.");
        }

        return (await response.json()) as PlaceDetailResponse;
      })
      .then((result) => {
        setDetailState({
          error: null,
          item: result,
          placeId,
        });
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setDetailState({
          error:
            fetchError instanceof Error
              ? fetchError.message
              : "장소 상세를 불러오지 못했습니다.",
          item: null,
          placeId,
        });
      });

    return () => {
      controller.abort();
    };
  }, [placeId]);

  useEffect(() => {
    if (!placeId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, placeId]);

  useEffect(() => {
    if (!placeId) {
      return;
    }

    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [placeId]);

  if (!placeId) {
    return null;
  }

  const data = detailState.placeId === placeId ? detailState.item : null;
  const error = detailState.placeId === placeId ? detailState.error : null;
  const isLoading = detailState.placeId !== placeId;
  const place = data?.item ?? previewPlace;
  const category = place ? getCategoryBySlug(place.categorySlug) : null;
  const relatedPlaces = data?.related ?? [];
  const isBookmarked = place ? bookmarkedPlaceIds.includes(place.id) : false;
  const placePath = place ? `/place/${place.id}` : null;
  const bookmarkLoginHref = createLoginHref(currentMapHref);
  const reportPath = place
    ? `/report?placeId=${place.id}&placeName=${encodeURIComponent(place.name)}`
    : null;
  const reportHref = reportPath
    ? authenticated
      ? reportPath
      : createLoginHref(reportPath)
    : null;

  const handleReactionUpdate = (nextState: PlaceReactionUpdate) => {
    setDetailState((current) => {
      if (
        current.placeId !== nextState.placeId ||
        !current.item ||
        current.item.item.id !== nextState.placeId
      ) {
        return current;
      }

      return {
        ...current,
        item: {
          ...current.item,
          item: {
            ...current.item.item,
            likeCount: nextState.likeCount,
            dislikeCount: nextState.dislikeCount,
            viewerReaction: nextState.viewerReaction,
          },
        },
      };
    });

    onPlaceReactionChange?.(nextState);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-50 xl:absolute xl:inset-0">
      <button
        type="button"
        aria-label="상세 패널 닫기"
        onClick={onClose}
        className="pointer-events-auto absolute inset-0 bg-stone-950/30 xl:rounded-[2rem]"
      />

      <aside
        role="dialog"
        aria-modal="true"
        data-testid="place-detail-sheet"
        className="pointer-events-auto absolute inset-x-0 bottom-0 flex max-h-[82vh] w-full flex-col overflow-hidden rounded-t-[2rem] border-t border-stone-200 bg-white shadow-2xl xl:inset-x-auto xl:inset-y-0 xl:right-0 xl:max-h-none xl:max-w-[28rem] xl:rounded-l-[2rem] xl:rounded-t-none xl:border-l xl:border-t-0"
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">상세 정보</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="place-detail-close"
            className="whitespace-nowrap rounded-full border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
          >
            닫기
          </button>
        </div>

        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-4 py-5 sm:px-5"
        >
          {isLoading && !previewPlace ? <LoadingState /> : null}

          {!isLoading && error && !place ? (
            <div className="rounded-[1.5rem] border border-dashed border-stone-300 bg-stone-50 p-6 text-sm leading-7 text-stone-600">
              <p className="font-medium text-stone-900">{error}</p>
              <p className="mt-3">
                잠시 후 다시 시도하거나 전체 상세 페이지에서 확인해보세요.
              </p>
              {placePath ? (
                <Link
                  href={placePath}
                  className="mt-4 inline-flex whitespace-nowrap rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
                >
                  페이지로 보기
                </Link>
              ) : null}
            </div>
          ) : null}

          {!isLoading && !error && place ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-600">
                    {category?.parentName ?? "생활비 절감"}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
                    {place.name}
                  </h3>
                  {place.businessName && place.businessName !== place.name ? (
                    <p className="mt-3 text-sm text-stone-500">
                      {place.businessName}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm text-stone-500">
                    {category?.name ?? "기타"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-stone-500">
                    {place.address}
                  </p>
                </div>
              </div>

              <section className="altteulmap-accent-panel rounded-[1.75rem] p-5">
                <p className="text-sm text-[#a06a48]">대표 가격</p>
                <p className="mt-2 text-3xl font-semibold">
                  {formatKrw(place.representativePriceAmount)}원
                </p>
                <p className="mt-2 text-sm text-[#a06a48]">
                  {place.representativePriceLabel}
                </p>
                <div className="mt-4">
                  <PlaceReactionButtons
                    key={`${place.id}:${place.likeCount}:${place.dislikeCount}:${place.viewerReaction ?? "none"}`}
                    placeId={place.id}
                    initialLikeCount={place.likeCount}
                    initialDislikeCount={place.dislikeCount}
                    initialViewerReaction={place.viewerReaction}
                    onUpdate={handleReactionUpdate}
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <BookmarkToggleButton
                    placeId={place.id}
                    initialBookmarked={isBookmarked}
                    loginHref={bookmarkLoginHref}
                  />
                  <PlaceShareButton
                    path={`/place/${place.id}`}
                    title={place.name}
                    className="inline-flex whitespace-nowrap rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
                  />
                  {reportHref ? (
                    <Link
                      href={reportHref}
                      className="altteulmap-accent-ghost inline-flex whitespace-nowrap rounded-full border px-4 py-2 text-sm transition"
                    >
                      신고하기
                    </Link>
                  ) : null}
                  {placePath ? (
                    <Link
                      href={placePath}
                      className="altteulmap-accent-ghost inline-flex whitespace-nowrap rounded-full border px-4 py-2 text-sm transition"
                    >
                      페이지로 보기
                    </Link>
                  ) : null}
                </div>
              </section>

              {isLoading ? (
                <div className="rounded-[1.35rem] border border-stone-200 bg-stone-50 px-4 py-3 text-xs text-stone-500">
                  세부 가격과 코멘트를 불러오는 중입니다.
                </div>
              ) : null}

              {!isLoading && error ? (
                <div className="rounded-[1.35rem] border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  세부 정보 일부를 불러오지 못했습니다. 기본 정보만 먼저 표시합니다.
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <section className="rounded-[1.35rem] border border-stone-200 bg-stone-50 p-4">
                  <p className="text-xs font-medium text-stone-500">최근 갱신일</p>
                  <p className="mt-2 text-base font-semibold text-stone-900">
                    {place.lastPriceUpdatedAt}
                  </p>
                </section>
                <section className="rounded-[1.35rem] border border-stone-200 bg-stone-50 p-4">
                  <p className="text-xs font-medium text-stone-500">지역</p>
                  <p className="mt-2 text-base font-semibold text-stone-900">
                    {place.district}
                  </p>
                </section>
              </div>

              <section className="rounded-[1.5rem] border border-stone-200 bg-white p-5">
                <h4 className="text-sm font-semibold text-stone-900">장소 소개</h4>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  {place.description}
                </p>
                <p className="mt-3 text-sm leading-7 text-stone-600">{place.note}</p>
              </section>

              <section className="rounded-[1.5rem] border border-stone-200 bg-white p-5">
                <h4 className="text-sm font-semibold text-stone-900">가격 항목</h4>
                {place.priceItems.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {place.priceItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-[1.15rem] bg-stone-50 px-4 py-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-stone-900">{item.label}</p>
                            <p className="mt-1 text-xs text-stone-500">
                              마지막 제보 {item.reportedAt}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-stone-900">
                              {formatKrw(item.amount)}원
                              {item.unitLabel ? ` / ${item.unitLabel}` : ""}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-stone-500">
                    아직 상세 가격 항목을 불러오지 못했습니다.
                  </p>
                )}
              </section>
              <PlacePriceReportForm
                key={`${place.id}-price-form`}
                placeId={place.id}
                authenticated={authenticated}
                loginHref={bookmarkLoginHref}
                suggestedItems={place.priceItems}
              />

              <PlaceCommentsSection
                key={`${place.id}-comments`}
                placeId={place.id}
                initialComments={place.comments}
                authenticated={authenticated}
                loginHref={bookmarkLoginHref}
              />

              <section className="rounded-[1.5rem] border border-stone-200 bg-white p-5">
                <h4 className="text-sm font-semibold text-stone-900">비슷한 장소</h4>
                {relatedPlaces.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {relatedPlaces.map((related) => (
                      <button
                        key={related.id}
                        type="button"
                        onClick={() => onOpenPlace(related.id)}
                        className="block w-full rounded-[1.15rem] bg-stone-50 px-4 py-4 text-left transition hover:bg-stone-100"
                      >
                        <p className="font-medium text-stone-900">{related.name}</p>
                        <p className="mt-1 text-xs text-stone-500">
                          {related.representativePriceLabel} ·{" "}
                          {formatKrw(related.representativePriceAmount)}원
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-stone-500">
                    비슷한 장소를 찾는 중이거나 아직 없습니다.
                  </p>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
