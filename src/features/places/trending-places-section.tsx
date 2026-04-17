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
      className="altteulmap-panel p-4 sm:p-5"
      data-testid="trending-places-section"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="altteulmap-section-kicker">빠른 비교</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-stone-900 sm:text-xl">
            {selectedCategoryLabel
              ? `${selectedCategoryLabel} 인기 장소`
              : "인기 장소"}
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            가격과 최근 반응을 기준으로 바로 비교할 수 있는 카드입니다.
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
          const verificationLabel =
            place.verificationStatus === "verified" ? "검증됨" : "미검증";

          return (
            <article
              key={place.id}
              data-testid={`trending-place-card-${place.id}`}
              className="min-w-[16rem] rounded-[1rem] border border-stone-200 bg-white p-3.5 lg:min-w-0"
            >
              <Link
                href={`/place/${place.id}`}
                prefetch={false}
                className="block rounded-[0.9rem] transition hover:bg-[var(--altteul-surface-fill-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
                      {place.representativePriceLabel}
                    </p>
                    <p className="altteulmap-price-number mt-1 text-[1.55rem]">
                      {formatKrw(place.representativePriceAmount)}원
                    </p>
                  </div>
                  <span className="altteulmap-badge shrink-0 whitespace-nowrap px-2.5 py-1 text-[11px] font-medium">
                    #{index + 1}
                  </span>
                </div>

                <div className="mt-2.5 min-w-0">
                  <h3 className="line-clamp-2 text-[0.98rem] font-semibold text-stone-900">
                    {place.name}
                  </h3>
                  <p className="mt-1 text-xs text-stone-500">
                    {category?.name ?? "기타"} · {place.district}
                  </p>
                </div>

                <div className="mt-3 grid gap-2">
                  <span className="altteulmap-badge px-2.5 py-1 text-[11px] font-medium">
                    {verificationLabel}
                  </span>
                  <span className="altteulmap-badge px-2.5 py-1 text-[11px] font-medium">
                    {getTrendingReason(place)}
                  </span>
                </div>
              </Link>
              <div className="mt-3 flex items-center justify-between gap-2">
                <Link
                  href={`/place/${place.id}`}
                  prefetch={false}
                  className="text-xs font-medium text-[var(--altteul-accent-text)]"
                >
                  상세 보기
                </Link>
                <PlaceShareButton
                  path={sharePayload.path}
                  title={sharePayload.title}
                  text={sharePayload.text}
                  className="altteulmap-button inline-flex items-center gap-2 whitespace-nowrap border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-white"
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
