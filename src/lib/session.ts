import "server-only";

import { getServerSession } from "next-auth";

import { authOptions } from "@/auth";
import type { AppUserRole } from "@/features/auth/constants";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: AppUserRole;
};

export function normalizeCallbackUrl(
  value: string | null | undefined,
  fallback = "/",
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  const [pathAndQuery, hashFragment] = value.split("#", 2);
  const queryIndex = pathAndQuery.indexOf("?");
  const pathname =
    queryIndex >= 0 ? pathAndQuery.slice(0, queryIndex) : pathAndQuery;

  if (pathname === "/login") {
    return fallback;
  }

  const rawQuery = queryIndex >= 0 ? pathAndQuery.slice(queryIndex + 1) : "";
  const encodedQuery = rawQuery ? new URLSearchParams(rawQuery).toString() : "";
  const normalizedPath = encodedQuery ? `${pathname}?${encodedQuery}` : pathname;

  if (!hashFragment) {
    return normalizedPath;
  }

  return `${normalizedPath}#${encodeURIComponent(hashFragment)}`;
}

export function createLoginHref(callbackUrl: string) {
  const safeCallbackUrl = normalizeCallbackUrl(callbackUrl);
  const params = new URLSearchParams({
    callbackUrl: safeCallbackUrl,
  });

  return `/login?${params.toString()}`;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user?.id || !user.email) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    role: user.role,
  };
}

export function getSessionUserLabel(user: SessionUser | null) {
  if (!user) {
    return "게스트";
  }

  return user.name || user.email;
}
