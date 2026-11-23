import type { Hono } from "hono";

import { placePriceReportSchema } from "@/features/places/write-schema";
import { getSessionFromRequest } from "@/worker/auth/session";
import {
  applyWorkerWriteHeaders,
  getWorkerPublicWriteActor,
} from "@/worker/public-write-actor";
import { getPriceReportService } from "@/worker/services/price-report-stores";
import {
  consumePublicWriteRateLimit,
  getTurnstileToken,
  verifyTurnstileForPublicWrite,
  type PublicWriteBindings,
  type PublicWriteVariables,
} from "@/worker/routes/public-write-support";

export function registerPublicWritePriceReportRoutes(
  app: Hono<{
    Bindings: PublicWriteBindings;
    Variables: PublicWriteVariables;
  }>,
) {
  app.post("/api/places/:id/prices", async (c) => {
    const placeId = c.req.param("id");
    const body = await c.req.json().catch(() => null);
    const parsed = placePriceReportSchema.safeParse(body);
    const actor = getWorkerPublicWriteActor(
      c.req.raw,
      (await getSessionFromRequest(c.req.raw, c.env))?.user ?? null,
      { env: c.env },
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
            message: "가격 정보 등록이 너무 잦습니다. 잠시 후 다시 시도해 주세요.",
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
            message: "가격 정보 입력값을 확인해 주세요.",
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

    // DB/mock/미설정 선택과 도메인 규칙은 서비스가 맡는다. 실패는 DomainError로 던져 envelope가 된다.
    const result = await getPriceReportService(c.env).submit(
      placeId,
      parsed.data,
      actor,
    );

    return applyWorkerWriteHeaders(c.json(result), c.req.raw, actor, rateLimit);
  });
}
