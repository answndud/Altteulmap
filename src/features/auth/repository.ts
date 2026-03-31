import "server-only";

import { eq } from "drizzle-orm";

import { getDb, isDatabaseEnabled } from "@/db/client";
import { users } from "@/db/schema";
import {
  type AppUserRole,
  authAccountHints,
} from "@/features/auth/constants";
import { serverEnv } from "@/lib/env";

export type AuthUserRecord = {
  id: string;
  email: string;
  nickname: string | null;
  role: AppUserRole;
};

const localAuthUsers: AuthUserRecord[] = [
  {
    id: "local-demo-user",
    email: "demo@altteulmap.local",
    nickname: "근처 주민",
    role: "user",
  },
  {
    id: "local-admin-user",
    email: "admin@altteulmap.local",
    nickname: "운영자",
    role: "admin",
  },
];

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getExpectedPassword(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const account = authAccountHints.find(
    (item) => item.email === normalizedEmail,
  );

  if (!account) {
    return null;
  }

  if (account.role === "admin") {
    return serverEnv.AUTH_ADMIN_PASSWORD;
  }

  return serverEnv.AUTH_DEMO_PASSWORD;
}

function toLocalUser(email: string) {
  const normalizedEmail = normalizeEmail(email);

  return localAuthUsers.find((user) => user.email === normalizedEmail) ?? null;
}

async function getDatabaseUserByEmail(email: string) {
  const db = getDb();
  const normalizedEmail = normalizeEmail(email);
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      nickname: users.nickname,
      role: users.role,
    })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  return user ?? null;
}

async function getDatabaseUserById(id: string) {
  const db = getDb();
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      nickname: users.nickname,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return user ?? null;
}

export async function verifyCredentials(email: string, password: string) {
  const expectedPassword = getExpectedPassword(email);

  if (!expectedPassword || password !== expectedPassword) {
    return null;
  }

  if (!isDatabaseEnabled()) {
    return toLocalUser(email);
  }

  try {
    return await getDatabaseUserByEmail(email);
  } catch (error) {
    console.error("Failed to verify credentials against database.", error);
    return null;
  }
}

export async function getAuthUserById(id: string) {
  if (!isDatabaseEnabled()) {
    return localAuthUsers.find((user) => user.id === id) ?? null;
  }

  try {
    return await getDatabaseUserById(id);
  } catch (error) {
    console.error("Failed to load auth user by id.", error);
    return null;
  }
}
