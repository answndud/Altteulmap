import { and, eq } from "drizzle-orm";

import { authAccounts, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/features/auth/password";
import type { CredentialsSignupInput } from "@/features/auth/schema";
import {
  listWorkerSocialAuthProviders,
  matchesKnownAccountPassword,
  normalizeEmail,
  toLocalUser,
  trimNickname,
  type WorkerAuthBindings,
  type WorkerAuthUserRecord,
  type WorkerOAuthAccountSyncInput,
} from "@/worker/auth-repository-support";
import {
  getWorkerDb,
  isWorkerDatabaseEnabled,
} from "@/worker/db";

export { listWorkerSocialAuthProviders };
export type { WorkerAuthUserRecord };

async function getWorkerAuthUserByEmail(
  env: WorkerAuthBindings,
  email: string,
) {
  const db = getWorkerDb(env);
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

async function getWorkerCredentialsUserByEmail(
  env: WorkerAuthBindings,
  email: string,
) {
  const db = getWorkerDb(env);
  const normalizedEmail = normalizeEmail(email);
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      nickname: users.nickname,
      role: users.role,
      passwordHash: authAccounts.passwordHash,
    })
    .from(users)
    .leftJoin(
      authAccounts,
      and(
        eq(authAccounts.userId, users.id),
        eq(authAccounts.provider, "credentials"),
        eq(authAccounts.providerAccountId, normalizedEmail),
      ),
    )
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  return user ?? null;
}

export async function verifyWorkerCredentials(
  env: WorkerAuthBindings,
  email: string,
  password: string,
) {
  if (!isWorkerDatabaseEnabled(env)) {
    if (
      !matchesKnownAccountPassword(env, email, password, {
        allowLegacyFallback: true,
      })
    ) {
      return null;
    }

    return toLocalUser(email);
  }

  if (matchesKnownAccountPassword(env, email, password)) {
    return (await getWorkerAuthUserByEmail(env, email)) ?? toLocalUser(email);
  }

  const credentialUser = await getWorkerCredentialsUserByEmail(env, email);

  if (
    credentialUser?.passwordHash &&
    (await verifyPassword(password, credentialUser.passwordHash))
  ) {
    return {
      id: credentialUser.id,
      email: credentialUser.email,
      nickname: credentialUser.nickname,
      role: credentialUser.role,
    };
  }

  return null;
}

export async function createWorkerCredentialsUser(
  env: WorkerAuthBindings,
  input: CredentialsSignupInput,
) {
  if (!isWorkerDatabaseEnabled(env)) {
    return {
      ok: false,
      message: "회원가입은 데이터 연결 후 사용할 수 있습니다.",
      item: null,
    };
  }

  const normalizedEmail = normalizeEmail(input.email);
  const nickname = trimNickname(input.nickname, normalizedEmail);
  const passwordHash = await hashPassword(input.password);
  const db = getWorkerDb(env);

  return await db.transaction(async (tx) => {
    const existingUser = await tx
      .select({
        id: users.id,
      })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (existingUser) {
      return {
        ok: false,
        message: "이미 가입된 이메일입니다. 로그인하거나 기존 소셜 로그인을 사용해주세요.",
        item: null,
      };
    }

    const createdUser = await tx
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

    if (!createdUser) {
      return {
        ok: false,
        message: "회원가입 처리에 실패했습니다. 잠시 후 다시 시도해주세요.",
        item: null,
      };
    }

    await tx.insert(authAccounts).values({
      userId: createdUser.id,
      provider: "credentials",
      providerAccountId: normalizedEmail,
      type: "credentials",
      passwordHash,
    });

    return {
      ok: true,
      message: "회원가입이 완료되었습니다.",
      item: createdUser,
    };
  });
}

export async function syncWorkerOAuthUser(
  env: WorkerAuthBindings,
  input: WorkerOAuthAccountSyncInput,
): Promise<WorkerAuthUserRecord | null> {
  if (!isWorkerDatabaseEnabled(env)) {
    return null;
  }

  const normalizedEmail = normalizeEmail(input.email);
  const nickname = trimNickname(input.name, normalizedEmail);
  const db = getWorkerDb(env);

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

    let userRecord: WorkerAuthUserRecord | null = linkedAccount
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
}
