import Link from "next/link";

import type { AdminOverviewResult } from "@/features/admin/repository";

type AdminQueueKey = "dashboard" | "places" | "prices" | "reports";

type AdminQueueNavProps = {
  current: AdminQueueKey;
  stats: AdminOverviewResult["stats"];
};

const navItems = [
  {
    key: "dashboard",
    href: "/admin",
    label: "대시보드",
    getCount: () => null,
  },
  {
    key: "places",
    href: "/admin/places",
    label: "장소 승인",
    getCount: (stats: AdminOverviewResult["stats"]) => stats.pendingPlaces,
  },
  {
    key: "prices",
    href: "/admin/prices",
    label: "가격 제보",
    getCount: (stats: AdminOverviewResult["stats"]) => stats.pendingPriceReports,
  },
  {
    key: "reports",
    href: "/admin/reports",
    label: "신고 검토",
    getCount: (stats: AdminOverviewResult["stats"]) => stats.openReports,
  },
] satisfies Array<{
  key: AdminQueueKey;
  href: string;
  label: string;
  getCount: (stats: AdminOverviewResult["stats"]) => number | null;
}>;

function getLinkClassName(active: boolean) {
  return active
    ? "inline-flex items-center gap-2 rounded-full border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-medium text-white"
    : "inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100";
}

export function AdminQueueNav({ current, stats }: AdminQueueNavProps) {
  return (
    <nav
      data-testid="admin-queue-nav"
      className="mt-6 flex flex-wrap gap-2 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-3"
    >
      {navItems.map((item) => {
        const count = item.getCount(stats);
        const active = item.key === current;

        return (
          <Link
            key={item.key}
            href={item.href}
            data-testid={`admin-queue-link-${item.key}`}
            aria-current={active ? "page" : undefined}
            className={getLinkClassName(active)}
          >
            <span>{item.label}</span>
            {typeof count === "number" ? (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  active ? "bg-white/15 text-white" : "bg-stone-100 text-stone-600"
                }`}
              >
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
