import Link from "next/link";

import { getCategoryBySlug } from "@/features/categories/catalog";
import { formatKrw } from "@/features/places/queries";
import { PlaceShareButton } from "@/features/places/place-share-button";
import { createPlaceSharePayload } from "@/features/places/share";
import type { PlacePreviewRecord } from "@/features/places/types";

type TrendingPlacesSectionProps = {
  items: PlacePreviewRecord[];
  selectedCategoryLabel?: string | null;
};

function getTrendingReason(place: PlacePreviewRecord) {
  if (place.likeCount > 0) {
    return `좋아요 ${place.likeCount}`;
  }

  return `최근 갱신 ${place.lastPriceUpdatedAt}`;
}

export function TrendingPlacesSection({
  items,
  selectedCategoryLabel,
}: TrendingPlacesSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section
      className="mt-6 border-t border-stone-200 pt-6"
      data-testid="trending-places-section"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">
            추천
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-stone-900 sm:text-xl">
            {selectedCategoryLabel
              ? `${selectedCategoryLabel} 인기 장소`
              : "인기 장소"}
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            좋아요와 최근 갱신 순서를 함께 반영했습니다.
          </p>
        </div>
        <span className="altteulmap-badge whitespace-nowrap px-3 py-1.5 text-xs text-stone-600">
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
              className="min-w-[16rem] rounded-[1.5rem] border border-stone-200 bg-white p-4 lg:min-w-0"
            >
              <Link
                href={`/place/${place.id}`}
                prefetch={false}
                className="block rounded-[1.2rem] transition hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="altteulmap-badge inline-flex whitespace-nowrap px-2.5 py-1 text-[11px] font-semibold text-stone-700">
                      #{index + 1}
                    </span>
                    <h3 className="mt-3 line-clamp-2 text-base font-semibold text-stone-900">
                      {place.name}
                    </h3>
                    <p className="mt-1 text-sm text-stone-500">
                      {category?.name ?? "기타"} · {place.district}
                    </p>
                  </div>
                  <span className="altteulmap-badge shrink-0 whitespace-nowrap px-2.5 py-1 text-[11px] text-stone-600">
                    {getTrendingReason(place)}
                  </span>
                </div>

                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs text-stone-500">
                      {place.representativePriceLabel}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-stone-900">
                      {formatKrw(place.representativePriceAmount)}원
                    </p>
                  </div>
                  <span className="text-xs font-medium text-[#a06a48]">
                    상세 보기
                  </span>
                </div>
              </Link>
              <div className="mt-3 flex justify-end">
                <PlaceShareButton
                  path={sharePayload.path}
                  title={sharePayload.title}
                  text={sharePayload.text}
                  className="altteulmap-button inline-flex whitespace-nowrap border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700 transition hover:bg-stone-100"
                  messageClassName="mt-1 text-right text-[11px] text-stone-500"
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
