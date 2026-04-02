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
          <p className="text-xs font-medium tracking-[0.18em] text-orange-600">
            북마크
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
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
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
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
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
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
                      상세
                    </Link>
                    <Link
                      href={`/?q=${encodeURIComponent(place.name)}&scope=global`}
                      className="altteulmap-button whitespace-nowrap border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
                    >
                      지도
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50 p-8 text-sm leading-7 text-stone-600">
            북마크한 장소가 없습니다.
          </div>
        )}
      </section>
    </main>
  );
}
