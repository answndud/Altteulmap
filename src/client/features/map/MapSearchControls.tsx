import { Link } from "react-router-dom";

import { createMapHref } from "@/client/features/map/map-query";
import { RouteResetDetails } from "@/features/map/route-reset-details";
import type { PlaceSearchScope } from "@/features/places/types";

import { MapCategoryTray } from "./MapCategoryTray";

const scopeChipClassName =
  "altteulmap-scope-chip inline-flex h-11 min-w-[3.9rem] items-center justify-center whitespace-nowrap rounded-[0.65rem] px-2 text-[11px] font-semibold transition sm:min-w-[6.75rem] sm:px-3 sm:text-sm";

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
    <section
      className="grid gap-2 border-b border-[var(--altteul-surface-border)] pb-2 sm:gap-3 sm:pb-4"
      data-testid="map-search-controls"
    >
      <h1 className="sr-only sm:hidden">알뜰 지도</h1>
      <div className="hidden items-center justify-between gap-2 sm:flex lg:items-end">
        <div className="min-w-0">
          <p className="altteulmap-section-kicker">탐색</p>
          <h1 className="mt-1 truncate text-[1.55rem] font-bold text-[var(--altteul-text-strong)]">
            가격이 보이는 동네 지도
          </h1>
          <p className="mt-1 hidden max-w-2xl text-sm leading-6 text-[var(--altteul-text-secondary)] sm:block">
            대표 가격, 검증 상태, 최근 갱신을 기준으로 지금 갈 곳을 빠르게 비교합니다.
          </p>
        </div>
        <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
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
            {searchScope === "global" ? "전국" : "현재 화면"}
          </span>
        </div>
      </div>

      <form action="/" className="grid gap-2" data-testid="place-search-form">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="grid min-w-0 gap-1.5">
            <span className="sr-only">장소나 서비스 검색</span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="김밥, 세탁소, 프린트 검색"
              data-testid="place-search-input"
              className="altteulmap-input h-11 px-3 text-[16px] sm:px-4 sm:text-sm"
            />
          </label>
          {activeCategory ? (
            <input type="hidden" name="category" value={activeCategory} />
          ) : null}
          <button
            type="submit"
            data-testid="place-search-submit"
            className="altteulmap-accent-solid altteulmap-button inline-flex h-11 items-center justify-center px-3 text-sm font-medium sm:px-5"
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

        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 xl:grid-cols-[auto_minmax(0,1fr)_auto]">
          <div className="flex min-w-0 items-center gap-2">
            <span className="sr-only text-xs font-semibold text-[var(--altteul-text-secondary)] sm:not-sr-only">
              검색 범위
            </span>
            <div className="altteulmap-segmented w-fit">
              <label className="cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="viewport"
                  aria-label="현재 화면"
                  data-testid="search-scope-viewport"
                  defaultChecked={searchScope === "viewport"}
                  className="altteulmap-scope-input sr-only"
                />
                <span className={scopeChipClassName}>
                  <span className="sm:hidden">지도</span>
                  <span className="hidden sm:inline">현재 화면</span>
                </span>
              </label>
              <label className="cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="global"
                  aria-label="전체 지역"
                  data-testid="search-scope-global"
                  defaultChecked={searchScope === "global"}
                  className="altteulmap-scope-input sr-only"
                />
                <span className={scopeChipClassName}>
                  <span className="sm:hidden">전체</span>
                  <span className="hidden sm:inline">전체 지역</span>
                </span>
              </label>
            </div>
          </div>

          <RouteResetDetails
            key={`${activeCategory ?? "all"}:${query || "all"}:${searchScope}`}
            className="min-w-0 overflow-hidden rounded-[0.85rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)]"
            summaryClassName="flex h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-semibold text-[var(--altteul-text-primary)] sm:gap-3 sm:px-3.5 [&::-webkit-details-marker]:hidden"
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
                <span className="shrink-0 text-[11px] font-medium text-[var(--altteul-primary-text)] sm:text-xs">
                  열기
                </span>
              </>
            }
            bodyClassName="border-t border-[var(--altteul-surface-border)] px-3 py-3 sm:px-3.5 sm:py-3.5"
          >
            <MapCategoryTray
              activeCategory={activeCategory}
              activeQuery={query || null}
              activeSearchScope={searchScope}
            />
          </RouteResetDetails>

          <div className="hidden xl:flex xl:flex-wrap xl:justify-end xl:gap-2">
            <span className="altteulmap-badge whitespace-nowrap px-3 py-1.5 text-xs font-medium">
              {searchScope === "global" ? "다른 지역 결과도 포함" : "현재 화면 중심"}
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
