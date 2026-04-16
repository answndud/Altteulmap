import type { Metadata } from "next";
import Link from "next/link";

import { listBookmarks } from "@/features/bookmarks/repository";
import {
  categoryOptions,
  getCategoryBySlug,
} from "@/features/categories/catalog";
import { CategoryFilterChips } from "@/features/map/category-filter-chips";
import { RouteResetDetails } from "@/features/map/route-reset-details";
import { MapExplorer } from "@/features/places/map-explorer";
import {
  listMapPlaces,
  listTrendingPlaces,
} from "@/features/places/repository";
import { TrendingPlacesSection } from "@/features/places/trending-places-section";
import type {
  PlaceBounds,
  PlaceSearchScope,
} from "@/features/places/types";
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

const mobileCategoryChipClass =
  "altteulmap-chip inline-flex w-full min-w-0 items-center justify-center border px-3 py-2 text-center text-xs leading-tight break-keep transition";
const desktopCategoryChipClass =
  "altteulmap-chip inline-flex w-full min-w-0 items-center justify-center border px-4 py-2 text-center text-sm leading-tight break-keep transition";
const inactiveFilterChipClass =
  "border-stone-300 bg-white text-stone-700 hover:bg-stone-100";
const mobileCategoryToggleChipClass = `${mobileCategoryChipClass} border-dashed border-stone-300 bg-stone-50 font-medium text-stone-600 hover:bg-stone-100`;
const desktopCategoryToggleChipClass = `${desktopCategoryChipClass} border-dashed border-stone-300 bg-stone-50 font-medium text-stone-600 hover:bg-stone-100`;
const mobileScopeChipClass =
  "altteulmap-chip altteulmap-scope-chip inline-flex whitespace-nowrap px-3 py-2 text-xs transition";
const desktopScopeChipClass =
  "altteulmap-chip altteulmap-scope-chip inline-flex whitespace-nowrap px-4 py-2 text-sm transition";
const SEOUL_BOOTSTRAP_BOUNDS: PlaceBounds = {
  minLat: 37.4133,
  maxLat: 37.7151,
  minLng: 126.7341,
  maxLng: 127.2693,
};

function getFirstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function createHref(params: {
  category?: string | null;
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

  const query = search.toString();

  return query ? `/?${query}` : "/";
}

export default async function MapPage({ searchParams }: MapPageProps) {
  const params = await searchParams;
  const activeCategory = getFirstValue(params.category) ?? null;
  const activeQuery = getFirstValue(params.q)?.trim() || null;
  const activeSearchScope: PlaceSearchScope =
    activeQuery && getFirstValue(params.scope) === "global"
      ? "global"
      : "viewport";
  const user = await getSessionUser();
  const shouldPrefetchPlaces = activeSearchScope === "global";
  const shouldShowTrendingPlaces = !activeQuery;

  const [result, bookmarkResult, trendingResult] = await Promise.all([
    shouldPrefetchPlaces
      ? listMapPlaces({
          category: activeCategory,
          query: activeQuery,
        })
      : Promise.resolve({
          items: [],
          mapMarkers: [],
          markerMode: "place" as const,
          bounds: SEOUL_BOOTSTRAP_BOUNDS,
          count: 0,
          source: "database" as const,
        }),
    listBookmarks(user),
    shouldShowTrendingPlaces
      ? listTrendingPlaces(6, activeCategory)
      : Promise.resolve({
          items: [],
          source: "database" as const,
        }),
  ]);
  const currentMapHref = createHref({
    category: activeCategory,
    query: activeQuery,
    searchScope: activeSearchScope,
  });
  const bookmarkLoginHref = createLoginHref(currentMapHref);
  const places = result.items;
  const bookmarkedIds = new Set(
    bookmarkResult.items.map((bookmark) => bookmark.placeId),
  );
  const selectedCategory = getCategoryBySlug(activeCategory);
  const categoryFilterItems = categoryOptions.map((category) => ({
    href: createHref({
      category: category.slug,
      query: activeQuery,
      searchScope: activeSearchScope,
    }),
    name: category.name,
    slug: category.slug,
  }));
  const allCategoryHref = createHref({
    category: null,
    query: activeQuery,
    searchScope: activeSearchScope,
  });
  const mobileFilterRouteKey = [
    activeCategory ?? "all",
    activeQuery ?? "all",
    activeSearchScope,
  ].join(":");
  const mobileSummaryItems = [
    activeQuery ? `검색 ${activeQuery}` : null,
    selectedCategory?.name ?? null,
    activeSearchScope === "global" ? "전체 검색" : "현재 지도",
  ].filter((item): item is string => Boolean(item));
  const mobileSummaryText =
    mobileSummaryItems.length > 0
      ? mobileSummaryItems.join(" · ")
      : "현재 지도 기준";

  return (
    <main className="bg-stone-50 px-3 py-4 sm:px-4 sm:py-5 lg:px-5 xl:px-6">
      <div className="mx-auto max-w-[96rem]">
        <section className="rounded-[1.85rem] border border-stone-200 bg-white p-3.5 shadow-sm sm:p-5 xl:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-600">
                지도 탐색
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
                동네 알뜰 장소
              </h1>
            </div>
            <div className="hidden max-w-full flex-wrap gap-2 lg:flex">
              {mobileSummaryItems.map((item) => (
                <span
                  key={item}
                  className="altteulmap-badge whitespace-nowrap px-3 py-1.5 text-xs text-stone-600"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <section className="mt-4 lg:hidden">
            <form
              action="/"
              className="grid gap-2.5 rounded-[1.4rem] border border-stone-200 bg-stone-50/80 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-700">검색</p>
                  <p className="mt-0.5 truncate text-xs text-stone-500">
                    {mobileSummaryText}
                  </p>
                </div>
                {activeQuery ? (
                  <Link
                    href={createHref({
                      category: activeCategory,
                    })}
                    prefetch={false}
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
                  className="h-10 min-w-0 flex-1 rounded-[1rem] border border-stone-300 bg-white px-4 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
                <button
                  type="submit"
                  className="altteulmap-accent-solid altteulmap-button inline-flex h-10 shrink-0 items-center justify-center px-4 text-sm font-medium transition"
                >
                  검색
                </button>
              </div>

              <RouteResetDetails
                key={mobileFilterRouteKey}
                className="group rounded-[1.15rem] border border-stone-200 bg-white"
                summaryClassName="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium text-stone-700 [&::-webkit-details-marker]:hidden"
                summary={
                  <>
                    <span>필터와 범위</span>
                    <span className="text-xs text-stone-500 group-open:hidden">
                      열기
                    </span>
                    <span className="hidden text-xs text-stone-500 group-open:inline">
                      접기
                    </span>
                  </>
                }
                bodyClassName="grid gap-5 border-t border-stone-200 p-4"
              >
                <section>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                    검색 범위
                  </p>
                  <div className="altteulmap-scroll-row mt-3 pb-1">
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

                <section className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                    카테고리
                  </p>
                  <div className="altteulmap-chip-grid mt-3">
                    <CategoryFilterChips
                      activeSlug={activeCategory}
                      activeClassName="altteulmap-accent-chip"
                      allHref={allCategoryHref}
                      collapsedCount={8}
                      inactiveClassName={inactiveFilterChipClass}
                      items={categoryFilterItems}
                      itemClassName={mobileCategoryChipClass}
                      toggleButtonClassName={mobileCategoryToggleChipClass}
                    />
                  </div>
                </section>
              </RouteResetDetails>

              {activeCategory ? (
                <input type="hidden" name="category" value={activeCategory} />
              ) : null}
            </form>
          </section>

          <div className="mt-5 hidden gap-4 rounded-[1.6rem] border border-stone-200 bg-stone-50/80 p-4 lg:grid">
            <section className="min-w-0">
              <p className="text-sm font-medium text-stone-700">카테고리</p>
              <div className="altteulmap-chip-grid mt-3">
                <CategoryFilterChips
                  activeSlug={activeCategory}
                  activeClassName="altteulmap-accent-chip"
                  allHref={allCategoryHref}
                  collapsedCount={10}
                  inactiveClassName={inactiveFilterChipClass}
                  items={categoryFilterItems}
                  itemClassName={desktopCategoryChipClass}
                  toggleButtonClassName={desktopCategoryToggleChipClass}
                />
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-stone-700">검색</p>
                {activeQuery ? (
                  <Link
                    href={createHref({
                      category: activeCategory,
                    })}
                    prefetch={false}
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

                <div className="altteulmap-scroll-row pb-1">
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
              </form>
            </section>
          </div>

          <MapExplorer
            key={`${activeCategory ?? "all"}:${activeQuery ?? "all"}:${activeSearchScope}`}
            bookmarkedPlaceIds={Array.from(bookmarkedIds)}
            bookmarkLoginHref={bookmarkLoginHref}
            category={activeCategory}
            currentMapHref={currentMapHref}
            initialBounds={result.bounds}
            initialCount={result.count}
            markerMode={result.markerMode}
            prefetchedOnServer={shouldPrefetchPlaces}
            mapMarkers={result.mapMarkers}
            places={places}
            query={activeQuery}
            searchScope={activeSearchScope}
            selectedCategoryLabel={selectedCategory?.name ?? null}
          />

          {shouldShowTrendingPlaces ? (
            <TrendingPlacesSection
              items={trendingResult.items}
              selectedCategoryLabel={selectedCategory?.name ?? null}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}
