import type { Hono } from "hono";

import { placeSubmissionSchema } from "@/features/submission/schema";
import { getSessionFromRequest } from "@/worker/auth/session";
import {
  applyWorkerWriteHeaders,
  getWorkerPublicWriteActor,
} from "@/worker/abuse/public-write-actor";
import { getSubmissionService } from "@/worker/services/submission-service";
import {
  consumePublicWriteRateLimit,
  getTurnstileToken,
  verifyTurnstileForPublicWrite,
  type PublicWriteBindings,
  type PublicWriteVariables,
} from "@/worker/routes/public-write-support";

export function registerPublicWriteSubmissionRoutes(
  app: Hono<{
    Bindings: PublicWriteBindings;
    Variables: PublicWriteVariables;
  }>,
) {
  app.post("/api/places", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = placeSubmissionSchema.safeParse(body);
    const actor = getWorkerPublicWriteActor(
      c.req.raw,
      (await getSessionFromRequest(c.req.raw, c.env))?.user ?? null,
      { env: c.env },
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

    const result = await getSubmissionService(c.env).submit(parsed.data, actor);

    return applyWorkerWriteHeaders(c.json(result), c.req.raw, actor, rateLimit);
  });
}
