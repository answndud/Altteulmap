import type { Hono } from "hono";
import { z } from "zod";

import { getSessionFromRequest } from "@/worker/auth/session";
import {
  applyWorkerWriteHeaders,
  getWorkerPublicWriteActor,
} from "@/worker/public-write-actor";
import { recordWorkerVisitActivity } from "@/worker/telemetry-repository";

type AssetFetcher = {
  fetch(request: Request): Promise<Response> | Response;
};

type TelemetryBindings = {
  ASSETS: AssetFetcher;
  AUTH_SECRET?: string;
  DATABASE_URL?: string;
  HYPERDRIVE?: {
    connectionString?: string;
  };
  USE_MOCK_DATA?: string;
};

type TelemetryVariables = {
  requestId: string;
};

type TelemetryRouteDependencies = {
  noStoreHeaders: Record<string, string>;
  runWorkerDatabaseRoute<T>(env: TelemetryBindings, load: () => Promise<T>): Promise<T>;
};

const PLACE_SHARE_SOURCES = [
  "detail",
  "detail_sheet",
  "list",
  "trending",
] as const;

const visitPayloadSchema = z
  .object({
    path: z.string().trim().min(1).max(160),
    ref: z.enum(["share"]).optional(),
    scope: z.enum(["public", "admin"]).default("public"),
    source: z.enum(PLACE_SHARE_SOURCES).optional(),
  })
  .superRefine((value, context) => {
    if (value.source && value.ref !== "share") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "공유 source는 ref=share와 함께 보내야 합니다.",
        path: ["source"],
      });
    }
  });

export function registerTelemetryRoutes(
  app: Hono<{
    Bindings: TelemetryBindings;
    Variables: TelemetryVariables;
  }>,
  dependencies: TelemetryRouteDependencies,
) {
  app.post("/api/telemetry/visit", async (c) => {
    const actor = getWorkerPublicWriteActor(
      c.req.raw,
      getSessionFromRequest(c.req.raw, c.env)?.user ?? null,
      { env: c.env },
    );
    let payload: unknown;

    try {
      payload = await c.req.json();
    } catch {
      return applyWorkerWriteHeaders(
        c.json(
          {
            ok: false,
            message: "방문 이벤트 입력값을 읽지 못했습니다.",
          },
          400,
          dependencies.noStoreHeaders,
        ),
        c.req.raw,
        actor,
      );
    }

    const parsed = visitPayloadSchema.safeParse(payload);

    if (!parsed.success) {
      return applyWorkerWriteHeaders(
        c.json(
          {
            ok: false,
            message: "방문 이벤트 입력값 검증에 실패했습니다.",
            error: parsed.error.flatten(),
          },
          400,
          dependencies.noStoreHeaders,
        ),
        c.req.raw,
        actor,
      );
    }

    try {
      const result = await dependencies.runWorkerDatabaseRoute(c.env, () =>
        recordWorkerVisitActivity(c.env, {
          actorKey: actor.key,
          entryRef: parsed.data.ref ?? null,
          entrySource: parsed.data.source ?? null,
          path: parsed.data.path,
          scope: parsed.data.scope,
          userId: actor.user?.id ?? null,
          visitorId: actor.visitorId,
        }),
      );

      return applyWorkerWriteHeaders(
        c.json(
          {
            ok: true,
            tracked: result.tracked,
            source: result.source,
          },
          200,
          dependencies.noStoreHeaders,
        ),
        c.req.raw,
        actor,
      );
    } catch (error) {
      console.error("Failed to record worker visit activity.", error);

      return applyWorkerWriteHeaders(
        c.json(
          {
            ok: false,
            message: "방문 이벤트를 기록하지 못했습니다.",
          },
          500,
          dependencies.noStoreHeaders,
        ),
        c.req.raw,
        actor,
      );
    }
  });
}
