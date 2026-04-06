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
    ? "altteulmap-accent-ghost altteulmap-button inline-flex shrink-0 items-center justify-center whitespace-nowrap border px-3 py-1.5 text-[13px] font-medium transition sm:px-4 sm:py-2 sm:text-sm"
    : "altteulmap-button inline-flex shrink-0 items-center justify-center whitespace-nowrap border border-stone-300 bg-white px-3 py-1.5 text-[13px] font-medium text-stone-700 transition hover:bg-stone-100 sm:px-4 sm:py-2 sm:text-sm";
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

  return (
    <header className="sticky top-0 z-[70] border-b border-stone-200/80 bg-stone-50/92 backdrop-blur">
      <div className="mx-auto max-w-[96rem] px-3 py-2.5 sm:px-4 lg:px-5 xl:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <BrandMark href={homeHref} variant="compact" className="shrink-0" />

          <nav className="altteulmap-scroll-row min-w-0 flex-1 items-center justify-start sm:justify-end">
            <Link
              href={submitHref}
              className={getNavClassName(isActive(pathname, submitHref))}
            >
              <span className="sm:hidden">등록</span>
              <span className="hidden sm:inline">장소 등록하기</span>
            </Link>
            <Link
              href={bookmarksHref}
              className={getNavClassName(isActive(pathname, "/bookmarks"))}
            >
              북마크
            </Link>
            {userLabel ? (
              <span
                data-testid="session-user-badge"
                className="hidden items-center justify-center whitespace-nowrap rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 sm:inline-flex"
              >
                {userLabel}
              </span>
            ) : null}
            {showAdminLink ? (
              <Link
                href={adminHref}
                data-testid="session-admin-link"
                className={getNavClassName(
                  pathname === "/admin" || pathname.startsWith("/admin/"),
                )}
              >
                <span className="sm:hidden">관리</span>
                <span className="hidden sm:inline">운영자 관리</span>
              </Link>
            ) : null}
            {user ? (
              <SignOutButton callbackUrl="/" compact />
            ) : !isAuthPage ? (
              <Link
                href={loginHref}
                data-testid="session-login-link"
                className={getNavClassName(pathname === "/login")}
              >
                로그인
              </Link>
            ) : null}
          </nav>
        </div>
      </div>
    </header>
  );
}
