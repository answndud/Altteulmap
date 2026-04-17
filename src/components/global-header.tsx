"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandMark } from "@/components/brand-mark";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { createLoginHref } from "@/lib/auth-navigation";

type HeaderUser = {
  id: string;
  email: string;
  name: string | null;
  role: "user" | "admin";
} | null;

type GlobalHeaderProps = {
  adminHref: string;
  homeHref?: string;
  user: HeaderUser;
};

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/admin") {
    return pathname === "/admin" || pathname.startsWith("/admin/");
  }

  return pathname === href;
}

function getNavClassName(active: boolean) {
  return active
    ? "altteulmap-accent-ghost altteulmap-button inline-flex shrink-0 items-center justify-center whitespace-nowrap border px-3 py-2 text-[13px] font-medium transition sm:px-3.5 sm:text-sm"
    : "altteulmap-button inline-flex shrink-0 items-center justify-center whitespace-nowrap border border-stone-300/90 bg-white/90 px-3 py-2 text-[13px] font-medium text-stone-700 transition hover:bg-white sm:px-3.5 sm:text-sm";
}

export function GlobalHeader({
  adminHref,
  homeHref = "/",
  user,
}: GlobalHeaderProps) {
  const pathname = usePathname() ?? "/";
  const loginHref = createLoginHref(pathname);
  const bookmarksHref = user ? "/bookmarks" : createLoginHref("/bookmarks");
  const submitHref = "/submit";
  const userLabel = user?.name?.trim() || user?.email || null;
  const showAdminLink = user?.role === "admin";
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
  const showUserBadge = Boolean(userLabel) && !isAdminPage;

  return (
    <header className="sticky top-0 z-[70] border-b border-stone-200/85 bg-[rgba(244,241,236,0.92)] backdrop-blur">
      <div className="mx-auto max-w-[96rem] px-3 py-2 sm:px-4 lg:px-5 xl:px-6">
        <div className="flex min-w-0 items-center justify-between gap-3 sm:gap-4">
          <BrandMark href={homeHref} variant="compact" className="shrink-0" />

          {isAuthPage ? (
            <div className="flex items-center gap-2">
              <Link
                href={homeHref}
                prefetch={false}
                className="altteulmap-button inline-flex shrink-0 items-center justify-center whitespace-nowrap border border-stone-300/90 bg-white/90 px-3 py-2 text-[13px] font-medium text-stone-700 transition hover:bg-white sm:px-3.5 sm:text-sm"
              >
                지도로
              </Link>
            </div>
          ) : (
            <nav className="altteulmap-scroll-row min-w-0 flex-1 items-center justify-start sm:justify-end">
              {isAdminPage ? (
                <Link
                  href={homeHref}
                  prefetch={false}
                  className={getNavClassName(isActive(pathname, homeHref))}
                >
                  지도
                </Link>
              ) : null}
              <Link
                href={submitHref}
                prefetch={false}
                className={`${
                  isActive(pathname, submitHref)
                    ? "altteulmap-accent-solid"
                    : ""
                } ${getNavClassName(false)} border-stone-300/90`}
              >
                <span className="sm:hidden">등록</span>
                <span className="hidden sm:inline">장소 등록</span>
              </Link>
              {isAdminPage ? null : (
                <Link
                  href={bookmarksHref}
                  prefetch={false}
                  className={getNavClassName(isActive(pathname, "/bookmarks"))}
                >
                  북마크
                </Link>
              )}
              {showUserBadge ? (
                <span
                  data-testid="session-user-badge"
                  className="hidden items-center justify-center whitespace-nowrap rounded-full border border-stone-200/90 bg-white/85 px-3 py-2 text-xs font-medium text-stone-600 sm:inline-flex"
                >
                  {userLabel}
                </span>
              ) : null}
              {showAdminLink ? (
                <Link
                  href={adminHref}
                  prefetch={false}
                  data-testid="session-admin-link"
                  className={getNavClassName(
                    pathname === "/admin" || pathname.startsWith("/admin/"),
                  )}
                >
                  <span className="sm:hidden">관리</span>
                  <span className="hidden sm:inline">
                    {isAdminPage ? "관리 홈" : "운영 관리"}
                  </span>
                </Link>
              ) : null}
              {user ? (
                <SignOutButton callbackUrl="/" compact />
              ) : (
                <Link
                  href={loginHref}
                  prefetch={false}
                  data-testid="session-login-link"
                  className={getNavClassName(pathname === "/login")}
                >
                  로그인
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
