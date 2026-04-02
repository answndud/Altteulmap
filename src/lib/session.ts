import "server-only";

import { getServerSession } from "next-auth";

import { getAuthOptions } from "@/auth";
import type { AppUserRole } from "@/features/auth/constants";
import {
  createLoginHref,
  createSignupHref,
  normalizeCallbackUrl,
} from "@/lib/auth-navigation";
import { serverEnv } from "@/lib/env";

export { createLoginHref, createSignupHref, normalizeCallbackUrl };

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: AppUserRole;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!serverEnv.AUTH_SECRET) {
    return null;
  }

  const session = await getServerSession(getAuthOptions());
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
