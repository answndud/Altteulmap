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
import { createPlaceSharePayload } from "@/features/places/share";
import { useMobileSheetGesture } from "@/features/places/use-mobile-sheet-gesture";
import type {
  PlacePreviewRecord,
  PlaceRecord,
} from "@/features/places/types";

type PlaceDetailResponse = {
  item: PlaceRecord;
  source: "database" | "mock";
  mock: boolean;
};

type PlaceDetailSheetProps = {
  bookmarkedPlaceIds: string[];
  currentMapHref: string;
  placeId: string | null;
  previewPlace: PlacePreviewRecord | null;
  onClose: () => void;
  onPlaceReactionChange?: (nextState: PlaceReactionUpdate) => void;
};

type PlaceDetailState = {
  error: string | null;
  item: PlaceDetailResponse | null;
  placeId: string | null;
};

type PlaceReactionOverride = {
  dislikeCount: number;
  likeCount: number;
  viewerReaction: PlaceReactionUpdate["viewerReaction"];
};

function createLoginHref(path: string) {
  return `/login?callbackUrl=${encodeURIComponent(path)}`;
}

function LoadingState() {
  return (
    <div className="grid gap-4">
      <div className="rounded-[1rem] bg-stone-100/90 p-5">
        <div className="h-4 w-24 rounded-full bg-stone-200" />
        <div className="mt-3 h-8 w-3/4 rounded-2xl bg-stone-200" />
        <div className="mt-5 h-14 rounded-[1rem] bg-stone-200" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-24 rounded-[1rem] bg-stone-100" />
        <div className="h-24 rounded-[1rem] bg-stone-100" />
      </div>
      <div className="h-40 rounded-[1rem] bg-stone-100" />
      <div className="h-40 rounded-[1rem] bg-stone-100" />
    </div>
  );
}

