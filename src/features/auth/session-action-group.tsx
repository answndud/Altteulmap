import Link from "next/link";

import { appUserRoleLabelMap } from "@/features/auth/constants";
import { SignOutButton } from "@/features/auth/sign-out-button";
import {
  getSessionUserLabel,
  type SessionUser,
} from "@/lib/session";

type SessionActionGroupProps = {
  user: SessionUser | null;
  loginHref?: string;
  signOutCallbackUrl?: string;
  compact?: boolean;
};

function getBadgeLabel(user: SessionUser) {
  const userLabel = getSessionUserLabel(user);
  const roleLabel = appUserRoleLabelMap[user.role];

  return userLabel === roleLabel ? userLabel : `${userLabel} · ${roleLabel}`;
}

export function SessionActionGroup({
  user,
  loginHref,
  signOutCallbackUrl = "/",
  compact = false,
}: SessionActionGroupProps) {
  const badgeClassName = compact
    ? "altteulmap-badge whitespace-nowrap border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-700"
    : "altteulmap-badge whitespace-nowrap border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700";
  const linkClassName = compact
    ? "altteulmap-button whitespace-nowrap border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700 transition hover:bg-stone-100"
    : "altteulmap-button whitespace-nowrap border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100";

  if (!user) {
    if (!loginHref) {
      return null;
    }

    return (
      <Link
        href={loginHref}
        data-testid="session-login-link"
        className={linkClassName}
      >
        로그인
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span data-testid="session-user-badge" className={badgeClassName}>
        {getBadgeLabel(user)}
      </span>
      {user.role === "admin" ? (
        <Link
          href="/admin"
          data-testid="session-admin-link"
          className={linkClassName}
        >
          관리
        </Link>
      ) : null}
      <SignOutButton callbackUrl={signOutCallbackUrl} compact={compact} />
    </div>
  );
}
