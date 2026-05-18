import { Link } from "react-router-dom";

import { createMapHref } from "@/client/features/map/map-query";
import { RouteResetDetails } from "@/features/map/route-reset-details";
import type { PlaceSearchScope } from "@/features/places/types";

import { MapCategoryTray } from "./MapCategoryTray";

const scopeChipClassName =
  "altteulmap-scope-chip inline-flex min-w-[6.75rem] items-center justify-center whitespace-nowrap rounded-[0.65rem] px-3 py-2 text-xs font-semibold transition sm:text-sm";

export function MapSearchControls({
  activeCategory,
  query,
  searchScope,
  selectedCategory,
}: {
  activeCategory: string | null;
  query: string;
  searchScope: PlaceSearchScope;
  selectedCategory: { name: string; parentName: string } | null;
}) {
  return (
    <section className="grid gap-3 border-b border-[var(--altteul-surface-border)] pb-3 sm:pb-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="altteulmap-section-kicker">탐색</p>
          <h1 className="mt-1 text-xl font-bold text-[var(--altteul-text-strong)] sm:text-[1.55rem]">
            가격이 보이는 동네 지도
          </h1>
          <p className="mt-1 hidden max-w-2xl text-sm leading-6 text-[var(--altteul-text-secondary)] sm:block">
            대표 가격, 검증 상태, 최근 갱신을 기준으로 지금 갈 곳을 빠르게 비교합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {query ? (
            <span className="altteulmap-badge px-3 py-1.5 text-xs font-medium">
              검색: {query}
            </span>
          ) : null}
          {selectedCategory ? (
            <span className="altteulmap-badge px-3 py-1.5 text-xs font-medium">
              업종: {selectedCategory.name}
            </span>
          ) : null}
          <span className="altteulmap-badge px-3 py-1.5 text-xs font-medium">
            {searchScope === "global" ? "전체 지역" : "현재 지도 범위"}
          </span>
        </div>
      </div>

      <form action="/" className="grid gap-2.5" data-testid="place-search-form">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="grid min-w-0 gap-1.5">
            <span className="sr-only">장소나 서비스 검색</span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="무엇을 싸게 찾고 있나요? 예: 김밥, 세탁소, 프린트"
              data-testid="place-search-input"
              className="altteulmap-input h-11 px-4 text-sm"
            />
          </label>
          {activeCategory ? (
            <input type="hidden" name="category" value={activeCategory} />
          ) : null}
          <button
            type="submit"
            data-testid="place-search-submit"
            className="altteulmap-accent-solid altteulmap-button inline-flex h-11 items-center justify-center px-4 text-sm font-medium sm:px-5"
          >
            검색
          </button>
          {query ? (
            <Link
              to={createMapHref({ category: activeCategory })}
              className="altteulmap-button col-span-2 inline-flex h-11 items-center justify-center px-4 text-sm font-medium sm:col-auto"
            >
              지우기
            </Link>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[var(--altteul-text-secondary)]">
              검색 범위
            </span>
            <div className="altteulmap-segmented w-fit">
              <label className="cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="viewport"
                  data-testid="search-scope-viewport"
                  defaultChecked={searchScope === "viewport"}
                  className="altteulmap-scope-input sr-only"
                />
                <span className={scopeChipClassName}>현재 지도 범위</span>
              </label>
              <label className="cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="global"
                  data-testid="search-scope-global"
                  defaultChecked={searchScope === "global"}
                  className="altteulmap-scope-input sr-only"
                />
                <span className={scopeChipClassName}>전체 지역</span>
              </label>
            </div>
          </div>
        </div>

        <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <RouteResetDetails
            key={`${activeCategory ?? "all"}:${query || "all"}:${searchScope}`}
            className="w-full overflow-hidden rounded-[0.85rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)]"
            summaryClassName="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-sm font-semibold text-[var(--altteul-text-primary)] [&::-webkit-details-marker]:hidden"
            summary={
              <>
                <div className="min-w-0">
                  <span>업종 필터</span>
                  <p className="mt-0.5 truncate text-xs font-normal text-[var(--altteul-text-tertiary)]">
                    {selectedCategory
                      ? `${selectedCategory.parentName} · ${selectedCategory.name}`
                      : "전체 업종"}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-medium text-[var(--altteul-primary-text)]">
                  열기
                </span>
              </>
            }
            bodyClassName="border-t border-[var(--altteul-surface-border)] px-3.5 py-3.5"
          >
            <MapCategoryTray
              activeCategory={activeCategory}
              activeQuery={query || null}
              activeSearchScope={searchScope}
            />
          </RouteResetDetails>

          <div className="hidden xl:flex xl:flex-wrap xl:justify-end xl:gap-2">
            <span className="altteulmap-badge whitespace-nowrap px-3 py-1.5 text-xs font-medium">
              {searchScope === "global" ? "지도 밖 결과 포함" : "보이는 범위 중심"}
            </span>
            <span className="altteulmap-badge whitespace-nowrap px-3 py-1.5 text-xs font-medium">
              가격 중심 카드
            </span>
          </div>
        </div>
      </form>
    </section>
  );
}
