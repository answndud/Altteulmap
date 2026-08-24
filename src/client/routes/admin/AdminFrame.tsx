import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

const adminNavItems = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/places", label: "장소 승인" },
  { href: "/admin/prices", label: "가격 정보 검토" },
  { href: "/admin/reports", label: "신고 검토" },
];

export function AdminFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto grid max-w-6xl gap-5 px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="altteulmap-section-kicker">운영</p>
          <h1 className="mt-1 text-3xl font-semibold text-[var(--altteul-text-strong)]">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--altteul-text-secondary)]">
            {description}
          </p>
        </div>
        <Link
          to="/"
          className="altteulmap-button border border-[var(--altteul-surface-border-strong)] bg-[var(--altteul-bg-surface)] px-4 py-2 text-sm text-[var(--altteul-text-secondary)]"
        >
          지도 화면
        </Link>
      </div>
      <nav className="altteulmap-segmented altteulmap-scroll-row">
        {adminNavItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === "/admin"}
            className={({ isActive }) =>
              [
                "altteulmap-chip inline-flex border px-4 py-2 text-sm",
                isActive
                  ? "border-[rgba(151,70,29,0.38)] bg-[rgba(181,90,43,0.12)] text-[var(--altteul-accent-text)]"
                  : "border-[var(--altteul-surface-border-strong)] bg-[var(--altteul-bg-surface)] text-[var(--altteul-text-secondary)]",
              ].join(" ")
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      {children}
    </main>
  );
}
