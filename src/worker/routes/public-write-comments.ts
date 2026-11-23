import type { Hono } from "hono";

import { placeCommentSchema } from "@/features/places/write-schema";
import { getSessionFromRequest } from "@/worker/auth/session";
import {
  applyWorkerWriteHeaders,
  getWorkerPublicWriteActor,
} from "@/worker/abuse/public-write-actor";
import { getCommentService } from "@/worker/services/comment-service";
import {
  consumePublicWriteRateLimit,
  getTurnstileToken,
  verifyTurnstileForPublicWrite,
  type PublicWriteBindings,
  type PublicWriteVariables,
} from "@/worker/routes/public-write-support";

export function registerPublicWriteCommentRoutes(
  app: Hono<{
    Bindings: PublicWriteBindings;
    Variables: PublicWriteVariables;
  }>,
) {
  app.post("/api/places/:id/comments", async (c) => {
    const placeId = c.req.param("id");
    const body = await c.req.json().catch(() => null);
    const parsed = placeCommentSchema.safeParse(body);
    const actor = getWorkerPublicWriteActor(
      c.req.raw,
      (await getSessionFromRequest(c.req.raw, c.env))?.user ?? null,
      { env: c.env },
    );
    const rateLimit = await consumePublicWriteRateLimit(
      c.env,
      "placeCommentSubmission",
      actor,
    );

    if (!rateLimit.ok) {
      return applyWorkerWriteHeaders(
        c.json(
          {
            ok: false,
            message: "코멘트 등록 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
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
            message: "코멘트 입력값 검증에 실패했습니다.",
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

    const result = await getCommentService(c.env).create(
      placeId,
      parsed.data,
      actor,
    );

    return applyWorkerWriteHeaders(c.json(result), c.req.raw, actor, rateLimit);
  });

  app.delete("/api/places/:id/comments/:commentId", async (c) => {
    const placeId = c.req.param("id");
    const commentId = c.req.param("commentId");
    const actor = getWorkerPublicWriteActor(
      c.req.raw,
      (await getSessionFromRequest(c.req.raw, c.env))?.user ?? null,
      {
        createVisitorIfMissing: false,
        env: c.env,
      },
    );

    return c.json(
      await getCommentService(c.env).delete(placeId, commentId, actor),
    );
  });
}
