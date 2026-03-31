import Link from "next/link";

import { listBookmarks } from "@/features/bookmarks/repository";
import {
  categoryGroups,
  getCategoryBySlug,
} from "@/features/categories/catalog";
import { MapExplorer } from "@/features/places/map-explorer";
import { listPlaces } from "@/features/places/repository";
import type { PlaceSearchScope } from "@/features/places/types";
import { createLoginHref, getSessionUser } from "@/lib/session";

type MapPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
] as const;

function getFirstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function createHref(params: {
  category?: string | null;
  maxPrice?: number | null;
  query?: string | null;
  searchScope?: PlaceSearchScope;
  sort?: string | null;
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

  return query ? `/map?${query}` : "/map";
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
  const activeSort =
    getFirstValue(params.sort) === "recent" ? "recent" : "price";
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
                Altteulmap
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
                동네 절약 장소를 지도로 바로 찾기
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">
                주변 식당, 문구점, 프린트, 생활 서비스 가격을 한 화면에서 비교하고
                필요한 장소는 바로 저장해두세요. 알고 있는 알뜰 장소가 있으면 직접
                등록도 할 수 있습니다.
              </p>
              {!bookmarkResult.authenticated ? (
                <p className="mt-3 text-sm text-stone-500">
                  북마크와 장소 등록은 로그인 후 사용할 수 있습니다.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={submitHref}
                className="rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-700"
              >
                장소 등록
              </Link>
              <Link
                href={bookmarkResult.authenticated ? "/bookmarks" : bookmarkLoginHref}
                className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
              >
                북마크 보기
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
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    !activeCategory
                      ? "bg-stone-900 text-white"
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
                        className={`rounded-full px-4 py-2 text-sm transition ${
                          isActive
                            ? "bg-stone-900 text-white"
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
                        className={`rounded-full px-4 py-2 text-sm transition ${
                          isActive
                            ? "bg-orange-600 text-white"
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
                        className={`rounded-full px-4 py-2 text-sm transition ${
                          isActive
                            ? "bg-stone-900 text-white"
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
                <div>
                  <p className="text-sm font-medium text-stone-700">검색</p>
                  <p className="mt-1 text-xs text-stone-500">
                    장소명, 주소, 메뉴명, 구 단위 지역명으로 찾을 수 있습니다.
                  </p>
                </div>
                {activeQuery ? (
                  <Link
                    href={createHref({
                      category: activeCategory,
                      maxPrice: activeMaxPrice,
                      sort: activeSort,
                    })}
                    className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
                  >
                    검색 지우기
                  </Link>
                ) : null}
              </div>

              <form action="/map" className="mt-4 grid gap-3">
                <div className="flex flex-col gap-3 lg:flex-row">
                  <input
                    type="search"
                    name="q"
                    defaultValue={activeQuery ?? ""}
                    placeholder="예: 김밥, 세탁소, 성북구, 프린트"
                    className="h-12 flex-1 rounded-2xl border border-stone-300 bg-white px-4 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-12 items-center justify-center rounded-2xl bg-stone-900 px-5 text-sm font-medium text-white transition hover:bg-stone-700"
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
                      defaultChecked={activeSearchScope === "viewport"}
                      className="peer sr-only"
                    />
                    <span className="inline-flex rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition peer-checked:border-stone-900 peer-checked:bg-stone-900 peer-checked:text-white">
                      현재 지도에서 찾기
                    </span>
                  </label>
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      value="global"
                      defaultChecked={activeSearchScope === "global"}
                      className="peer sr-only"
                    />
                    <span className="inline-flex rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition peer-checked:border-orange-600 peer-checked:bg-orange-600 peer-checked:text-white">
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
            maxPrice={activeMaxPrice}
            places={places}
            query={activeQuery}
            searchScope={activeSearchScope}
            selectedCategoryLabel={selectedCategory?.name ?? null}
            sort={activeSort}
            source={result.source}
          />
        </section>
      </div>
    </main>
  );
}
