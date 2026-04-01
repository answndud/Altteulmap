import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BookmarkToggleButton } from "@/features/bookmarks/bookmark-toggle-button";
import { listBookmarks } from "@/features/bookmarks/repository";
import { getCategoryBySlug } from "@/features/categories/catalog";
import { PlaceCommentsSection } from "@/features/places/place-comments-section";
import { PlaceReactionButtons } from "@/features/places/place-reaction-buttons";
import { PlaceShareButton } from "@/features/places/place-share-button";
import { PlacePriceReportForm } from "@/features/places/place-price-report-form";
import { formatKrw } from "@/features/places/queries";
import { getPlaceDetail } from "@/features/places/repository";
import { createLoginHref, getSessionUser } from "@/lib/session";
import { getVisitorIdFromCookie } from "@/lib/visitor-id";

type PlacePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PlacePageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getPlaceDetail(id, null);
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
  const title = `${place.name} ${formatKrw(place.representativePriceAmount)}원`;
  const description = [
    place.address,
    category?.name,
    `${place.representativePriceLabel} ${formatKrw(place.representativePriceAmount)}원`,
  ].join(" · ");

  return {
    title,
    description,
    alternates: {
      canonical: `/place/${place.id}`,
    },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/place/${place.id}`,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function PlacePage({ params }: PlacePageProps) {
  const { id } = await params;
  const user = await getSessionUser();
  const visitorId = user ? null : await getVisitorIdFromCookie();
  const [result, bookmarkResult] = await Promise.all([
    getPlaceDetail(
      id,
      user
        ? {
            userId: user.id,
            role: user.role,
          }
        : visitorId
          ? {
              role: "guest",
              visitorId,
            }
          : null,
    ),
    listBookmarks(user),
  ]);
  const place = result.item;

  if (!place) {
    notFound();
  }

  const category = getCategoryBySlug(place.categorySlug);
  const relatedPlaces = result.related;
  const isBookmarked = bookmarkResult.items.some(
    (bookmark) => bookmark.placeId === place.id,
  );
  const bookmarkLoginHref = createLoginHref(`/place/${place.id}`);
  const reportPath = `/report?placeId=${place.id}&placeName=${encodeURIComponent(place.name)}`;
  const reportHref = user ? reportPath : createLoginHref(reportPath);

  return (
    <main className="bg-stone-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="inline-flex whitespace-nowrap rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
        >
          목록으로 돌아가기
        </Link>
        <section className="mt-6 rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">
                {category?.parentName ?? "생활비 절감"}
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
                {place.name}
              </h1>
              {place.businessName && place.businessName !== place.name ? (
                <p className="mt-3 text-sm text-stone-500">{place.businessName}</p>
              ) : null}
              <p className="mt-1 text-sm text-stone-500">
                {category?.name ?? "기타"}
              </p>
              <p className="mt-1 text-sm text-stone-500">{place.address}</p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="altteulmap-accent-panel rounded-3xl p-6">
              <p className="text-sm text-[#a06a48]">대표 가격</p>
              <p className="mt-3 text-3xl font-semibold">
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
                />
              </div>
            </div>
            <div className="rounded-3xl border border-stone-200 bg-stone-50 p-6">
              <p className="text-sm text-stone-500">최근 갱신일</p>
              <p className="mt-3 text-xl font-semibold text-stone-900">
                {place.lastPriceUpdatedAt}
              </p>
              <p className="mt-2 text-sm text-stone-500">{place.district}</p>
            </div>
            <div className="rounded-3xl border border-stone-200 bg-stone-50 p-6">
              <p className="text-sm text-stone-500">메모</p>
              <p className="mt-3 text-sm leading-6 text-stone-700">
                {place.note}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <BookmarkToggleButton
                  placeId={place.id}
                  initialBookmarked={isBookmarked}
                  loginHref={bookmarkLoginHref}
                />
                <PlaceShareButton
                  path={`/place/${place.id}`}
                  title={place.name}
                />
                <Link
                  href={reportHref}
                  className="inline-flex whitespace-nowrap rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
                >
                  신고하기
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <section>
              <h2 className="text-xl font-semibold text-stone-900">장소 소개</h2>
              <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">
                {place.description}
              </p>

              <h2 className="mt-10 text-xl font-semibold text-stone-900">
                가격 항목
              </h2>
              <div className="mt-4 grid gap-3">
                {place.priceItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4"
                  >
                    <div>
                      <p className="font-medium text-stone-900">{item.label}</p>
                      <p className="mt-1 text-sm text-stone-500">
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
                ))}
              </div>
            </section>

            <aside className="space-y-8">
              <PlacePriceReportForm
                key={`${place.id}-price-form`}
                placeId={place.id}
                authenticated={Boolean(user)}
                loginHref={bookmarkLoginHref}
                suggestedItems={place.priceItems}
              />

              <PlaceCommentsSection
                key={`${place.id}-comments`}
                placeId={place.id}
                initialComments={place.comments}
                authenticated={Boolean(user)}
                loginHref={bookmarkLoginHref}
              />

              <section className="rounded-3xl border border-stone-200 bg-stone-50 p-6">
                <h2 className="text-lg font-semibold text-stone-900">비슷한 장소</h2>
                <div className="mt-4 space-y-3">
                  {relatedPlaces.map((related) => (
                    <Link
                      key={related.id}
                      href={`/place/${related.id}`}
                      className="block rounded-2xl bg-white px-4 py-4 transition hover:border-stone-300 hover:bg-stone-100"
                    >
                      <p className="font-medium text-stone-900">{related.name}</p>
                      <p className="mt-1 text-sm text-stone-500">
                        {related.representativePriceLabel} ·{" "}
                        {formatKrw(related.representativePriceAmount)}원
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
