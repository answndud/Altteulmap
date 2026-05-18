import type { Hono } from "hono";

import { getPlaceById } from "@/features/places/queries";
import { placePriceReportSchema } from "@/features/places/write-schema";
import { getSessionFromRequest } from "@/worker/auth/session";
import {
  applyWorkerWriteHeaders,
  getWorkerPublicWriteActor,
} from "@/worker/public-write-actor";
import {
  isWorkerDatabaseEnabled,
  isWorkerMockDataEnabled,
} from "@/worker/db";
import { createDatabasePlacePriceReport } from "@/worker/places-write-repository";
import {
  consumePublicWriteRateLimit,
  getTurnstileToken,
  runWorkerDatabaseRoute,
  verifyTurnstileForPublicWrite,
  type PublicWriteBindings,
  type PublicWriteRouteDependencies,
  type PublicWriteVariables,
} from "@/worker/routes/public-write-support";

export function registerPublicWritePriceReportRoutes(
  app: Hono<{
    Bindings: PublicWriteBindings;
    Variables: PublicWriteVariables;
  }>,
  dependencies: PublicWriteRouteDependencies,
) {
  app.post("/api/places/:id/prices", async (c) => {
    const placeId = c.req.param("id");
    const place = getPlaceById(placeId);
    const body = await c.req.json().catch(() => null);
    const parsed = placePriceReportSchema.safeParse(body);
    const actor = getWorkerPublicWriteActor(
      c.req.raw,
      getSessionFromRequest(c.req.raw, c.env)?.user ?? null,
    );
    const rateLimit = await consumePublicWriteRateLimit(
      c.env,
      "placePriceSubmission",
      actor,
    );

    if (!rateLimit.ok) {
      return applyWorkerWriteHeaders(
        c.json(
          {
            ok: false,
            message: "가격 제보 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
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
            message: "가격 제보 입력값 검증에 실패했습니다.",
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
        createDatabasePlacePriceReport(c.env, placeId, parsed.data, actor),
      );

      return applyWorkerWriteHeaders(
        c.json(result, result.ok ? 200 : 404),
        c.req.raw,
        actor,
        rateLimit,
      );
    }

    if (!isWorkerMockDataEnabled(c.env)) {
      return applyWorkerWriteHeaders(
        dependencies.databaseUnavailableResponse("가격 제보를 저장하지 못했습니다."),
        c.req.raw,
        actor,
        rateLimit,
      );
    }

    if (!place) {
      return applyWorkerWriteHeaders(
        c.json(
          {
            ok: false,
            message: "장소를 찾지 못했습니다.",
            source: "mock",
            mock: true,
            item: null,
          },
          404,
        ),
        c.req.raw,
        actor,
        rateLimit,
      );
    }

    return applyWorkerWriteHeaders(
      c.json({
        ok: true,
        message: "가격 제보가 접수되었습니다. 검토 후 상세 화면에 반영됩니다.",
        source: "mock",
        mock: true,
        item: {
          id: `vite-price-report-${crypto.randomUUID()}`,
          placeId,
          placeName: place.name,
          label: parsed.data.label,
          amount: parsed.data.amount,
          unitLabel: parsed.data.unitLabel || undefined,
          comment: parsed.data.comment || undefined,
        },
      }),
      c.req.raw,
      actor,
      rateLimit,
    );
  });
}
