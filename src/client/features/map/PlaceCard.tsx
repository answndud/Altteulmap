import { ViteBookmarkToggleButton } from "@/client/components/ViteBookmarkToggleButton";
import {
  formatKrw,
  getVerificationBadgeClassName,
  getVerificationLabel,
} from "@/client/features/map/map-format";
import { getCategoryBySlug } from "@/features/categories/catalog";
import { PlaceShareButton } from "@/features/places/place-share-button";
import { createPlaceSharePayload } from "@/features/places/share";
import type { PlacePreviewRecord } from "@/features/places/types";

export function PlaceCard({
  bookmarked,
  isSelected,
  loginHref,
  place,
  onBookmarkUpdate,
  onSelect,
}: {
  bookmarked: boolean;
  isSelected: boolean;
  loginHref: string;
  place: PlacePreviewRecord;
  onBookmarkUpdate: (placeId: string, bookmarked: boolean) => void;
  onSelect: (place: PlacePreviewRecord) => void;
}) {
  const category = getCategoryBySlug(place.categorySlug);
  const sharePayload = createPlaceSharePayload(place, "list");

  return (
    <article
      className={`rounded-[0.85rem] border p-4 text-left transition ${
        isSelected
          ? "border-[var(--altteul-primary-border)] bg-[var(--altteul-primary-soft)]"
          : "border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)] hover:border-[var(--altteul-primary-border)] hover:bg-[var(--altteul-surface-fill-hover)]"
      }`}
      data-testid={`place-list-item-${place.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-[var(--altteul-primary-text)]">
            대표가 · {place.representativePriceLabel || "기준 가격"}
          </p>
          <p className="altteulmap-price-number mt-1 text-[1.75rem] leading-none">
            {formatKrw(place.representativePriceAmount)}원
          </p>
        </div>
        <div className="shrink-0">
          <ViteBookmarkToggleButton
            compact
            initialBookmarked={bookmarked}
            loginHref={loginHref}
            placeId={place.id}
            onUpdate={(nextBookmarked) =>
              onBookmarkUpdate(place.id, nextBookmarked)
            }
          />
        </div>
      </div>
      <h2 className="mt-3 truncate text-base font-bold text-[var(--altteul-text-strong)]">
        {place.name}
      </h2>
      <p className="mt-1 truncate text-xs text-[var(--altteul-text-secondary)]">
        {[category?.name ?? "기타", place.district].join(" · ")}
      </p>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--altteul-text-secondary)]">
        {place.description || place.note || place.address}
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <span
            className={`${getVerificationBadgeClassName(
              place.verificationStatus,
            )} px-2.5 py-1 text-[11px] font-semibold`}
          >
            {getVerificationLabel(place.verificationStatus)}
          </span>
          <span className="altteulmap-badge altteulmap-badge-info px-2.5 py-1 text-[11px] font-medium">
            갱신 {place.lastPriceUpdatedAt}
          </span>
          <span
            className="altteulmap-badge px-2.5 py-1 text-[11px] font-medium"
            data-testid={`place-list-like-count-${place.id}`}
          >
            👍 {place.likeCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <PlaceShareButton
            path={sharePayload.path}
            title={sharePayload.title}
            text={sharePayload.text}
            className="altteulmap-button inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs font-medium"
            messageClassName="mt-1 text-right text-[11px] text-[var(--altteul-text-tertiary)]"
            testId={`place-list-item-share-button-${place.id}`}
            messageTestId={`place-list-item-share-message-${place.id}`}
          />
          <button
            type="button"
            onClick={() => onSelect(place)}
            data-testid={`place-list-item-open-${place.id}`}
            className="altteulmap-button inline-flex px-3 py-1.5 text-xs font-medium"
          >
            가격 보기
          </button>
        </div>
      </div>
    </article>
  );
}
