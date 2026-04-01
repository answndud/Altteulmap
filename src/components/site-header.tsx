import Link from "next/link";

import { appUserRoleLabelMap } from "@/features/auth/constants";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { getSessionUser, getSessionUserLabel } from "@/lib/session";

const publicNavItems = [
  { href: "/report", label: "신고" },
  { href: "/bookmarks", label: "북마크" },
];

export async function SiteHeader() {
  const user = await getSessionUser();
  const navItems =
    user?.role === "admin"
      ? [...publicNavItems, { href: "/admin", label: "관리" }]
      : publicNavItems;

  return (
    <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="whitespace-nowrap text-base font-semibold tracking-tight text-stone-900"
        >
          알뜰맵
        </Link>
        <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-full px-3 py-1.5 font-medium transition hover:bg-stone-100 hover:text-stone-900"
            >
              {item.label}
            </Link>
          ))}
          {user ? (
            <>
              <div className="whitespace-nowrap rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-700">
                {getSessionUserLabel(user)} · {appUserRoleLabelMap[user.role]}
              </div>
              <SignOutButton compact />
            </>
          ) : (
            <Link
              href="/login"
              className="altteulmap-accent-solid whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition"
            >
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
