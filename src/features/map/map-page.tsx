import type { Metadata } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { listBookmarks } from "@/features/bookmarks/repository";
import { SessionActionGroup } from "@/features/auth/session-action-group";
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

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
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

const mobileFilterChipClass =
  "altteulmap-chip whitespace-nowrap border px-3 py-2 text-xs transition";
const desktopFilterChipClass =
  "altteulmap-chip whitespace-nowrap border px-4 py-2 text-sm transition";
const inactiveFilterChipClass =
  "border-stone-300 bg-white text-stone-700 hover:bg-stone-100";
const mobileScopeChipClass =
  "altteulmap-chip altteulmap-scope-chip inline-flex whitespace-nowrap px-3 py-2 text-xs transition";
const desktopScopeChipClass =
  "altteulmap-chip altteulmap-scope-chip inline-flex whitespace-nowrap px-4 py-2 text-sm transition";

function getFirstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function createHref(params: {
  category?: string | null;
  maxPrice?: number | null;
  query?: string | null;
  searchScope?: PlaceSearchScope;
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

  const query = search.toString();

  return query ? `/?${query}` : "/";
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
  const user = await getSessionUser();

  const [result, bookmarkResult] = await Promise.all([
    listPlaces({
      category: activeCategory,
      maxPrice: activeMaxPrice,
      query: activeQuery,
    }),
    listBookmarks(user),
  ]);
  const currentMapHref = createHref({
    category: activeCategory,
    maxPrice: activeMaxPrice,
    query: activeQuery,
    searchScope: activeSearchScope,
  });
  const loginHref = createLoginHref(currentMapHref);
  const bookmarkLoginHref = createLoginHref(currentMapHref);
  const submitHref = "/submit";
  const places = result.items;
  const bookmarkedIds = new Set(
    bookmarkResult.items.map((bookmark) => bookmark.placeId),
  );
  const selectedCategory = getCategoryBySlug(activeCategory);
  const activePriceLabel =
    priceOptions.find((option) => option.value === activeMaxPrice)?.label ?? null;
  const mobileSummaryItems = [
    activeQuery ? `검색 ${activeQuery}` : null,
    selectedCategory?.name ?? null,
    activePriceLabel,
    activeSearchScope === "global" ? "전체 검색" : "현재 지도",
  ].filter((item): item is string => Boolean(item));

  return (
    <main className="bg-stone-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <BrandMark href="/" variant="compact" className="max-w-[18rem]" />
            <div className="flex flex-wrap gap-3">
              <Link
                href={submitHref}
                className="altteulmap-accent-solid altteulmap-button whitespace-nowrap px-5 py-3 text-sm font-medium transition"
              >
                장소 등록하기
              </Link>
              <Link
                href={bookmarkResult.authenticated ? "/bookmarks" : bookmarkLoginHref}
                className="altteulmap-button whitespace-nowrap border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
              >
                북마크
              </Link>
              <SessionActionGroup
                user={user}
                loginHref={loginHref}
                signOutCallbackUrl={currentMapHref}
              />
            </div>
          </div>

          <section className="mt-8 lg:hidden">
            <form
              action="/"
              className="grid gap-3 rounded-[1.75rem] border border-stone-200 bg-stone-50 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-stone-700">검색</p>
                {activeQuery ? (
                  <Link
                    href={createHref({
                      category: activeCategory,
                      maxPrice: activeMaxPrice,
                    })}
                    className="text-xs font-medium text-stone-500 transition hover:text-stone-900"
                  >
                    검색 지우기
                  </Link>
                ) : null}
              </div>

              <div className="flex gap-2">
                <input
                  type="search"
                  name="q"
                  defaultValue={activeQuery ?? ""}
                  placeholder="김밥, 세탁소, 프린트"
                  className="h-11 min-w-0 flex-1 rounded-[1.1rem] border border-stone-300 bg-white px-4 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
                <button
                  type="submit"
                  className="altteulmap-accent-solid altteulmap-button inline-flex h-11 shrink-0 items-center justify-center px-4 text-sm font-medium transition"
                >
                  검색
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {mobileSummaryItems.map((item) => (
                  <span
                    key={item}
                    className="altteulmap-badge whitespace-nowrap px-3 py-1.5 text-[11px] text-stone-600"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <details className="group rounded-[1.25rem] border border-stone-200 bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-stone-700 [&::-webkit-details-marker]:hidden">
                  <span>탐색 조건</span>
                  <span className="text-xs text-stone-500 group-open:hidden">
                    열기
                  </span>
                  <span className="hidden text-xs text-stone-500 group-open:inline">
                    접기
                  </span>
                </summary>

                <div className="grid gap-5 border-t border-stone-200 p-4">
                  <section>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                      검색 범위
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <label className="cursor-pointer">
                        <input
                          type="radio"
                          name="scope"
                          value="viewport"
                          defaultChecked={activeSearchScope === "viewport"}
                          className="altteulmap-scope-input sr-only"
                        />
                        <span className={mobileScopeChipClass}>
                          현재 지도에서 찾기
                        </span>
                      </label>
                      <label className="cursor-pointer">
                        <input
                          type="radio"
                          name="scope"
                          value="global"
                          defaultChecked={activeSearchScope === "global"}
                          className="altteulmap-scope-input sr-only"
                        />
                        <span className={mobileScopeChipClass}>
                          전체에서 찾기
                        </span>
                      </label>
                    </div>
                  </section>

                  <section>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                      가격 필터
                    </p>
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
                            })}
                            className={`${mobileFilterChipClass} ${
                              isActive
                                ? "altteulmap-accent-chip"
                                : inactiveFilterChipClass
                            }`}
                          >
                            {option.label}
                          </Link>
                        );
                      })}
                    </div>
                  </section>

                  <section>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                      카테고리
                    </p>
                    <div className="mt-3 flex max-h-[12.5rem] flex-wrap gap-2 overflow-y-auto pr-1">
                      <Link
                        href={createHref({
                          category: null,
                          maxPrice: activeMaxPrice,
                          query: activeQuery,
                          searchScope: activeSearchScope,
                        })}
                        className={`${mobileFilterChipClass} ${
                          !activeCategory
                            ? "altteulmap-accent-chip"
                            : inactiveFilterChipClass
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
                                })}
                              className={`${mobileFilterChipClass} ${
                                isActive
                                  ? "altteulmap-accent-chip"
                                  : inactiveFilterChipClass
                              }`}
                            >
                              {category.name}
                            </Link>
                          );
                        }),
                      )}
                    </div>
                  </section>
                </div>
              </details>

              {activeCategory ? (
                <input type="hidden" name="category" value={activeCategory} />
              ) : null}
              {activeMaxPrice ? (
                <input type="hidden" name="maxPrice" value={activeMaxPrice} />
              ) : null}
            </form>
          </section>

          <div className="mt-8 hidden gap-4 rounded-3xl border border-stone-200 bg-stone-50 p-5 lg:grid">
            <section>
              <p className="text-sm font-medium text-stone-700">카테고리</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={createHref({
                    category: null,
                    maxPrice: activeMaxPrice,
                    query: activeQuery,
                    searchScope: activeSearchScope,
                  })}
                  className={`${desktopFilterChipClass} ${
                    !activeCategory
                      ? "altteulmap-accent-chip"
                      : inactiveFilterChipClass
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
                        })}
                        className={`${desktopFilterChipClass} ${
                          isActive
                            ? "altteulmap-accent-chip"
                            : inactiveFilterChipClass
                        }`}
                      >
                        {category.name}
                      </Link>
                    );
                  }),
                )}
              </div>
            </section>

            <section>
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
                        })}
                        className={`${desktopFilterChipClass} ${
                          isActive
                            ? "altteulmap-accent-chip"
                            : inactiveFilterChipClass
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
                    })}
                    className="altteulmap-button whitespace-nowrap border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
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
                    className="altteulmap-accent-solid altteulmap-button inline-flex h-12 items-center justify-center px-5 text-sm font-medium transition"
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
                      className="altteulmap-scope-input sr-only"
                    />
                    <span className={desktopScopeChipClass}>
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
                      className="altteulmap-scope-input sr-only"
                    />
                    <span className={desktopScopeChipClass}>
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
              </form>
            </section>
          </div>

          <MapExplorer
            key={`${activeCategory ?? "all"}:${activeMaxPrice ?? "all"}:${activeQuery ?? "all"}:${activeSearchScope}`}
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
          />
        </section>
      </div>
    </main>
  );
}
