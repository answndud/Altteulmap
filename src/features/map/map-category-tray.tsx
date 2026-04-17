"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  categoryGroups,
  getCategoryBySlug,
} from "@/features/categories/catalog";
import type { PlaceSearchScope } from "@/features/places/types";

type MapCategoryTrayProps = {
  activeCategory: string | null;
  activeQuery: string | null;
  activeSearchScope: PlaceSearchScope;
};

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

export function MapCategoryTray({
  activeCategory,
  activeQuery,
  activeSearchScope,
}: MapCategoryTrayProps) {
  const selectedCategory = getCategoryBySlug(activeCategory);
  const totalCategoryCount = categoryGroups.reduce(
    (count, group) => count + group.children.length,
    0,
  );
  const [activeGroupSlug, setActiveGroupSlug] = useState(
    selectedCategory?.parentSlug ?? categoryGroups[0]?.slug ?? null,
  );
  const resolvedGroupSlug = selectedCategory?.parentSlug ?? activeGroupSlug;
  const activeGroup = useMemo(
    () =>
      categoryGroups.find((group) => group.slug === resolvedGroupSlug) ??
      categoryGroups[0] ??
      null,
    [resolvedGroupSlug],
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-stone-500">
            전체 {totalCategoryCount}개 업종
          </span>
          <Link
            href={createHref({
              category: null,
              query: activeQuery,
              searchScope: activeSearchScope,
            })}
            prefetch={false}
            className={`altteulmap-chip inline-flex min-w-0 items-center justify-center border px-3 py-2 text-center text-xs font-medium leading-tight transition sm:text-sm ${
              activeCategory
                ? "border-stone-300/90 bg-white text-stone-700 hover:bg-white"
                : "altteulmap-accent-chip"
            }`}
          >
            전체 보기
          </Link>
          <span className="altteulmap-badge whitespace-nowrap px-2.5 py-1 text-[11px] font-medium">
            {selectedCategory
              ? `현재 ${selectedCategory.parentName} · ${selectedCategory.name}`
              : "현재 전체 카테고리"}
          </span>
        </div>

        <div className="grid gap-2">
          <p className="text-xs font-medium tracking-[0.14em] text-stone-500">
            상위 묶음 먼저 고르기
          </p>
          <div className="altteulmap-scroll-row">
            {categoryGroups.map((group) => {
              const isGroupSelected = group.slug === activeGroup?.slug;
              const isGroupActive = group.children.some(
                (category) => category.slug === activeCategory,
              );

              return (
                <button
                  key={group.slug}
                  type="button"
                  onClick={() => {
                    setActiveGroupSlug(group.slug);
                  }}
                  className={`altteulmap-chip inline-flex shrink-0 items-center gap-2 border px-3 py-2 text-sm font-medium transition ${
                    isGroupSelected
                      ? "border-[rgba(151,70,29,0.38)] bg-[rgba(181,90,43,0.12)] text-[var(--altteul-accent-text)]"
                      : "border-stone-300/90 bg-white text-stone-700 hover:bg-white"
                  }`}
                >
                  <span>{group.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      isGroupSelected || isGroupActive
                        ? "bg-white/85 text-[var(--altteul-accent-text)]"
                        : "bg-[var(--altteul-bg-subtle)] text-stone-500"
                    }`}
                  >
                    {group.children.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {activeGroup ? (
        <section className="grid gap-3 border-t border-stone-200 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-stone-900">
                {activeGroup.name}
              </h3>
              <p className="mt-1 text-xs text-stone-500">
                세부 업종을 골라 결과를 바로 좁힙니다.
              </p>
            </div>
            <span className="altteulmap-badge whitespace-nowrap px-2.5 py-1 text-[11px] font-medium">
              {activeGroup.children.length}개 업종
            </span>
          </div>

          <div className="altteulmap-chip-grid">
            {activeGroup.children.map((category) => {
              const isActive = activeCategory === category.slug;

              return (
                <Link
                  key={category.slug}
                  href={createHref({
                    category: category.slug,
                    query: activeQuery,
                    searchScope: activeSearchScope,
                  })}
                  prefetch={false}
                  className={`altteulmap-chip inline-flex min-w-0 items-center justify-center border px-3 py-2 text-center text-xs font-medium leading-tight break-keep transition sm:text-sm ${
                    isActive
                      ? "altteulmap-accent-chip"
                      : "border-stone-300/90 bg-white text-stone-700 hover:bg-white"
                  }`}
                >
                  {category.name}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
