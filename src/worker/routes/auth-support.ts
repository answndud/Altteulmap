import type { AssetFetcher } from "@/worker/http/bindings";
import {
  applyRateLimitHeaders,
  consumeRateLimitPolicy,
  type RateLimitPolicyName,
  type RateLimitResult,
} from "@/lib/rate-limit";
import {
  ACCOUNT_LIMIT_MULTIPLIER,
  consumeWorkerPersistentRateLimit,
} from "@/worker/abuse/rate-limit-repository";

export type AuthBindings = {
  ASSETS: AssetFetcher;
  AUTH_ADMIN_PASSWORD?: string;
  AUTH_DEMO_PASSWORD?: string;
  AUTH_SECRET?: string;
  AUTH_KAKAO_CLIENT_ID?: string;
  AUTH_KAKAO_CLIENT_SECRET?: string;
  AUTH_NAVER_CLIENT_ID?: string;
  AUTH_NAVER_CLIENT_SECRET?: string;
  DATABASE_URL?: string;
  HYPERDRIVE?: {
    connectionString?: string;
  };
  SITE_URL?: string;
  USE_MOCK_DATA?: string;
};

export type AuthRouteDependencies<TBindings extends AuthBindings> = {
  noStoreHeaders: Record<string, string>;
  runWorkerDatabaseRoute<T>(env: TBindings, load: () => Promise<T>): Promise<T>;
};

export async function consumeAuthRateLimit(
  env: AuthBindings,
  policyName: Extract<RateLimitPolicyName, "authLogin" | "authSignup">,
  request: Request,
  discriminator: string,
  runWorkerDatabaseRoute: <T>(env: AuthBindings, load: () => Promise<T>) => Promise<T>,
) {
  const clientIp = request.headers.get("CF-Connecting-IP")?.trim() || "unknown";
  const actorKey = `${clientIp}:${discriminator}`.slice(0, 160);
  const actor = {
    user: null,
    visitorId: null,
    visitorCookieValue: null,
    key: actorKey,
    ip: null,
  };
  // 로그인은 IP를 분산해도 같은 계정을 계속 시도할 수 없도록 계정 단위 버킷을 더한다.
  const persistent = await runWorkerDatabaseRoute(env, () =>
    consumeWorkerPersistentRateLimit(env, policyName, actor, {
      extraKeys:
        policyName === "authLogin"
          ? [
              {
                key: `account:${discriminator}`,
                limitMultiplier: ACCOUNT_LIMIT_MULTIPLIER,
              },
            ]
          : [],
    }),
  );

  return persistent ?? consumeRateLimitPolicy(policyName, actorKey);
}

export function applyAuthRateLimitHeaders(
  response: Response,
  rateLimit: RateLimitResult,
) {
  return applyRateLimitHeaders(response, rateLimit);
}
