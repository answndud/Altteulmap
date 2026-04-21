import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BookmarkToggleButton } from "@/features/bookmarks/bookmark-toggle-button";
import { listBookmarks } from "@/features/bookmarks/repository";
import { getCategoryBySlug } from "@/features/categories/catalog";
import { RouteResetDetails } from "@/features/map/route-reset-details";
import { PlaceCommentsSection } from "@/features/places/place-comments-section";
import { PlacePriceReportForm } from "@/features/places/place-price-report-form";
import { PlaceReactionButtons } from "@/features/places/place-reaction-buttons";
import { PlaceShareButton } from "@/features/places/place-share-button";
import { formatKrw } from "@/features/places/queries";
import { getPlaceDetail } from "@/features/places/repository";
import {
  createPlaceShareDescription,
  createPlaceSharePayload,
} from "@/features/places/share";
import { createLoginHref, getSessionUser } from "@/lib/session";

type PlacePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

function normalizePlaceRouteId(id: string) {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

export async function generateMetadata({
  params,
}: PlacePageProps): Promise<Metadata> {
  const { id } = await params;
  const placeId = normalizePlaceRouteId(id);
  const result = await getPlaceDetail(placeId, null);
  const place = result.item;

  if (!place) {
    return {
      title: "장소를 찾을 수 없습니다",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const category = getCategoryBySlug(place.categorySlug);
  const sharePayload = createPlaceSharePayload(place, "detail");
  const description = createPlaceShareDescription(place, category?.name);

  return {
    title: sharePayload.title,
    description,
    alternates: {
      canonical: `/place/${place.id}`,
    },
  };
}

export default async function PlacePage({ params }: PlacePageProps) {
  const { id } = await params;
  const placeId = normalizePlaceRouteId(id);
  const user = await getSessionUser();
  const result = await getPlaceDetail(
    placeId,
    user
      ? {
          userId: user.id,
          role: user.role,
        }
      : null,
  );
  const place = result.item;

  if (!place) {
    notFound();
  }

  const bookmarkResult = await listBookmarks(user);
  const category = getCategoryBySlug(place.categorySlug);
  const isBookmarked = bookmarkResult.items.some(
    (bookmark) => bookmark.placeId === place.id,
  );
  const bookmarkLoginHref = createLoginHref(`/place/${place.id}`);
  const reportHref = `/report?placeId=${place.id}&placeName=${encodeURIComponent(place.name)}`;
  const sharePayload = createPlaceSharePayload(place, "detail");
  const verificationLabel =
    place.verificationStatus === "verified" ? "검증됨" : "미검증";
  const summaryItems = [
    category?.name ?? "기타",
    place.district,
    verificationLabel,
  ];

  return (
    <main className="bg-[var(--altteul-bg-canvas)] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="altteulmap-button inline-flex whitespace-nowrap border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-white"
          >
            지도로 돌아가기
          </Link>
        </div>

        <section className="mt-5 grid gap-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
            <section className="altteulmap-accent-panel rounded-[1rem] p-5 sm:p-6">
              <p className="altteulmap-section-kicker">
                {category?.parentName ?? "장소"}
              </p>
              <h1 className="mt-2 break-keep text-[2rem] font-semibold leading-tight text-stone-950 sm:text-[2.6rem]">
                {place.name}
              </h1>
              {place.businessName && place.businessName !== place.name ? (
                <p className="mt-3 text-sm text-[var(--altteul-accent-text)]">
                  사업장 이름 {place.businessName}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {summaryItems.map((item) => (
                  <span
                    key={item}
                    className="altteulmap-badge bg-white/80 px-2.5 py-1 text-[11px] font-medium text-[var(--altteul-accent-text)]"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <p className="mt-6 text-[11px] font-medium uppercase text-[var(--altteul-accent-text)]">
                대표 가격
              </p>
              <p className="altteulmap-price-number mt-2 text-[2.4rem] sm:text-[2.8rem]">
                {formatKrw(place.representativePriceAmount)}원
              </p>
              <p className="mt-2 text-sm text-[var(--altteul-accent-text)]">
                {place.representativePriceLabel}
              </p>
              <div className="mt-4">
                <PlaceReactionButtons
                  key={`${place.id}:${place.likeCount}:${place.dislikeCount}:${place.viewerReaction ?? "none"}`}
                  placeId={place.id}
                  initialLikeCount={place.likeCount}
                  initialDislikeCount={place.dislikeCount}
                  initialViewerReaction={place.viewerReaction}
                />
              </div>
            </section>

            <aside className="grid gap-3">
              <section className="rounded-[1rem] border border-stone-200 bg-[var(--altteul-bg-subtle)]/65 p-4">
                <p className="text-xs font-medium text-stone-500">최근 갱신</p>
                <p className="mt-2 text-base font-semibold text-stone-900">
                  {place.lastPriceUpdatedAt}
                </p>
              </section>
              <section className="rounded-[1rem] border border-stone-200 bg-[var(--altteul-bg-subtle)]/65 p-4">
                <p className="text-xs font-medium text-stone-500">주소</p>
                <p className="mt-2 text-sm leading-6 text-stone-700">
                  {place.address}
                </p>
              </section>
              {(place.description || place.note) && (
                <section className="rounded-[1rem] border border-stone-200 bg-[var(--altteul-bg-subtle)]/65 p-4">
                  <p className="text-xs font-medium text-stone-500">메모</p>
                  <p className="mt-2 text-sm leading-6 text-stone-700">
                    {place.note || place.description}
                  </p>
                </section>
              )}
              <div className="flex flex-wrap gap-2">
                <BookmarkToggleButton
                  key={`${place.id}:${isBookmarked ? "on" : "off"}`}
                  placeId={place.id}
                  initialBookmarked={isBookmarked}
                  loginHref={bookmarkLoginHref}
                />
                <PlaceShareButton
                  path={sharePayload.path}
                  title={sharePayload.title}
                  text={sharePayload.text}
                  testId="place-page-share-button"
                  messageTestId="place-page-share-message"
                />
                <Link
                  href={reportHref}
                  className="altteulmap-accent-ghost altteulmap-button inline-flex whitespace-nowrap border px-4 py-2 text-sm transition"
                >
                  신고하기
                </Link>
              </div>
            </aside>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)]">
            <section className="grid gap-5">
              {place.description ? (
                <section className="altteulmap-panel p-5">
                  <p className="altteulmap-section-kicker text-[11px]">소개</p>
                  <p className="mt-3 text-sm leading-7 text-stone-700">
                    {place.description}
                  </p>
                </section>
              ) : null}

              <section className="altteulmap-panel p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="altteulmap-section-kicker text-[11px]">가격</p>
                    <h2 className="mt-1 text-lg font-semibold text-stone-900">
                      가격 항목
                    </h2>
                  </div>
                  <span className="altteulmap-badge px-3 py-1 text-xs font-medium">
                    {place.priceItems.length}개
                  </span>
                </div>
                <div className="mt-4 divide-y divide-stone-200">
                  {place.priceItems.map((item) => (
                    <div
                      key={item.id}
                      className="py-4 first:pt-0 last:pb-0"
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
              </section>
            </section>

            <aside className="grid content-start gap-3">
              <RouteResetDetails
                className="overflow-hidden rounded-[1rem] border border-stone-200 bg-[var(--altteul-bg-surface)]"
                summaryClassName="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left [&::-webkit-details-marker]:hidden"
                summary={
                  <>
                    <div className="min-w-0">
                      <p className="altteulmap-section-kicker text-[11px]">가격 제보</p>
                      <h3 className="mt-1 text-base font-semibold text-stone-900">
                        새 가격 남기기
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-stone-500">
                        가격표가 달라졌을 때만 열어 작성합니다.
                      </p>
                    </div>
                    <span className="altteulmap-badge shrink-0 px-3 py-1 text-xs font-medium">
                      열기
                    </span>
                  </>
                }
                bodyClassName="border-t border-stone-200 p-4"
              >
                <PlacePriceReportForm
                  key={`${place.id}-price-form`}
                  placeId={place.id}
                  showHeader={false}
                  surface="plain"
                  suggestedItems={place.priceItems}
                />
              </RouteResetDetails>

              <RouteResetDetails
                className="overflow-hidden rounded-[1rem] border border-stone-200 bg-[var(--altteul-bg-surface)]"
                summaryClassName="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left [&::-webkit-details-marker]:hidden"
                summary={
                  <>
                    <div className="min-w-0">
                      <p className="altteulmap-section-kicker text-[11px]">코멘트</p>
                      <h3 className="mt-1 text-base font-semibold text-stone-900">
                        이용 메모 보기
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-stone-500">
                        현재 {place.comments.length}개가 등록돼 있습니다.
                      </p>
                    </div>
                    <span className="altteulmap-badge shrink-0 px-3 py-1 text-xs font-medium">
                      열기
                    </span>
                  </>
                }
                bodyClassName="border-t border-stone-200 p-4"
              >
                <PlaceCommentsSection
                  key={`${place.id}-comments`}
                  placeId={place.id}
                  initialComments={place.comments}
                  showHeader={false}
                  surface="plain"
                />
              </RouteResetDetails>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
