import { getCategoryBySlug } from "@/features/categories/catalog";
import { PlaceShareButton } from "@/features/places/place-share-button";
import { createPlaceSharePayload } from "@/features/places/share";
import type { PlacePreviewRecord } from "@/features/places/types";

import {
  formatKrw,
  getVerificationBadgeClassName,
  getVerificationLabel,
} from "./map-format";

function getTrendingReason(place: PlacePreviewRecord) {
  if (place.likeCount > 0) {
    return `좋아요 ${place.likeCount}`;
  }

  return `최근 갱신 ${place.lastPriceUpdatedAt}`;
}

export function TrendingPlacesSection({
  items,
  onSelectPlace,
  selectedCategoryLabel,
}: {
  items: PlacePreviewRecord[];
  onSelectPlace: (place: PlacePreviewRecord) => void;
  selectedCategoryLabel: string | null;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section
      className="border-t border-[var(--altteul-surface-border)] pt-4 sm:pt-5"
      data-testid="trending-places-section"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="altteulmap-section-kicker">빠른 비교</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--altteul-text-strong)] sm:text-xl">
            {selectedCategoryLabel
              ? `${selectedCategoryLabel} 빠른 비교`
              : "가격 비교가 쉬운 장소"}
          </h2>
          <p className="mt-1 text-sm text-[var(--altteul-text-tertiary)]">
            현재 결과에서 좋아요와 최근 갱신이 살아 있는 장소를 먼저 보여줍니다.
          </p>
        </div>
        <span className="altteulmap-badge whitespace-nowrap px-3 py-1.5 text-xs font-medium">
          상위 {items.length}곳
        </span>
      </div>

      <div className="altteulmap-scroll-row mt-4 lg:grid lg:grid-cols-3 lg:gap-3 lg:overflow-visible">
        {items.map((place, index) => {
          const category = getCategoryBySlug(place.categorySlug);
          const sharePayload = createPlaceSharePayload(place, "trending");

          return (
            <article
              key={place.id}
              data-testid={`trending-place-card-${place.id}`}
              className="min-w-[16rem] rounded-[0.85rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)] p-3.5 lg:min-w-0"
            >
              <button
                type="button"
                onClick={() => onSelectPlace(place)}
                aria-label={`${place.name} 가격 보기`}
                data-testid={`trending-place-primary-link-${place.id}`}
                className="block w-full rounded-[0.75rem] text-left transition hover:bg-[var(--altteul-surface-fill-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--altteul-primary)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-[var(--altteul-primary-text)]">
                      대표 가격 · {place.representativePriceLabel}
                    </p>
                    <p className="altteulmap-price-number mt-1 text-2xl">
                      {formatKrw(place.representativePriceAmount)}원
                    </p>
                  </div>
                  <span className="altteulmap-badge altteulmap-badge-info shrink-0 whitespace-nowrap px-2.5 py-1 text-[11px] font-medium">
                    #{index + 1}
                  </span>
                </div>

                <div className="mt-2.5 min-w-0">
                  <h3 className="line-clamp-2 text-[0.98rem] font-semibold text-[var(--altteul-text-strong)]">
                    {place.name}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--altteul-text-tertiary)]">
                    {category?.name ?? "기타"} · {place.district}
                  </p>
                </div>

                <div className="mt-3 grid gap-2">
                  <span
                    className={`${getVerificationBadgeClassName(
                      place.verificationStatus,
                    )} px-2.5 py-1 text-[11px] font-semibold`}
                  >
                    {getVerificationLabel(place.verificationStatus)}
                  </span>
                  <span className="altteulmap-badge px-2.5 py-1 text-[11px] font-medium">
                    {getTrendingReason(place)}
                  </span>
                </div>
              </button>
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectPlace(place)}
                  data-testid={`trending-place-detail-link-${place.id}`}
                  className="text-xs font-semibold text-[var(--altteul-primary-text)]"
                >
                  상세 보기
                </button>
                <PlaceShareButton
                  path={sharePayload.path}
                  title={sharePayload.title}
                  text={sharePayload.text}
                  className="altteulmap-button inline-flex items-center gap-2 whitespace-nowrap px-3 py-1.5 text-xs font-medium transition"
                  messageClassName="mt-1 text-right text-[11px] text-[var(--altteul-text-tertiary)]"
                  testId={`trending-place-share-button-${place.id}`}
                  messageTestId={`trending-place-share-message-${place.id}`}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
