import type { Metadata } from "next";
import Link from "next/link";

import { listBookmarks } from "@/features/bookmarks/repository";
import { getCategoryBySlug } from "@/features/categories/catalog";
import { MapCategoryTray } from "@/features/map/map-category-tray";
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

const scopeChipClassName =
  "altteulmap-chip altteulmap-scope-chip inline-flex min-w-[8.25rem] items-center justify-center whitespace-nowrap px-3 py-2 text-xs font-medium transition sm:text-sm";
const SEOUL_BOOTSTRAP_BOUNDS: PlaceBounds = {
  minLat: 37.4133,
  maxLat: 37.7151,
  minLng: 126.7341,
  maxLng: 127.2693,
};
const SEOUL_BOOTSTRAP_ZOOM = 11;

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
  const selectedCategory = getCategoryBySlug(activeCategory);
  const bookmarkedIds = new Set(
    bookmarkResult.items.map((bookmark) => bookmark.placeId),
  );
  const selectedGroupName = selectedCategory?.parentName ?? null;
  const summaryItems = [
    activeQuery ? `검색어 ${activeQuery}` : null,
    selectedGroupName ? `묶음 ${selectedGroupName}` : null,
    selectedCategory?.name ? `세부 ${selectedCategory.name}` : null,
    activeSearchScope === "global" ? "전체 검색" : "현재 지도",
  ].filter((item): item is string => Boolean(item));
  const filterRouteKey = [
    activeCategory ?? "all",
    activeQuery ?? "all",
    activeSearchScope,
  ].join(":");
  const clearSearchHref = createHref({
    category: activeCategory,
  });

  return (
    <main className="bg-[var(--altteul-bg-canvas)] px-3 py-4 sm:px-4 sm:py-5 lg:px-5 xl:px-6">
      <div className="mx-auto flex max-w-[96rem] flex-col gap-3 sm:gap-4">
        <section className="altteulmap-panel p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="altteulmap-section-kicker">탐색</p>
                <h1 className="mt-1 text-[1.45rem] font-semibold tracking-[-0.06em] text-stone-950 sm:text-[1.75rem]">
                  동네 가격 지도
                </h1>
                <p className="mt-1 hidden max-w-2xl text-sm leading-6 text-stone-600 sm:block">
                  대표 가격, 최근 갱신, 검증 상태를 기준으로 생활 장소를 빠르게
                  비교합니다.
                </p>
              </div>
              <div className="flex max-w-full flex-wrap gap-2">
                {summaryItems.map((item) => (
                  <span
                    key={item}
                    className="altteulmap-badge whitespace-nowrap px-3 py-1.5 text-xs font-medium"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <form action="/" className="grid gap-3" data-testid="place-search-form">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_auto] xl:items-end">
                <label className="grid min-w-0 gap-1.5">
                  <span className="text-sm font-medium text-stone-700">
                    장소나 서비스 검색
                  </span>
                  <input
                    type="search"
                    name="q"
                    defaultValue={activeQuery ?? ""}
                    placeholder="김밥, 세탁소, 프린트, 약국"
                    data-testid="place-search-input"
                    className="altteulmap-input h-12 px-4 text-sm"
                  />
                </label>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="grid gap-1.5">
                    <p className="text-sm font-medium text-stone-700">범위</p>
                    <div className="altteulmap-segmented w-fit">
                      <label className="cursor-pointer">
                        <input
                          type="radio"
                          name="scope"
                          value="viewport"
                          data-testid="search-scope-viewport"
                          defaultChecked={activeSearchScope === "viewport"}
                          className="altteulmap-scope-input sr-only"
                        />
                        <span className={scopeChipClassName}>현재 지도</span>
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
                        <span className={scopeChipClassName}>전체 검색</span>
                      </label>
                    </div>
                  </div>
                  <button
                    type="submit"
                    data-testid="place-search-submit"
                    className="altteulmap-accent-solid altteulmap-button inline-flex h-12 items-center justify-center px-5 text-sm font-medium"
                  >
                    검색
                  </button>
                  {activeQuery ? (
                    <Link
                      href={clearSearchHref}
                      prefetch={false}
                      className="altteulmap-button inline-flex h-12 items-center justify-center px-4 text-sm font-medium text-stone-700"
                    >
                      지우기
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                <RouteResetDetails
                  key={filterRouteKey}
                  className="altteulmap-panel w-full overflow-hidden"
                  summaryClassName="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-stone-800 [&::-webkit-details-marker]:hidden"
                  summary={
                    <>
                      <div className="min-w-0">
                        <span>카테고리</span>
                        <p className="mt-0.5 truncate text-xs font-normal text-stone-500">
                          {selectedCategory
                            ? `${selectedCategory.parentName} · ${selectedCategory.name}`
                            : "상위 묶음과 세부 업종으로 빠르게 좁혀 봅니다."}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-stone-500">
                        펼치기
                      </span>
                    </>
                  }
                  bodyClassName="border-t border-stone-200 px-4 py-4"
                >
                  <MapCategoryTray
                    activeCategory={activeCategory}
                    activeQuery={activeQuery}
                    activeSearchScope={activeSearchScope}
                  />
                </RouteResetDetails>

                <div className="hidden xl:flex xl:flex-wrap xl:justify-end xl:gap-2">
                  <span className="altteulmap-badge whitespace-nowrap px-3 py-1.5 text-xs font-medium">
                    {activeSearchScope === "global"
                      ? "지도 밖 결과 포함"
                      : "보이는 범위 중심"}
                  </span>
                  <span className="altteulmap-badge whitespace-nowrap px-3 py-1.5 text-xs font-medium">
                    가격 중심 카드
                  </span>
                </div>
              </div>

              {activeCategory ? (
                <input type="hidden" name="category" value={activeCategory} />
              ) : null}
            </form>
          </div>
        </section>

        <MapExplorer
          key={`${activeCategory ?? "all"}:${activeQuery ?? "all"}:${activeSearchScope}`}
          bookmarkedPlaceIds={Array.from(bookmarkedIds)}
          bookmarkLoginHref={bookmarkLoginHref}
          category={activeCategory}
          currentMapHref={currentMapHref}
          initialBounds={result.bounds}
          initialCount={result.count}
          initialZoom={shouldPrefetchPlaces ? null : SEOUL_BOOTSTRAP_ZOOM}
          markerMode={result.markerMode}
          prefetchedOnServer={shouldPrefetchPlaces}
          mapMarkers={result.mapMarkers}
          places={result.items}
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
      </div>
    </main>
  );
}
