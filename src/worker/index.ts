import { Hono } from "hono";

import { invalidateMapPreviewCache } from "@/features/places/map-preview-cache";
import {
  WorkerDatabaseUnavailableError,
  withWorkerDatabaseConnection,
} from "@/worker/db";
import {
  createRequestId,
  createWorkerErrorResponse,
  logWorkerError,
  logWorkerRequest,
} from "@/worker/http/errors";
import {
  applySecurityHeaders,
} from "@/worker/http/security-headers";
import { readRequestBodyWithinLimit } from "@/worker/http/request-body";
import { getOrigin } from "@/worker/http/urls";
import { registerAdminRoutes } from "@/worker/routes/admin";
import { registerAuthRoutes } from "@/worker/routes/auth";
import { registerBookmarkRoutes } from "@/worker/routes/bookmarks";
import { registerHealthRoute } from "@/worker/routes/health";
import { registerPlacesReadRoutes } from "@/worker/routes/places-read";
import { registerPublicConfigRoutes } from "@/worker/routes/public-config";
import { registerPublicWriteRoutes } from "@/worker/routes/public-write";
import {
  getMockPublicWriteComments,
  isLocalTurnstileBypassAllowed,
} from "@/worker/routes/public-write-support";
import { registerStaticRoutes } from "@/worker/routes/static";
import { registerTelemetryRoutes } from "@/worker/routes/telemetry";

type AssetFetcher = {
  fetch(request: Request): Promise<Response> | Response;
};

type CloudflareBindings = {
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
  NAVER_MAP_CLIENT_ID?: string;
  NEXTAUTH_URL?: string;
  NEXT_PUBLIC_NAVER_MAP_CLIENT_ID?: string;
  NEXT_PUBLIC_NAVER_MAP_KEY_ID?: string;
  NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string;
  SITE_URL?: string;
  TURNSTILE_BYPASS_TOKEN?: string;
  TURNSTILE_SECRET_KEY?: string;
  USE_MOCK_DATA?: string;
};
type WorkerVariables = {
  requestId: string;
};

const app = new Hono<{
  Bindings: CloudflareBindings;
  Variables: WorkerVariables;
}>();
const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};
const MAX_MUTATION_BODY_BYTES = 256 * 1024;
app.use("*", async (c, next) => {
  const requestId = createRequestId(c.req.raw);
  const startedAt = performance.now();
  c.set("requestId", requestId);

  await next();
  c.header("X-Request-Id", requestId);
  logWorkerRequest(
    c.req.raw,
    requestId,
    c.res.status,
    performance.now() - startedAt,
  );
});

app.use("*", async (c, next) => {
  await next();

  if (c.req.path.startsWith("/api/") && !c.res.headers.has("cache-control")) {
    c.header("Cache-Control", noStoreHeaders["Cache-Control"]);
  }

  c.res = applySecurityHeaders(c.res, c.req.raw);
});

app.onError((error, c) => {
  const requestId = c.get("requestId") || createRequestId(c.req.raw);

  logWorkerError(error, c.req.raw, requestId);

  return createWorkerErrorResponse({
    status: 500,
    code: "INTERNAL_ERROR",
    message: "서버 오류가 발생했습니다.",
    requestId,
    headers: noStoreHeaders,
  });
});

app.use("/api/*", async (c, next) => {
  if (["POST", "PUT", "PATCH"].includes(c.req.method)) {
    const contentLength = Number(c.req.header("content-length"));

    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_MUTATION_BODY_BYTES
    ) {
      return createWorkerErrorResponse({
        status: 413,
        code: "REQUEST_BODY_TOO_LARGE",
        message: "요청 본문이 너무 큽니다.",
        requestId: c.get("requestId"),
        headers: noStoreHeaders,
      });
    }

    const bodyResult = await readRequestBodyWithinLimit(
      c.req.raw,
      MAX_MUTATION_BODY_BYTES,
    );

    if (!bodyResult.ok) {
      return createWorkerErrorResponse({
        status: 413,
        code: "REQUEST_BODY_TOO_LARGE",
        message: "요청 본문이 너무 큽니다.",
        requestId: c.get("requestId"),
        headers: noStoreHeaders,
      });
    }

    const requestBody = bodyResult.body.slice();
    c.req.raw = new Request(c.req.raw, {
      body: requestBody.buffer as ArrayBuffer,
    });
  }

  return await next();
});

app.use("/api/*", async (c, next) => {
  await next();

  if (c.req.method !== "GET" && c.req.method !== "HEAD" && c.res.ok) {
    invalidateMapPreviewCache();
  }
});

async function runWorkerDatabaseRoute<T>(
  env: CloudflareBindings,
  load: () => Promise<T>,
) {
  return withWorkerDatabaseConnection(env, load);
}

function isWorkerDatabaseUnavailableError(error: unknown) {
  return error instanceof WorkerDatabaseUnavailableError;
}

function databaseUnavailableResponse(message: string) {
  return createWorkerErrorResponse({
    status: 503,
    code: "DATABASE_UNAVAILABLE",
    message,
    headers: noStoreHeaders,
  });
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

registerHealthRoute(app, {
  getOrigin,
  isLocalTurnstileBypassAllowed,
  noStoreHeaders,
  runWorkerDatabaseRoute,
});

registerPublicConfigRoutes(app, {
  noStoreHeaders,
});

registerAuthRoutes(app, {
  noStoreHeaders,
  runWorkerDatabaseRoute,
});

registerBookmarkRoutes(app, {
  databaseUnavailableResponse,
  formatDate,
  noStoreHeaders,
});

registerPlacesReadRoutes(app, {
  databaseUnavailableResponse,
  getMockComments: getMockPublicWriteComments,
  isWorkerDatabaseUnavailableError,
  noStoreHeaders,
});

registerPublicWriteRoutes(app, {
  databaseUnavailableResponse,
  formatDate,
});

registerAdminRoutes(app, {
  databaseUnavailableResponse,
  noStoreHeaders,
  runWorkerDatabaseRoute,
});

registerTelemetryRoutes(app, {
  noStoreHeaders,
  runWorkerDatabaseRoute,
});

registerStaticRoutes(app, {
  getOrigin,
});

export default app;
