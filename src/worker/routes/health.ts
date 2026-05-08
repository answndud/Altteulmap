import type { Hono } from "hono";

import {
  getWorkerDb,
  getWorkerDatabaseConnectionSource,
  isWorkerDatabaseEnabled,
  isWorkerMockDataEnabled,
} from "@/worker/db";
import {
  getPublicNaverMapKeyId,
  getPublicTurnstileSiteKey,
} from "@/worker/http/public-config";
import { getErrorMessage } from "@/worker/http/errors";
import { listWorkerSocialAuthProviders } from "@/worker/auth-repository";
import { sql } from "drizzle-orm";

type AssetFetcher = {
  fetch(request: Request): Promise<Response> | Response;
};

type HealthBindings = {
  ASSETS: AssetFetcher;
  AUTH_KAKAO_CLIENT_ID?: string;
  AUTH_KAKAO_CLIENT_SECRET?: string;
  AUTH_NAVER_CLIENT_ID?: string;
  AUTH_NAVER_CLIENT_SECRET?: string;
  DATABASE_URL?: string;
  HYPERDRIVE?: {
    connectionString?: string;
  };
  NAVER_MAP_CLIENT_ID?: string;
  NEXTAUTH_URL?: string;
  NEXT_PUBLIC_NAVER_MAP_CLIENT_ID?: string;
  NEXT_PUBLIC_NAVER_MAP_KEY_ID?: string;
  NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string;
  SITE_URL?: string;
  TURNSTILE_SECRET_KEY?: string;
  USE_MOCK_DATA?: string;
};

type HealthCheckStatus = "ok" | "degraded" | "fail";
type HealthCheck = {
  name: string;
  status: HealthCheckStatus;
  [key: string]: unknown;
};

type HealthRouteDependencies<TBindings extends HealthBindings> = {
  getOrigin(request: Request, siteUrl?: string): string;
  isLocalTurnstileBypassAllowed(request: Request, env: TBindings): boolean;
  noStoreHeaders: Record<string, string>;
  runWorkerDatabaseRoute<T>(env: TBindings, load: () => Promise<T>): Promise<T>;
};

function getHealthStatus(checks: Array<{ status: HealthCheckStatus }>) {
  if (checks.some((check) => check.status === "fail")) {
    return "fail" satisfies HealthCheckStatus;
  }

  if (checks.some((check) => check.status === "degraded")) {
    return "degraded" satisfies HealthCheckStatus;
  }

  return "ok" satisfies HealthCheckStatus;
}

async function getDatabaseHealthCheck<TBindings extends HealthBindings>(
  env: TBindings,
  runWorkerDatabaseRoute: HealthRouteDependencies<TBindings>["runWorkerDatabaseRoute"],
) {
  if (isWorkerMockDataEnabled(env)) {
    return {
      name: "database",
      status: "degraded" as const,
      source: "mock" as const,
      message: "USE_MOCK_DATA=true",
    };
  }

  const connectionSource = getWorkerDatabaseConnectionSource(env);

  if (connectionSource === "missing") {
    return {
      name: "database",
      status: "fail" as const,
      source: "missing" as const,
      message: "HYPERDRIVE or DATABASE_URL is missing",
    };
  }

  try {
    const startedAt = Date.now();

    await runWorkerDatabaseRoute(env, async () => {
      const db = getWorkerDb(env);
      await db.execute(sql`select 1 as ok`);
    });

    return {
      name: "database",
      status: "ok" as const,
      source: connectionSource,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      name: "database",
      status: "fail" as const,
      source: connectionSource,
      message: getErrorMessage(error),
    };
  }
}

async function getStaticAssetHealthCheck(env: HealthBindings, request: Request) {
  try {
    const assetUrl = new URL("/", request.url);
    const response = await env.ASSETS.fetch(
      new Request(assetUrl, {
        headers: {
          Accept: "text/html",
        },
      }),
    );

    return {
      name: "static-assets",
      status: response.ok ? "ok" as const : "fail" as const,
      statusCode: response.status,
      contentType: response.headers.get("content-type") ?? "",
    };
  } catch (error) {
    return {
      name: "static-assets",
      status: "fail" as const,
      message: getErrorMessage(error),
    };
  }
}

export function registerHealthRoute(
  app: Hono<{ Bindings: HealthBindings; Variables: { requestId: string } }>,
  dependencies: HealthRouteDependencies<HealthBindings>,
) {
  app.get("/api/health", async (c) => {
    const isDeepCheck = c.req.query("deep") === "1";
    const origin = dependencies.getOrigin(c.req.raw, c.env.SITE_URL ?? c.env.NEXTAUTH_URL);
    const oauthProviders = listWorkerSocialAuthProviders(c.env);
    const hasNaverMapKey = Boolean(getPublicNaverMapKeyId(c.env));
    const hasTurnstileSiteKey = Boolean(getPublicTurnstileSiteKey(c.env));
    const hasTurnstileSecret = Boolean(c.env.TURNSTILE_SECRET_KEY);
    const hasTurnstileConfig =
      (hasTurnstileSiteKey && hasTurnstileSecret) ||
      dependencies.isLocalTurnstileBypassAllowed(c.req.raw, c.env);
    const checks: HealthCheck[] = [
      {
        name: "runtime",
        status: "ok" as const,
        runtime: "cloudflare-worker",
      },
      {
        name: "public-config",
        status: hasNaverMapKey && hasTurnstileConfig ? "ok" as const : "fail" as const,
        naverMapKey: hasNaverMapKey,
        turnstileSiteKey: hasTurnstileSiteKey,
        turnstileSecret: hasTurnstileSecret,
        turnstileLocalBypass:
          (!hasTurnstileSiteKey || !hasTurnstileSecret) && hasTurnstileConfig,
      },
      {
        name: "auth-providers",
        status: oauthProviders.every((provider) => provider.enabled)
          ? "ok" as const
          : "degraded" as const,
        credentials: true,
        kakao: oauthProviders.find((provider) => provider.id === "kakao")?.enabled ?? false,
        naver: oauthProviders.find((provider) => provider.id === "naver")?.enabled ?? false,
      },
    ];

    if (isDeepCheck) {
      checks.push(await getDatabaseHealthCheck(c.env, dependencies.runWorkerDatabaseRoute));
      checks.push(await getStaticAssetHealthCheck(c.env, c.req.raw));
    } else {
      checks.push({
        name: "database-config",
        status: isWorkerDatabaseEnabled(c.env) ? "ok" as const : "degraded" as const,
        source: isWorkerMockDataEnabled(c.env)
          ? "mock"
          : getWorkerDatabaseConnectionSource(c.env),
      });
    }

    const status = getHealthStatus(checks);

    return c.json(
      {
        ok: status === "ok",
        status,
        app: "altteulmap",
        runtime: "cloudflare-worker",
        origin,
        checkedAt: new Date().toISOString(),
        deep: isDeepCheck,
        checks,
      },
      status === "fail" ? 503 : 200,
      dependencies.noStoreHeaders,
    );
  });
}
