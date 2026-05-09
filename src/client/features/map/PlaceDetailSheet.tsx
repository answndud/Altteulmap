import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ViteBookmarkToggleButton } from "@/client/components/ViteBookmarkToggleButton";
import { VitePlaceReactionButtons } from "@/client/components/VitePlaceReactionButtons";
import { getCategoryBySlug } from "@/features/categories/catalog";
import { PlaceShareButton } from "@/features/places/place-share-button";
import { createPlaceSharePayload } from "@/features/places/share";
import type { PlacePreviewRecord, PlaceRecord } from "@/features/places/types";

import { formatKrw } from "./map-format";

export type PlaceReactionUpdate = {
  dislikeCount: number;
  likeCount: number;
  placeId: string;
  viewerReaction: PlacePreviewRecord["viewerReaction"];
};

type PlaceDetailResponse = {
  item: PlaceRecord;
  source: "database" | "mock";
  mock: boolean;
};

type PlaceDetailLoadState =
  | { status: "idle"; data: null; error: null }
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: PlaceRecord; error: null }
  | { status: "error"; data: null; error: string };

export function PlaceDetailSheet({
  bookmarked,
  closeTestId = "place-detail-close",
  loginHref,
  place,
  testId = "place-detail-sheet",
  onBookmarkUpdate,
  onClose,
  onReactionUpdate,
}: {
  bookmarked: boolean;
  closeTestId?: string;
  loginHref: string;
  place: PlacePreviewRecord;
  testId?: string;
  onBookmarkUpdate: (placeId: string, bookmarked: boolean) => void;
  onClose: () => void;
  onReactionUpdate: (update: PlaceReactionUpdate) => void;
}) {
  const category = getCategoryBySlug(place.categorySlug);
  const sharePayload = createPlaceSharePayload(place, "detail_sheet");
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [detailState, setDetailState] = useState<PlaceDetailLoadState>({
    status: "idle",
    data: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    setDetailState({ status: "loading", data: null, error: null });

    fetch(`/api/places/${encodeURIComponent(place.id)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("상세 정보를 불러오지 못했습니다.");
        }

        return (await response.json()) as PlaceDetailResponse;
      })
      .then((payload) => {
        setDetailState({ status: "success", data: payload.item, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setDetailState({
          status: "error",
          data: null,
          error:
            error instanceof Error
              ? error.message
              : "상세 정보를 불러오지 못했습니다.",
        });
      });

    return () => {
      controller.abort();
    };
  }, [place.id]);

  const detailPlace = detailState.status === "success" ? detailState.data : null;

  return (
    <aside
      data-testid={testId}
      className="altteulmap-panel fixed inset-x-3 bottom-3 z-30 max-h-[82dvh] overflow-auto p-4 shadow-[var(--altteul-shadow-overlay)] xl:static xl:max-h-none xl:shadow-none"
    >
      <button
        type="button"
        aria-label="상세 시트 닫기"
        data-testid="place-detail-drag-handle"
        className="mx-auto mb-3 block h-2 w-14 rounded-full bg-[var(--altteul-bg-muted)] xl:hidden"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragStartY(event.clientY);
        }}
        onPointerMove={(event) => {
          if (dragStartY !== null && event.clientY - dragStartY > 120) {
            setDragStartY(null);
            onClose();
          }
        }}
        onPointerUp={(event) => {
          if (dragStartY !== null && event.clientY - dragStartY > 80) {
            onClose();
          }
          setDragStartY(null);
        }}
        onPointerCancel={() => setDragStartY(null)}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="altteulmap-section-kicker">선택한 장소</p>
          <h2 className="mt-1 text-xl font-bold text-[var(--altteul-text-strong)]">
            {place.name}
          </h2>
          <p className="mt-1 text-sm text-[var(--altteul-text-secondary)]">
            {[category?.name ?? "기타", place.district].join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          data-testid={closeTestId}
          aria-label="상세 닫기"
          className="altteulmap-button flex h-9 w-9 shrink-0 items-center justify-center px-0 text-lg font-semibold leading-none"
        >
          ×
        </button>
      </div>

      <div className="mt-4 rounded-[0.85rem] border border-[var(--altteul-primary-border)] bg-[var(--altteul-primary-soft)] px-4 py-3">
        <p className="text-[11px] font-semibold text-[var(--altteul-primary-text)]">
          대표가 · {place.representativePriceLabel || "기준 가격"}
        </p>
        <p className="altteulmap-price-number mt-1 text-3xl">
          {formatKrw(place.representativePriceAmount)}원
        </p>
        <p className="mt-2 text-xs text-[var(--altteul-primary-text)]">
          {place.verificationStatus === "verified"
            ? "검증된 가격"
            : "검증 대기 가격"}{" "}
          · 갱신 {place.lastPriceUpdatedAt}
        </p>
      </div>

      <p className="mt-4 text-sm leading-6 text-[var(--altteul-text-secondary)]">
        {place.description || place.note || place.address}
      </p>
      <p className="mt-2 text-xs leading-5 text-[var(--altteul-text-tertiary)]">
        {place.address}
      </p>

      <div className="mt-4 grid gap-3" data-testid="place-detail-inline-details">
        {detailState.status === "loading" ? (
          <div className="rounded-[0.85rem] border border-dashed border-[var(--altteul-surface-border-strong)] bg-[var(--altteul-bg-subtle)] px-4 py-3 text-sm text-[var(--altteul-text-tertiary)]">
            상세 정보를 불러오는 중입니다.
          </div>
        ) : null}

        {detailState.status === "error" ? (
          <div className="rounded-[0.85rem] border border-[var(--altteul-warning-border)] bg-[var(--altteul-warning-soft)] px-4 py-3 text-sm text-[var(--altteul-warning-text)]">
            {detailState.error}
          </div>
        ) : null}

        {detailPlace ? (
          <>
            <section className="rounded-[0.85rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-subtle)] p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="altteulmap-section-kicker text-[11px]">가격</p>
                  <h3 className="mt-1 text-sm font-semibold text-[var(--altteul-text-strong)]">
                    가격 항목
                  </h3>
                </div>
                <span className="altteulmap-badge px-2.5 py-1 text-[11px] font-medium">
                  {detailPlace.priceItems.length}개
                </span>
              </div>
              <div className="mt-3 divide-y divide-[var(--altteul-surface-border)]">
                {detailPlace.priceItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--altteul-text-strong)]">
                        {item.label}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--altteul-text-tertiary)]">
                        마지막 제보 {item.reportedAt}
                      </p>
                    </div>
                    <p className="altteulmap-price-number shrink-0 text-base">
                      {formatKrw(item.amount)}원
                      {item.unitLabel ? ` / ${item.unitLabel}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {detailPlace.history.length > 0 ? (
              <section className="rounded-[0.85rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-subtle)] p-3.5">
                <p className="altteulmap-section-kicker text-[11px]">이력</p>
                <h3 className="mt-1 text-sm font-semibold text-[var(--altteul-text-strong)]">
                  최근 가격 이력
                </h3>
                <div className="mt-3 grid gap-2">
                  {detailPlace.history.slice(0, 4).map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 truncate text-[var(--altteul-text-secondary)]">
                        {entry.label}
                      </span>
                      <span className="shrink-0 font-semibold text-[var(--altteul-text-strong)]">
                        {formatKrw(entry.amount)}원 · {entry.recordedAt}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {detailPlace.comments.length > 0 ? (
              <section className="rounded-[0.85rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-subtle)] p-3.5">
                <p className="altteulmap-section-kicker text-[11px]">코멘트</p>
                <h3 className="mt-1 text-sm font-semibold text-[var(--altteul-text-strong)]">
                  이용 메모
                </h3>
                <div className="mt-3 grid gap-2">
                  {detailPlace.comments.slice(0, 3).map((comment) => (
                    <div
                      key={comment.id}
                      className="rounded-[0.7rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)] px-3 py-2"
                    >
                      <p className="text-xs font-medium text-[var(--altteul-text-primary)]">
                        {comment.authorLabel} · {comment.createdAt}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--altteul-text-secondary)]">
                        {comment.body}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-start gap-2">
        <VitePlaceReactionButtons
          placeId={place.id}
          initialDislikeCount={place.dislikeCount}
          initialLikeCount={place.likeCount}
          initialViewerReaction={place.viewerReaction}
          onUpdate={onReactionUpdate}
        />
        <ViteBookmarkToggleButton
          initialBookmarked={bookmarked}
          loginHref={loginHref}
          placeId={place.id}
          onUpdate={(nextBookmarked) =>
            onBookmarkUpdate(place.id, nextBookmarked)
          }
        />
        <PlaceShareButton
          path={sharePayload.path}
          title={sharePayload.title}
          text={sharePayload.text}
          testId="place-detail-share-button"
          messageTestId="place-detail-share-message"
        />
      </div>

      <div className="mt-4 grid gap-2">
        <Link
          to={`/report?placeId=${encodeURIComponent(
            place.id,
          )}&placeName=${encodeURIComponent(place.name)}`}
          className="altteulmap-button inline-flex items-center justify-center px-4 py-2 text-sm font-medium"
        >
          신고/수정 요청
        </Link>
      </div>
    </aside>
  );
}
