import type { Metadata } from "next";
import Link from "next/link";

import { listBookmarks } from "@/features/bookmarks/repository";
import {
  categoryGroups,
  getCategoryBySlug,
} from "@/features/categories/catalog";
import { MapExplorer } from "@/features/places/map-explorer";
import { listPlaces } from "@/features/places/repository";
import type { PlaceSearchScope, PlaceSort } from "@/features/places/types";
import { createLoginHref, getSessionUser } from "@/lib/session";

type MapPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "지도에서 알뜰 장소 찾기",
  description:
    "주변 식당, 문구점, 프린트, 생활 서비스 가격을 지도에서 비교하고 알뜰 장소를 찾아보세요.",
  alternates: {
    canonical: "/",
  },
};

const priceOptions = [
  { label: "전체 가격", value: null },
  { label: "5,000원 이하", value: 5000 },
  { label: "10,000원 이하", value: 10000 },
  { label: "20,000원 이하", value: 20000 },
];

const sortOptions = [
  { label: "가격순", value: "price" },
  { label: "최근 갱신순", value: "recent" },
  { label: "좋아요순", value: "likes" },
] as const;

function getFirstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function createHref(params: {
  category?: string | null;
  maxPrice?: number | null;
  query?: string | null;
  searchScope?: PlaceSearchScope;
  sort?: PlaceSort | null;
}) {
  const search = new URLSearchParams();
  const trimmedQuery = params.query?.trim();

  if (trimmedQuery) {
    search.set("q", trimmedQuery);
    search.set("scope", params.searchScope === "global" ? "global" : "viewport");
  }

  if (params.category) {
    search.set("category", params.category);
  }

  if (params.maxPrice) {
    search.set("maxPrice", String(params.maxPrice));
  }

  if (params.sort && params.sort !== "price") {
    search.set("sort", params.sort);
  }

  const query = search.toString();

  return query ? `/?${query}` : "/";
}

function parseSort(value: string | string[] | undefined): PlaceSort {
  const sort = getFirstValue(value);

  if (sort === "recent") {
    return "recent";
  }

  if (sort === "likes") {
    return "likes";
  }

  return "price";
}

