import Link from "next/link";
import { redirect } from "next/navigation";

import { BookmarkToggleButton } from "@/features/bookmarks/bookmark-toggle-button";
import { listBookmarkedPlaces } from "@/features/bookmarks/repository";
import { getCategoryBySlug } from "@/features/categories/catalog";
import { formatKrw } from "@/features/places/queries";
import { createLoginHref, getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function BookmarksPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(createLoginHref("/bookmarks"));
  }

  const bookmarkedPlaces = await listBookmarkedPlaces(user);

  return (
    <main className="bg-stone-50 px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-7xl rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div>
          <p className="text-xs font-medium text-orange-600">
            북마크
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-stone-900 sm:text-5xl">
            북마크한 장소
          </h1>
        </div>

        {bookmarkedPlaces.length > 0 ? (
          <div data-testid="bookmark-list" className="mt-8 grid gap-4">
            {bookmarkedPlaces.map((place) => {
              const category = getCategoryBySlug(place.categorySlug);

              return (
                <article
                  key={place.id}
                  data-testid={`bookmark-item-${place.id}`}
                  className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase text-orange-600">
                        북마크 {place.createdAt}
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-stone-900">
                        {place.name}
                      </h2>
                      <p className="mt-2 text-sm text-stone-500">
                        {category?.name ?? "기타"}
                      </p>
                      <p className="mt-1 text-sm text-stone-400">
                        {place.district}
                      </p>
                    </div>
                    <div className="rounded-[1.35rem] bg-white px-4 py-3 text-right">
                      <p className="text-xs uppercase text-stone-500">
                        대표 가격
                      </p>
                      <p className="mt-2 text-lg font-semibold text-stone-900">
                        {formatKrw(place.representativePriceAmount)}원
                      </p>
                      <p className="text-sm text-stone-500">
                        {place.representativePriceLabel}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <BookmarkToggleButton
                      key={`${place.id}:on`}
                      placeId={place.id}
                      initialBookmarked
                      compact
                    />
                    <Link
                      href={`/place/${place.id}`}
                      className="altteulmap-accent-solid altteulmap-button whitespace-nowrap px-4 py-2 text-sm font-medium transition"
                    >
                      가격 보기
                    </Link>
                    <Link
                      href={`/?q=${encodeURIComponent(place.name)}&scope=global`}
                      className="altteulmap-button whitespace-nowrap border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
                    >
                      지도에서 찾기
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 rounded-[1.25rem] border border-dashed border-stone-300 bg-stone-50 p-6 text-sm leading-7 text-stone-600 sm:p-8">
            <p className="text-base font-semibold text-stone-900">
              아직 저장한 장소가 없어요
            </p>
            <p className="mt-2 max-w-2xl">
              점심, 세탁, 프린트처럼 자주 확인하는 장소를 북마크하면 다음에
              가격을 더 빨리 볼 수 있습니다.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link
                href="/"
                className="altteulmap-accent-solid altteulmap-button inline-flex items-center justify-center px-5 py-3 text-sm font-medium"
              >
                가격 지도 열기
              </Link>
              <Link
                href="/submit"
                className="altteulmap-button inline-flex items-center justify-center px-5 py-3 text-sm font-medium text-stone-700"
              >
                장소 등록하기
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
