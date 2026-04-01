import "server-only";

import { and, eq } from "drizzle-orm";

import { getDb, isDatabaseEnabled } from "@/db/client";
import { authAccounts, users } from "@/db/schema";
import {
  type AppUserRole,
  type SocialAuthProviderId,
  authAccountHints,
} from "@/features/auth/constants";
import { serverEnv } from "@/lib/env";

export type AuthUserRecord = {
  id: string;
  email: string;
  nickname: string | null;
  role: AppUserRole;
};

export type SocialAuthProviderAvailability = {
  id: SocialAuthProviderId;
  label: string;
  enabled: boolean;
  unavailableReason?: string;
};

type OAuthAccountSyncInput = {
  provider: SocialAuthProviderId;
  providerAccountId: string;
  type: string;
  email: string;
  name?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  tokenType?: string | null;
  scope?: string | null;
  idToken?: string | null;
  sessionState?: string | null;
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

function trimNickname(value: string | null | undefined, email: string) {
  const trimmed = value?.trim();

  if (trimmed) {
    return trimmed.slice(0, 60);
  }

  return normalizeEmail(email).split("@")[0]?.slice(0, 60) ?? "사용자";
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

export function listSocialAuthProviders(): SocialAuthProviderAvailability[] {
  const providers = [
    {
      id: "kakao" as const,
      label: "카카오",
      clientId: serverEnv.AUTH_KAKAO_CLIENT_ID,
      clientSecret: serverEnv.AUTH_KAKAO_CLIENT_SECRET,
    },
    {
      id: "naver" as const,
      label: "네이버",
      clientId: serverEnv.AUTH_NAVER_CLIENT_ID,
      clientSecret: serverEnv.AUTH_NAVER_CLIENT_SECRET,
    },
  ];

  return providers.map((provider) => {
    if (!isDatabaseEnabled()) {
      return {
        id: provider.id,
        label: provider.label,
        enabled: false,
        unavailableReason: "로컬 DB 연결 후 사용할 수 있습니다.",
      };
    }

    if (!provider.clientId || !provider.clientSecret) {
      return {
        id: provider.id,
        label: provider.label,
        enabled: false,
        unavailableReason: `AUTH_${provider.id.toUpperCase()}_CLIENT_ID와 AUTH_${provider.id.toUpperCase()}_CLIENT_SECRET이 필요합니다.`,
      };
    }

    return {
      id: provider.id,
      label: provider.label,
      enabled: true,
    };
  });
}

export async function syncOAuthUser(
  input: OAuthAccountSyncInput,
): Promise<AuthUserRecord | null> {
  if (!isDatabaseEnabled()) {
    return null;
  }

  const normalizedEmail = normalizeEmail(input.email);
  const nickname = trimNickname(input.name, normalizedEmail);
  const db = getDb();

  try {
    return await db.transaction(async (tx) => {
      const linkedAccount = await tx
        .select({
          accountId: authAccounts.id,
          id: users.id,
          email: users.email,
          nickname: users.nickname,
          role: users.role,
        })
        .from(authAccounts)
        .innerJoin(users, eq(authAccounts.userId, users.id))
        .where(
          and(
            eq(authAccounts.provider, input.provider),
            eq(authAccounts.providerAccountId, input.providerAccountId),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null);

      let userRecord = linkedAccount
        ? {
            id: linkedAccount.id,
            email: linkedAccount.email,
            nickname: linkedAccount.nickname,
            role: linkedAccount.role,
          }
        : await tx
            .select({
              id: users.id,
              email: users.email,
              nickname: users.nickname,
              role: users.role,
            })
            .from(users)
            .where(eq(users.email, normalizedEmail))
            .limit(1)
            .then((rows) => rows[0] ?? null);

      if (!userRecord) {
        userRecord = await tx
          .insert(users)
          .values({
            email: normalizedEmail,
            nickname,
          })
          .returning({
            id: users.id,
            email: users.email,
            nickname: users.nickname,
            role: users.role,
          })
          .then((rows) => rows[0] ?? null);
      } else if (!userRecord.nickname && nickname) {
        userRecord = await tx
          .update(users)
          .set({
            nickname,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userRecord.id))
          .returning({
            id: users.id,
            email: users.email,
            nickname: users.nickname,
            role: users.role,
          })
          .then((rows) => rows[0] ?? userRecord);
      }

      if (!userRecord) {
        return null;
      }

      if (linkedAccount) {
        await tx
          .update(authAccounts)
          .set({
            userId: userRecord.id,
            accessToken: input.accessToken ?? null,
            refreshToken: input.refreshToken ?? null,
            expiresAt: input.expiresAt ?? null,
            tokenType: input.tokenType ?? null,
            scope: input.scope ?? null,
            idToken: input.idToken ?? null,
            sessionState: input.sessionState ?? null,
            updatedAt: new Date(),
          })
          .where(eq(authAccounts.id, linkedAccount.accountId));
      } else {
        await tx.insert(authAccounts).values({
          userId: userRecord.id,
          provider: input.provider,
          providerAccountId: input.providerAccountId,
          type: input.type,
          accessToken: input.accessToken ?? null,
          refreshToken: input.refreshToken ?? null,
          expiresAt: input.expiresAt ?? null,
          tokenType: input.tokenType ?? null,
          scope: input.scope ?? null,
          idToken: input.idToken ?? null,
          sessionState: input.sessionState ?? null,
        });
      }

      return userRecord;
    });
  } catch (error) {
    console.error("Failed to sync OAuth user.", error);
    return null;
  }
}
