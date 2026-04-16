"use client";

import Link from "next/link";
import { useState } from "react";

type CategoryFilterItem = {
  href: string;
  name: string;
  slug: string;
};

type CategoryFilterChipsProps = {
  activeSlug: string | null;
  activeClassName: string;
  allHref: string;
  collapsedCount?: number;
  inactiveClassName: string;
  items: CategoryFilterItem[];
  itemClassName: string;
  toggleButtonClassName: string;
};

export function CategoryFilterChips({
  activeSlug,
  activeClassName,
  allHref,
  collapsedCount = 8,
  inactiveClassName,
  items,
  itemClassName,
  toggleButtonClassName,
}: CategoryFilterChipsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const visibleItems =
    isExpanded || items.length <= collapsedCount
      ? items
      : (() => {
          const visibleSlugs = new Set(
            items.slice(0, collapsedCount).map((item) => item.slug),
          );

          if (activeSlug) {
            visibleSlugs.add(activeSlug);
          }

          return items.filter((item) => visibleSlugs.has(item.slug));
        })();

  const hiddenCount = Math.max(items.length - visibleItems.length, 0);

  return (
    <>
      <Link
        href={allHref}
        prefetch={false}
        className={`${itemClassName} ${
          !activeSlug ? activeClassName : inactiveClassName
        }`}
      >
        전체
      </Link>
      {visibleItems.map((item) => {
        const isActive = activeSlug === item.slug;

        return (
          <Link
            key={item.slug}
            href={item.href}
            prefetch={false}
            className={`${itemClassName} ${
              isActive ? activeClassName : inactiveClassName
            }`}
          >
            {item.name}
          </Link>
        );
      })}
      {items.length > collapsedCount ? (
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => {
            setIsExpanded((current) => !current);
          }}
          className={toggleButtonClassName}
        >
          {isExpanded ? "접기" : `더보기 ${hiddenCount}`}
        </button>
      ) : null}
    </>
  );
}
