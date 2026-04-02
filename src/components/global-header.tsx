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
    ? "altteulmap-accent-ghost altteulmap-button inline-flex items-center justify-center whitespace-nowrap border px-4 py-2 text-sm font-medium transition"
    : "altteulmap-button inline-flex items-center justify-center whitespace-nowrap border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100";
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

  return (
    <header className="sticky top-0 z-[70] border-b border-stone-200/80 bg-stone-50/92 backdrop-blur">
      <div className="mx-auto flex max-w-[96rem] flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4 lg:px-5 xl:px-6">
        <BrandMark href={homeHref} variant="compact" className="max-w-[9rem]" />

        <nav className="flex flex-wrap items-center justify-end gap-2">
          <Link href={submitHref} className={getNavClassName(isActive(pathname, submitHref))}>
            장소 등록하기
          </Link>
          <Link href={bookmarksHref} className={getNavClassName(isActive(pathname, "/bookmarks"))}>
            북마크
          </Link>
          <Link href={adminHref} className={getNavClassName(pathname === "/admin" || pathname.startsWith("/admin/"))}>
            운영자 관리
          </Link>
          {user ? (
            <SignOutButton callbackUrl={pathname} compact />
          ) : (
            <Link href={loginHref} className={getNavClassName(pathname === "/login")}>
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
