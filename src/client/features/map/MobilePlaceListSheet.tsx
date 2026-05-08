import type { ReactNode } from "react";
import { useState } from "react";
import { createPortal } from "react-dom";

import { ViteBookmarkToggleButton } from "@/client/components/ViteBookmarkToggleButton";
import { getCategoryBySlug } from "@/features/categories/catalog";
import type { PlacePreviewRecord } from "@/features/places/types";

import { formatKrw } from "./map-format";

export type MobileSheetMode = "hidden" | "peek" | "expanded";

type MobilePlaceListState =
  | { status: "loading"; error: null }
  | { status: "success"; error: null }
  | { status: "error"; error: string };

export function MobilePlaceListSheet({
  bookmarkedPlaceIds,
  loginHref,
  mode,
  onBookmarkUpdate,
  onModeChange,
  onSelectPlace,
  places,
  state,
  totalPlaceCount,
}: {
  bookmarkedPlaceIds: Set<string>;
  loginHref: string;
  mode: MobileSheetMode;
  onBookmarkUpdate: (placeId: string, bookmarked: boolean) => void;
  onModeChange: (mode: MobileSheetMode) => void;
  onSelectPlace: (place: PlacePreviewRecord) => void;
  places: PlacePreviewRecord[];
  state: MobilePlaceListState;
  totalPlaceCount: number;
}) {
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const renderMobilePortal = (content: ReactNode) => {
    if (typeof document === "undefined") {
      return content;
    }

    return createPortal(content, document.body);
  };

  if (mode === "hidden") {
    return renderMobilePortal(
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[2147483647] flex justify-center px-4 xl:hidden">
        <button
          type="button"
          data-testid="mobile-place-list-open"
          onClick={() => onModeChange("peek")}
          className="altteulmap-button altteulmap-accent-solid pointer-events-auto inline-flex min-h-11 items-center justify-center gap-2 px-5 py-3 text-sm font-semibold shadow-[var(--altteul-shadow-overlay)]"
        >
          목록 열기
          <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs text-[var(--altteul-primary-text)]">
            {state.status === "success" ? `${totalPlaceCount}곳` : "..."}
          </span>
        </button>
      </div>,
    );
  }

  const isExpanded = mode === "expanded";

  const sheet = (
    <section
      data-testid="mobile-place-list-sheet"
      data-sheet-mode={mode}
      className={`fixed inset-x-3 bottom-3 z-[2147483647] rounded-[1rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)] p-3 shadow-[var(--altteul-shadow-overlay)] transition-all xl:hidden ${
        isExpanded ? "max-h-[88dvh]" : "max-h-[58dvh]"
      }`}
    >
      <button
        type="button"
        aria-label="목록 시트 크기 조절"
        data-testid="mobile-place-list-drag-handle"
        className="mx-auto mb-3 block h-2 w-14 rounded-full bg-[var(--altteul-bg-muted)]"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragStartY(event.clientY);
        }}
        onPointerUp={(event) => {
          if (dragStartY !== null) {
            const deltaY = event.clientY - dragStartY;
            if (deltaY > 120) {
              onModeChange(mode === "expanded" ? "peek" : "hidden");
            } else if (deltaY < -80) {
              onModeChange("expanded");
            }
          }
          setDragStartY(null);
        }}
        onPointerCancel={() => setDragStartY(null)}
      />
      <div className="flex items-center justify-between gap-3 border-b border-[var(--altteul-surface-border)] pb-3">
        <div>
          <p className="altteulmap-section-kicker text-[11px]">목록</p>
          <h2 className="mt-1 text-base font-semibold text-[var(--altteul-text-strong)]">
            지도 결과
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="altteulmap-badge px-3 py-1 text-xs font-medium">
            {state.status === "success" ? `${totalPlaceCount}곳` : "..."}
          </span>
          <button
            type="button"
            data-testid="mobile-place-list-toggle-size"
            onClick={() => onModeChange(isExpanded ? "peek" : "expanded")}
            className="altteulmap-button pointer-events-auto min-h-9 px-3 py-1.5 text-xs font-medium"
          >
            {isExpanded ? "줄이기" : "크게"}
          </button>
        </div>
      </div>
      <div
        data-testid="mobile-place-list"
        className={`mt-3 grid gap-2 overflow-auto pr-1 ${
          isExpanded
            ? "max-h-[calc(88dvh-7.5rem)]"
            : "max-h-[calc(58dvh-7.5rem)]"
        }`}
      >
        {state.status === "loading" ? (
          <div className="rounded-[0.85rem] border border-dashed border-[var(--altteul-surface-border-strong)] bg-[var(--altteul-bg-surface)] p-5 text-center text-sm text-[var(--altteul-text-tertiary)]">
            지도 결과를 불러오는 중입니다.
          </div>
        ) : null}
        {state.status === "error" ? (
          <div className="rounded-[0.85rem] border border-[var(--altteul-warning-border)] bg-[var(--altteul-warning-soft)] px-4 py-3 text-sm text-[var(--altteul-warning-text)]">
            {state.error}
          </div>
        ) : null}
        {state.status === "success" && places.length === 0 ? (
          <div className="rounded-[0.85rem] border border-dashed border-[var(--altteul-surface-border-strong)] bg-[var(--altteul-bg-surface)] p-5 text-center text-sm text-[var(--altteul-text-tertiary)]">
            조건에 맞는 장소가 없습니다.
          </div>
        ) : null}
        {places.map((place) => {
          const category = getCategoryBySlug(place.categorySlug);

          return (
            <article
              key={place.id}
              role="button"
              tabIndex={0}
              data-testid={`mobile-place-list-item-${place.id}`}
              onClick={() => onSelectPlace(place)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectPlace(place);
                }
              }}
              className="pointer-events-auto rounded-[0.85rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)] p-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--altteul-primary)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[var(--altteul-primary-text)]">
                    대표가 · {place.representativePriceLabel || "기준 가격"}
                  </p>
                  <p className="altteulmap-price-number mt-1 text-xl">
                    {formatKrw(place.representativePriceAmount)}원
                  </p>
                </div>
                <div
                  className="shrink-0"
                  onClick={(event) => event.stopPropagation()}
                >
                  <ViteBookmarkToggleButton
                    compact
                    initialBookmarked={bookmarkedPlaceIds.has(place.id)}
                    loginHref={loginHref}
                    placeId={place.id}
                    onUpdate={(nextBookmarked) =>
                      onBookmarkUpdate(place.id, nextBookmarked)
                    }
                  />
                </div>
              </div>
              <h3 className="mt-2 truncate text-base font-semibold text-[var(--altteul-text-strong)]">
                {place.name}
              </h3>
              <p className="mt-1 truncate text-xs text-[var(--altteul-text-secondary)]">
                {[category?.name ?? "기타", place.district].join(" · ")}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );

  return renderMobilePortal(sheet);
}