export function PlaceDetailSheet({
  bookmarkedPlaceIds,
  currentMapHref,
  placeId,
  previewPlace,
  onClose,
  onPlaceReactionChange,
}: PlaceDetailSheetProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [detailState, setDetailState] = useState<PlaceDetailState>({
    error: null,
    item: null,
    placeId: null,
  });
  const [reactionOverrides, setReactionOverrides] = useState<
    Record<string, PlaceReactionOverride>
  >({});
  const detailSheetGesture = useMobileSheetGesture({
    enabled: Boolean(placeId),
    onClose,
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
  const rawPlace = data?.item ?? previewPlace;
  const reactionOverride = rawPlace ? reactionOverrides[rawPlace.id] : null;
  const place = rawPlace
    ? {
        ...rawPlace,
        likeCount: reactionOverride?.likeCount ?? rawPlace.likeCount,
        dislikeCount: reactionOverride?.dislikeCount ?? rawPlace.dislikeCount,
        viewerReaction:
          reactionOverride?.viewerReaction ?? rawPlace.viewerReaction,
      }
    : null;
  const category = place ? getCategoryBySlug(place.categorySlug) : null;
  const isBookmarked = place ? bookmarkedPlaceIds.includes(place.id) : false;
  const placePath = place ? `/place/${place.id}` : null;
  const bookmarkLoginHref = createLoginHref(currentMapHref);
  const reportHref = place
    ? `/report?placeId=${place.id}&placeName=${encodeURIComponent(place.name)}`
    : null;
  const sharePayload = place
    ? createPlaceSharePayload(place, "detail_sheet")
    : null;
  const placePriceItems = place?.priceItems ?? [];
  const placeComments = place?.comments ?? [];
  const businessNameLabel =
    place?.businessName && place.businessName !== place.name
      ? place.businessName
      : null;
  const verificationLabel =
    place?.verificationStatus === "verified" ? "검증됨" : "미검증";
  const heroMeta = [
    category?.name ?? null,
    place?.district ?? null,
    verificationLabel,
  ].filter((item): item is string => Boolean(item));
  const summaryCards = place
    ? [
        { label: "최근 갱신", value: place.lastPriceUpdatedAt },
        { label: "주소", value: place.address },
      ]
    : [];

  const handleReactionUpdate = (nextState: PlaceReactionUpdate) => {
    setReactionOverrides((current) => ({
      ...current,
      [nextState.placeId]: {
        dislikeCount: nextState.dislikeCount,
        likeCount: nextState.likeCount,
        viewerReaction: nextState.viewerReaction,
      },
    }));

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
    <div className="pointer-events-none fixed inset-0 z-[90] xl:absolute xl:inset-0 xl:z-30">
      <button
        type="button"
        aria-label="상세 패널 닫기"
        onClick={onClose}
        className="pointer-events-auto absolute inset-0 bg-stone-950/30 xl:rounded-[1.125rem]"
      />

      <aside
        role="dialog"
        aria-modal="true"
        data-testid="place-detail-sheet"
        data-sheet-dragging={detailSheetGesture.isDragging ? "true" : "false"}
        data-sheet-mode="default"
        style={detailSheetGesture.style}
        className="altteulmap-mobile-sheet altteulmap-mobile-sheet-detail pointer-events-auto absolute flex w-auto flex-col overflow-hidden rounded-[1.125rem] border border-stone-200 bg-white shadow-2xl xl:inset-x-auto xl:inset-y-0 xl:right-0 xl:top-0 xl:w-full xl:max-h-none xl:max-w-[26rem] 2xl:max-w-[27rem] xl:rounded-l-[1.125rem] xl:rounded-r-none xl:border-l xl:border-r-0"
      >
        <div className="sticky top-0 z-10 border-b border-stone-200 bg-white/96 px-4 pb-2.5 pt-2 backdrop-blur sm:px-5">
          <div className="flex items-center justify-center pb-2 xl:hidden">
            <div
              role="presentation"
              data-testid="place-detail-drag-handle"
              onPointerCancel={detailSheetGesture.handlePointerCancel}
              onPointerDown={detailSheetGesture.handlePointerDown}
              onPointerMove={detailSheetGesture.handlePointerMove}
              onPointerUp={detailSheetGesture.handlePointerUp}
              className="flex w-full justify-center py-1"
              style={{ touchAction: "none" }}
            >
              <span className="h-1.5 w-12 rounded-full bg-stone-300" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="altteulmap-section-kicker text-[11px]">
                {category?.parentName ?? "장소"}
              </p>
              <h2 className="mt-1 truncate text-base font-semibold tracking-tight text-stone-900 sm:text-lg">
                {place?.name ?? "장소 정보"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              data-testid="place-detail-close"
              className="altteulmap-button inline-flex h-9 w-9 shrink-0 items-center justify-center border border-stone-300 bg-white text-base text-stone-700 transition hover:bg-white sm:h-10 sm:w-10"
            >
              <span aria-hidden="true">×</span>
              <span className="sr-only">닫기</span>
            </button>
          </div>
        </div>

        <div
          ref={scrollContainerRef}
          className="altteulmap-mobile-sheet-scroll flex-1 overflow-y-auto px-4 py-5 sm:px-5"
        >
          {isLoading && !previewPlace ? <LoadingState /> : null}

          {!isLoading && error && !place ? (
            <div className="rounded-[1rem] border border-dashed border-stone-300 bg-[var(--altteul-bg-subtle)]/65 p-6 text-sm leading-7 text-stone-600">
              <p className="font-medium text-stone-900">{error}</p>
              <p className="mt-3">
                잠시 후 다시 시도하거나 전체 상세 페이지에서 확인해보세요.
              </p>
              {placePath ? (
                <Link
                  href={placePath}
                  className="altteulmap-button mt-4 inline-flex whitespace-nowrap border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-white"
                >
                  상세 페이지로 보기
                </Link>
              ) : null}
            </div>
          ) : null}

          {place ? (
            <div className="grid gap-4">
              <section className="altteulmap-accent-panel rounded-[1rem] p-5">
                <div className="flex flex-wrap gap-2">
                  {heroMeta.map((item) => (
                    <span
                      key={item}
                      className="altteulmap-badge bg-white/80 px-2.5 py-1 text-[11px] font-medium text-[var(--altteul-accent-text)]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
                {businessNameLabel ? (
                  <p className="mt-3 text-sm text-[var(--altteul-accent-text)]">
                    사업장 이름 {businessNameLabel}
                  </p>
                ) : null}
                <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--altteul-accent-text)]">
                  대표 가격
                </p>
                <p className="altteulmap-price-number mt-2 text-[2rem]">
                  {formatKrw(place.representativePriceAmount)}원
                </p>
                <p className="mt-2 text-sm text-[var(--altteul-accent-text)]">
                  {place.representativePriceLabel}
                </p>
                {place.address ? (
                  <p className="mt-4 text-sm leading-6 text-[var(--altteul-accent-text)]">
                    {place.address}
                  </p>
                ) : null}
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
                    key={`${place.id}:${isBookmarked ? "on" : "off"}`}
                    placeId={place.id}
                    initialBookmarked={isBookmarked}
                    loginHref={bookmarkLoginHref}
                  />
                  <PlaceShareButton
                    path={sharePayload?.path ?? `/place/${place.id}`}
                    title={sharePayload?.title ?? place.name}
                    text={sharePayload?.text}
                    className="altteulmap-button inline-flex items-center gap-2 whitespace-nowrap border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-white"
                    testId="place-detail-share-button"
                    messageTestId="place-detail-share-message"
                  />
                  {reportHref ? (
                    <Link
                      href={reportHref}
                      className="altteulmap-accent-ghost altteulmap-button inline-flex whitespace-nowrap border px-4 py-2 text-sm transition"
                    >
                      신고하기
                    </Link>
                  ) : null}
                  {placePath ? (
                    <Link
                      href={placePath}
                      className="altteulmap-button inline-flex whitespace-nowrap border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-white"
                    >
                      페이지로 보기
                    </Link>
                  ) : null}
                </div>
              </section>

              {isLoading ? (
                <div className="rounded-[1rem] border border-stone-200 bg-[var(--altteul-bg-subtle)]/60 px-4 py-3 text-xs text-stone-500">
                  세부 가격과 코멘트를 불러오는 중입니다.
                </div>
              ) : null}

              {!isLoading && error ? (
                <div className="rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  세부 정보 일부를 불러오지 못했습니다. 기본 정보만 먼저 표시합니다.
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                {summaryCards.map((card) => (
                  <section
                    key={card.label}
                    className="rounded-[1rem] border border-stone-200 bg-[var(--altteul-bg-subtle)]/60 p-4"
                  >
                    <p className="text-xs font-medium text-stone-500">{card.label}</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-stone-900">
                      {card.value}
                    </p>
                  </section>
                ))}
              </div>

              {(place.description || place.note) && (
                <section className="altteulmap-panel p-5">
                  <p className="altteulmap-section-kicker text-[11px]">소개</p>
                  {place.description ? (
                    <p className="mt-3 text-sm leading-7 text-stone-700">
                      {place.description}
                    </p>
                  ) : null}
                  {place.note ? (
                    <p className="mt-3 text-sm leading-7 text-stone-600">
                      {place.note}
                    </p>
                  ) : null}
                </section>
              )}

              <section className="altteulmap-panel p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="altteulmap-section-kicker text-[11px]">가격</p>
                    <h4 className="mt-1 text-base font-semibold text-stone-900">
                      가격 항목
                    </h4>
                  </div>
                  <span className="altteulmap-badge px-3 py-1 text-xs font-medium">
                    {placePriceItems.length}개
                  </span>
                </div>
                {placePriceItems.length > 0 ? (
                  <div className="mt-4 grid gap-3">
                    {placePriceItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-[1rem] border border-stone-200 bg-[var(--altteul-bg-subtle)]/55 px-4 py-4"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-medium text-stone-900">{item.label}</p>
                            <p className="mt-1 text-xs text-stone-500">
                              마지막 제보 {item.reportedAt}
                            </p>
                          </div>
                          <div className="shrink-0 text-left sm:text-right">
                            <p className="altteulmap-price-number text-lg">
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
                suggestedItems={placePriceItems}
              />

              <PlaceCommentsSection
                key={`${place.id}-comments`}
                placeId={place.id}
                initialComments={placeComments}
              />
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