export default async function MapPage({ searchParams }: MapPageProps) {
  const params = await searchParams;
  const activeCategory = getFirstValue(params.category) ?? null;
  const activeMaxPrice = Number(getFirstValue(params.maxPrice) ?? "") || null;
  const activeQuery = getFirstValue(params.q)?.trim() || null;
  const activeSearchScope: PlaceSearchScope =
    activeQuery && getFirstValue(params.scope) === "global"
      ? "global"
      : "viewport";
  const activeSort = parseSort(params.sort);
  const user = await getSessionUser();

  const [result, bookmarkResult] = await Promise.all([
    listPlaces({
      category: activeCategory,
      maxPrice: activeMaxPrice,
      query: activeQuery,
      sort: activeSort,
    }),
    listBookmarks(user),
  ]);
  const currentMapHref = createHref({
    category: activeCategory,
    maxPrice: activeMaxPrice,
    query: activeQuery,
    searchScope: activeSearchScope,
    sort: activeSort,
  });
  const bookmarkLoginHref = createLoginHref(currentMapHref);
  const submitHref = user ? "/submit" : createLoginHref("/submit");
  const places = result.items;
  const bookmarkedIds = new Set(
    bookmarkResult.items.map((bookmark) => bookmark.placeId),
  );
  const selectedCategory = getCategoryBySlug(activeCategory);

  return (
    <main className="bg-stone-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-600">
                알뜰맵
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
                동네에서 가격 부담 적은 곳 찾기
              </h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={submitHref}
                className="altteulmap-accent-solid whitespace-nowrap rounded-full px-5 py-3 text-sm font-medium transition"
              >
                제보하기
              </Link>
              <Link
                href={bookmarkResult.authenticated ? "/bookmarks" : bookmarkLoginHref}
                className="whitespace-nowrap rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
              >
                저장한 곳
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-4 rounded-3xl border border-stone-200 bg-stone-50 p-5">
            <section>
              <p className="text-sm font-medium text-stone-700">카테고리</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={createHref({
                    category: null,
                    maxPrice: activeMaxPrice,
                    query: activeQuery,
                    searchScope: activeSearchScope,
                    sort: activeSort,
                  })}
                  className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm transition ${
                    !activeCategory
                      ? "altteulmap-accent-chip"
                      : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  전체
                </Link>
                {categoryGroups.flatMap((group) =>
                  group.children.map((category) => {
                    const isActive = activeCategory === category.slug;

                    return (
                      <Link
                        key={category.slug}
                        href={createHref({
                          category: category.slug,
                          maxPrice: activeMaxPrice,
                          query: activeQuery,
                          searchScope: activeSearchScope,
                          sort: activeSort,
                        })}
                        className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm transition ${
                          isActive
                            ? "altteulmap-accent-chip"
                            : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                        }`}
                      >
                        {category.name}
                      </Link>
                    );
                  }),
                )}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-stone-700">가격 필터</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {priceOptions.map((option) => {
                    const isActive = activeMaxPrice === option.value;

                    return (
                      <Link
                        key={option.label}
                        href={createHref({
                          category: activeCategory,
                          maxPrice: option.value,
                          query: activeQuery,
                          searchScope: activeSearchScope,
                          sort: activeSort,
                        })}
                        className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm transition ${
                          isActive
                            ? "altteulmap-accent-chip"
                            : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                        }`}
                      >
                        {option.label}
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-stone-700">정렬</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sortOptions.map((option) => {
                    const isActive = activeSort === option.value;

                    return (
                      <Link
                        key={option.value}
                        href={createHref({
                          category: activeCategory,
                          maxPrice: activeMaxPrice,
                          query: activeQuery,
                          searchScope: activeSearchScope,
                          sort: option.value,
                        })}
                        data-testid={`sort-option-${option.value}`}
                        className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm transition ${
                          isActive
                            ? "altteulmap-accent-chip"
                            : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                        }`}
                      >
                        {option.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-stone-700">검색</p>
                {activeQuery ? (
                  <Link
                    href={createHref({
                      category: activeCategory,
                      maxPrice: activeMaxPrice,
                      sort: activeSort,
                    })}
                    className="whitespace-nowrap rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
                  >
                    검색 지우기
                  </Link>
                ) : null}
              </div>

              <form action="/" className="mt-4 grid gap-3" data-testid="place-search-form">
                <div className="flex flex-col gap-3 lg:flex-row">
                  <input
                    type="search"
                    name="q"
                    defaultValue={activeQuery ?? ""}
                    placeholder="예: 김밥, 세탁소, 성북구, 프린트"
                    data-testid="place-search-input"
                    className="h-12 flex-1 rounded-2xl border border-stone-300 bg-white px-4 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  />
                  <button
                    type="submit"
                    data-testid="place-search-submit"
                    className="altteulmap-accent-solid inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-medium transition"
                  >
                    검색
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      value="viewport"
                      data-testid="search-scope-viewport"
                      defaultChecked={activeSearchScope === "viewport"}
                      className="peer sr-only"
                    />
                    <span className="inline-flex whitespace-nowrap rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition peer-checked:border-[#e4c2a8] peer-checked:bg-[#f4e1d2] peer-checked:text-[#8f522f]">
                      현재 지도에서 찾기
                    </span>
                  </label>
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      value="global"
                      data-testid="search-scope-global"
                      defaultChecked={activeSearchScope === "global"}
                      className="peer sr-only"
                    />
                    <span className="inline-flex whitespace-nowrap rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition peer-checked:border-[#e4c2a8] peer-checked:bg-[#f4e1d2] peer-checked:text-[#8f522f]">
                      전체에서 찾기
                    </span>
                  </label>
                </div>

                {activeCategory ? (
                  <input type="hidden" name="category" value={activeCategory} />
                ) : null}
                {activeMaxPrice ? (
                  <input type="hidden" name="maxPrice" value={activeMaxPrice} />
                ) : null}
                {activeSort !== "price" ? (
                  <input type="hidden" name="sort" value={activeSort} />
                ) : null}
              </form>
            </section>
          </div>

          <MapExplorer
            key={`${activeCategory ?? "all"}:${activeMaxPrice ?? "all"}:${activeSort}:${activeQuery ?? "all"}:${activeSearchScope}`}
            authenticated={bookmarkResult.authenticated}
            bookmarkedPlaceIds={Array.from(bookmarkedIds)}
            bookmarkLoginHref={bookmarkLoginHref}
            category={activeCategory}
            currentMapHref={currentMapHref}
            initialBounds={result.bounds}
            maxPrice={activeMaxPrice}
            places={places}
            query={activeQuery}
            searchScope={activeSearchScope}
            selectedCategoryLabel={selectedCategory?.name ?? null}
            sort={activeSort}
          />
        </section>
      </div>
    </main>
  );
}
