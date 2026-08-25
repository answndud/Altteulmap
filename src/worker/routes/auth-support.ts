import {
  applyRateLimitHeaders,
  consumeRateLimitPolicy,
  type RateLimitPolicyName,
  type RateLimitResult,
} from "@/lib/rate-limit";
import { consumeWorkerPersistentRateLimit } from "@/worker/rate-limit-repository";

type AssetFetcher = {
  fetch(request: Request): Promise<Response> | Response;
};

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
  NEXTAUTH_URL?: string;
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
  };
  const persistent = await runWorkerDatabaseRoute(env, () =>
    consumeWorkerPersistentRateLimit(env, policyName, actor),
  );

  return persistent ?? consumeRateLimitPolicy(policyName, actorKey);
}

export function applyAuthRateLimitHeaders(
  response: Response,
  rateLimit: RateLimitResult,
) {
  return applyRateLimitHeaders(response, rateLimit);
}
