import { authAccountHints, type AppUserRole } from "@/features/auth/constants";
import {
  isWorkerDatabaseEnabled,
  type WorkerDatabaseBindings,
} from "@/worker/db";

export type WorkerAuthBindings = WorkerDatabaseBindings & {
  AUTH_ADMIN_PASSWORD?: string;
  AUTH_DEMO_PASSWORD?: string;
  AUTH_KAKAO_CLIENT_ID?: string;
  AUTH_KAKAO_CLIENT_SECRET?: string;
  AUTH_NAVER_CLIENT_ID?: string;
  AUTH_NAVER_CLIENT_SECRET?: string;
};

export type WorkerAuthUserRecord = {
  id: string;
  email: string;
  nickname: string | null;
  role: AppUserRole;
};

type WorkerSocialProviderAvailability = {
  id: "kakao" | "naver";
  label: string;
  enabled: boolean;
  unavailableReason?: string;
};

export type WorkerOAuthAccountSyncInput = {
  provider: "kakao" | "naver";
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

const legacyAuthFallbackPasswords = new Map<string, string>([
  ["demo@altteulmap.local", "demo1234"],
  ["admin@altteulmap.local", "admin1234"],
]);

const localAuthUsers: WorkerAuthUserRecord[] = [
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

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function trimNickname(value: string | null | undefined, email: string) {
  const trimmed = value?.trim();

  if (trimmed) {
    return trimmed.slice(0, 60);
  }

  return normalizeEmail(email).split("@")[0]?.slice(0, 60) ?? "사용자";
}

function getConfiguredPassword(env: WorkerAuthBindings, email: string) {
  const normalizedEmail = normalizeEmail(email);
  const account = authAccountHints.find(
    (item) => item.email === normalizedEmail,
  );

  if (!account) {
    return null;
  }

  if (account.role === "admin") {
    return env.AUTH_ADMIN_PASSWORD ?? null;
  }

  return env.AUTH_DEMO_PASSWORD ?? null;
}

export function matchesKnownAccountPassword(
  env: WorkerAuthBindings,
  email: string,
  password: string,
  options?: {
    allowLegacyFallback?: boolean;
  },
) {
  const configuredPassword = getConfiguredPassword(env, email);

  if (configuredPassword && password === configuredPassword) {
    return true;
  }

  if (!options?.allowLegacyFallback) {
    return false;
  }

  const legacyPassword = legacyAuthFallbackPasswords.get(normalizeEmail(email));
  return Boolean(legacyPassword && password === legacyPassword);
}

export function toLocalUser(email: string) {
  const normalizedEmail = normalizeEmail(email);

  return localAuthUsers.find((user) => user.email === normalizedEmail) ?? null;
}

export function listWorkerSocialAuthProviders(
  env: WorkerAuthBindings,
): WorkerSocialProviderAvailability[] {
  const providers = [
    {
      id: "kakao" as const,
      label: "카카오",
      clientId: env.AUTH_KAKAO_CLIENT_ID,
      clientSecret: env.AUTH_KAKAO_CLIENT_SECRET,
    },
    {
      id: "naver" as const,
      label: "네이버",
      clientId: env.AUTH_NAVER_CLIENT_ID,
      clientSecret: env.AUTH_NAVER_CLIENT_SECRET,
    },
  ];

  return providers.map((provider) => {
    if (!isWorkerDatabaseEnabled(env)) {
      return {
        id: provider.id,
        label: provider.label,
        enabled: false,
        unavailableReason: "데이터 연결 후 사용할 수 있습니다.",
      };
    }

    if (!provider.clientId || !provider.clientSecret) {
      return {
        id: provider.id,
        label: provider.label,
        enabled: false,
        unavailableReason: "로그인 연동 설정이 아직 완료되지 않았습니다.",
      };
    }

    return {
      id: provider.id,
      label: provider.label,
      enabled: true,
    };
  });
}
