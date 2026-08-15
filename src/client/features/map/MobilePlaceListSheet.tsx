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
  const openSheet = () => onModeChange("peek");
  const renderMobilePortal = (content: ReactNode) => {
    if (typeof document === "undefined") {
      return content;
    }

    return createPortal(content, document.body);
  };

  if (mode === "hidden") {
    return renderMobilePortal(
      <div
        className="pointer-events-auto fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-[2147483647] flex justify-center xl:hidden"
        onClickCapture={openSheet}
        onPointerDownCapture={openSheet}
        onTouchStartCapture={openSheet}
      >
        <button
          type="button"
          data-testid="mobile-place-list-open"
          onPointerDown={openSheet}
          onMouseDown={openSheet}
          onTouchStart={openSheet}
          onClick={openSheet}
          className="altteulmap-button altteulmap-accent-solid pointer-events-auto inline-flex min-h-12 w-full max-w-[28rem] items-center justify-between gap-3 px-4 py-2.5 text-sm font-semibold shadow-[var(--altteul-shadow-overlay)]"
        >
          <span>장소 목록</span>
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs text-[var(--altteul-primary-text)]">
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
      className={`fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-[2147483647] rounded-[1rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)] p-2.5 shadow-[var(--altteul-shadow-overlay)] transition-all xl:hidden ${
        isExpanded
          ? "max-h-[86dvh]"
          : "max-h-[46dvh]"
      }`}
    >
      <button
        type="button"
        aria-label="목록 시트 크기 조절"
        data-testid="mobile-place-list-drag-handle"
        className="mx-auto flex h-11 w-20 touch-none items-center justify-center rounded-full"
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
      >
        <span className="h-1.5 w-12 rounded-full bg-[var(--altteul-bg-muted)]" />
      </button>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--altteul-surface-border)] pb-2">
        <div>
          <h2 className="text-base font-semibold text-[var(--altteul-text-strong)]">
            장소 목록
          </h2>
          <p className="mt-0.5 text-xs text-[var(--altteul-text-tertiary)]">
            가격을 누르면 장소 정보를 봅니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="altteulmap-badge px-2.5 py-1 text-xs font-medium">
            {state.status === "success" ? `${totalPlaceCount}곳` : "..."}
          </span>
          <button
            type="button"
            data-testid="mobile-place-list-toggle-size"
            onClick={() => onModeChange(isExpanded ? "peek" : "expanded")}
            className="altteulmap-button pointer-events-auto min-h-11 px-3 py-1.5 text-xs font-medium"
          >
            {isExpanded ? "줄이기" : "크게"}
          </button>
        </div>
      </div>
      <div
        data-testid="mobile-place-list"
        className={`mt-2 grid gap-1.5 overflow-auto pr-1 ${
          isExpanded
            ? "max-h-[calc(86dvh-6.75rem)]"
            : "max-h-[calc(46dvh-6.75rem)]"
        }`}
      >
        {state.status === "loading" ? (
          <div className="rounded-[0.85rem] border border-dashed border-[var(--altteul-surface-border-strong)] bg-[var(--altteul-bg-surface)] p-5 text-center text-sm text-[var(--altteul-text-tertiary)]">
            장소 목록을 불러오는 중입니다.
          </div>
        ) : null}
        {state.status === "error" && places.length === 0 ? (
          <div className="rounded-[0.85rem] border border-[var(--altteul-warning-border)] bg-[var(--altteul-warning-soft)] px-4 py-3 text-sm text-[var(--altteul-warning-text)]">
            {state.error}
          </div>
        ) : null}
        {state.status === "error" && places.length > 0 ? (
          <p className="px-1 text-xs text-[var(--altteul-text-tertiary)]">
            새 장소를 불러오지 못해 이전 목록을 표시하고 있습니다.
          </p>
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
              className="pointer-events-auto rounded-[0.75rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)] p-2 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  aria-label={`${place.name} 가격 보기`}
                  data-testid={`mobile-place-list-item-${place.id}`}
                  onClick={() => onSelectPlace(place)}
                  className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-[0.65rem] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--altteul-primary)]"
                >
                  <span className="min-w-[5.25rem]">
                    <span className="block text-[10px] font-semibold text-[var(--altteul-primary-text)]">
                      대표 가격
                    </span>
                    <span className="altteulmap-price-number mt-0.5 block text-lg">
                      {formatKrw(place.representativePriceAmount)}원
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span
                      data-testid={`mobile-place-list-item-name-${place.id}`}
                      className="block truncate text-sm font-semibold text-[var(--altteul-text-strong)]"
                    >
                      {place.name}
                    </span>
                    <span className="mt-1 block truncate text-xs text-[var(--altteul-text-secondary)]">
                      {[
                        place.representativePriceLabel || "가격 정보 없음",
                        category?.name ?? "기타",
                        place.district,
                      ].join(" · ")}
                    </span>
                  </span>
                </button>
                <div className="shrink-0">
                  <ViteBookmarkToggleButton
                    compact
                    iconOnly
                    initialBookmarked={bookmarkedPlaceIds.has(place.id)}
                    loginHref={loginHref}
                    placeId={place.id}
                    onUpdate={(nextBookmarked) =>
                      onBookmarkUpdate(place.id, nextBookmarked)
                    }
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );

  return renderMobilePortal(sheet);
}
