import Link from "next/link";
import { redirect } from "next/navigation";

import { BookmarkToggleButton } from "@/features/bookmarks/bookmark-toggle-button";
import { listBookmarks } from "@/features/bookmarks/repository";
import { getCategoryBySlug } from "@/features/categories/catalog";
import { formatKrw } from "@/features/places/queries";
import { listPlaces } from "@/features/places/repository";
import { createLoginHref, getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function BookmarksPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(createLoginHref("/bookmarks"));
  }

  const [bookmarkResult, placeResult] = await Promise.all([
    listBookmarks(user),
    listPlaces({ sort: "recent" }),
  ]);

  const placeById = new Map(placeResult.items.map((place) => [place.id, place]));
  const bookmarkedPlaces = bookmarkResult.items
    .map((bookmark) => ({
      bookmark,
      place: placeById.get(bookmark.placeId) ?? null,
    }))
    .filter(
      (
        entry,
      ): entry is {
        bookmark: (typeof bookmarkResult.items)[number];
        place: NonNullable<(typeof entry)["place"]>;
      } => entry.place !== null,
    );

  return (
    <main className="bg-stone-50 px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-7xl rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-600">
              Bookmarks
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
              저장한 장소 목록
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">
              현재 로그인한 계정 기준으로 저장한 장소만 모아 보여줍니다. 공개
              탐색 화면과 같은 데이터를 쓰되 북마크 목록만 사용자별로 분리했습니다.
            </p>
          </div>
          <div className="rounded-3xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
            현재 사용자: {bookmarkResult.userLabel}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              bookmarkResult.source === "database"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-orange-100 text-orange-700"
            }`}
          >
            데이터 소스: {bookmarkResult.source === "database" ? "DB" : "목업"}
          </span>
          <Link
            href="/api/bookmarks"
            className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700 transition hover:bg-stone-100"
          >
            API 보기
          </Link>
        </div>

        {bookmarkedPlaces.length > 0 ? (
          <div className="mt-8 grid gap-4">
            {bookmarkedPlaces.map(({ bookmark, place }) => {
              const category = getCategoryBySlug(place.categorySlug);

              return (
                <article
                  key={place.id}
                  className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
                        저장 {bookmark.createdAt}
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-stone-900">
                        {place.name}
                      </h2>
                      <p className="mt-2 text-sm text-stone-500">
                        {category?.name ?? "기타"} · {place.district}
                      </p>
                    </div>
                    <div className="rounded-3xl bg-white px-4 py-3 text-right">
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
                      placeId={place.id}
                      initialBookmarked
                      compact
                    />
                    <Link
                      href={`/place/${place.id}`}
                      className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
                    >
                      상세 보기
                    </Link>
                    <Link
                      href="/map"
                      className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
                    >
                      지도에서 보기
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50 p-8 text-sm leading-7 text-stone-600">
            아직 저장된 장소가 없습니다. 지도나 상세 페이지에서 북마크를 추가하면
            여기에 모입니다.
          </div>
        )}
      </section>
    </main>
  );
}
