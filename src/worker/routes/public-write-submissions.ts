import type { Hono } from "hono";

import { placeSubmissionSchema } from "@/features/submission/schema";
import { getSessionFromRequest } from "@/worker/auth/session";
import {
  applyWorkerWriteHeaders,
  getWorkerPublicWriteActor,
} from "@/worker/public-write-actor";
import { createDatabasePlaceSubmission } from "@/worker/places-write-repository";
import {
  isWorkerDatabaseEnabled,
  isWorkerMockDataEnabled,
} from "@/worker/db";
import {
  consumePublicWriteRateLimit,
  getTurnstileToken,
  runWorkerDatabaseRoute,
  verifyTurnstileForPublicWrite,
  type PublicWriteBindings,
  type PublicWriteRouteDependencies,
  type PublicWriteVariables,
} from "@/worker/routes/public-write-support";

export function registerPublicWriteSubmissionRoutes(
  app: Hono<{
    Bindings: PublicWriteBindings;
    Variables: PublicWriteVariables;
  }>,
  dependencies: PublicWriteRouteDependencies,
) {
  app.post("/api/places", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = placeSubmissionSchema.safeParse(body);
    const actor = getWorkerPublicWriteActor(
      c.req.raw,
      getSessionFromRequest(c.req.raw, c.env)?.user ?? null,
    );
    const rateLimit = await consumePublicWriteRateLimit(
      c.env,
      "placeSubmission",
      actor,
    );

    if (!rateLimit.ok) {
      return applyWorkerWriteHeaders(
        c.json(
          {
            ok: false,
            message: "장소 등록 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
            retryAfterMs: rateLimit.retryAfterMs,
          },
          429,
        ),
        c.req.raw,
        actor,
        rateLimit,
      );
    }

    if (!parsed.success) {
      return applyWorkerWriteHeaders(
        c.json(
          {
            ok: false,
            message: "입력값 검증에 실패했습니다.",
            error: parsed.error.flatten(),
          },
          400,
        ),
        c.req.raw,
        actor,
        rateLimit,
      );
    }

    const turnstile = await verifyTurnstileForPublicWrite(
      c.env,
      c.req.raw,
      getTurnstileToken(body),
    );

    if (!turnstile.ok) {
      return applyWorkerWriteHeaders(
        c.json(
          {
            ok: false,
            message: turnstile.message,
          },
          turnstile.status,
        ),
        c.req.raw,
        actor,
        rateLimit,
      );
    }

    if (isWorkerDatabaseEnabled(c.env)) {
      const result = await runWorkerDatabaseRoute(c.env, () =>
        createDatabasePlaceSubmission(c.env, parsed.data, actor),
      );

      return applyWorkerWriteHeaders(
        c.json(result),
        c.req.raw,
        actor,
        rateLimit,
      );
    }

    if (!isWorkerMockDataEnabled(c.env)) {
      return applyWorkerWriteHeaders(
        dependencies.databaseUnavailableResponse("장소 등록 요청을 저장하지 못했습니다."),
        c.req.raw,
        actor,
        rateLimit,
      );
    }

    return applyWorkerWriteHeaders(
      c.json({
        ok: true,
        message: "장소 등록 요청이 접수되었습니다. 검토 후 공개 목록에 반영됩니다.",
        mock: true,
        source: "mock",
        preview: {
          id: `vite-submission-${crypto.randomUUID()}`,
          name: parsed.data.name,
          categorySlug: parsed.data.categorySlug,
          roadAddress: parsed.data.roadAddress,
          district: parsed.data.district,
          priceItems: parsed.data.priceItems,
        },
      }),
      c.req.raw,
      actor,
      rateLimit,
    );
  });
}
