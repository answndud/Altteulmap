import type { Hono } from "hono";

import { placeReactionSchema } from "@/features/places/reaction-schema";
import { getSessionFromRequest } from "@/worker/auth/session";
import {
  applyWorkerWriteHeaders,
  getWorkerPublicWriteActor,
} from "@/worker/abuse/public-write-actor";
import { getReactionService } from "@/worker/services/reaction-service";
import {
  consumePublicWriteRateLimit,
  getWorkerPlaceReactionRateLimitActor,
  type PublicWriteBindings,
  type PublicWriteVariables,
} from "@/worker/routes/public-write-support";

export function registerPublicWriteReactionRoutes(
  app: Hono<{
    Bindings: PublicWriteBindings;
    Variables: PublicWriteVariables;
  }>,
) {
  app.put("/api/places/:id/reaction", async (c) => {
    const placeId = c.req.param("id");
    const body = await c.req.json().catch(() => null);
    const parsed = placeReactionSchema.safeParse(body);
    const actor = getWorkerPublicWriteActor(
      c.req.raw,
      (await getSessionFromRequest(c.req.raw, c.env))?.user ?? null,
      { env: c.env },
    );
    if (!parsed.success) {
      return applyWorkerWriteHeaders(
        c.json(
          {
            ok: false,
            message: "반응 입력값 검증에 실패했습니다.",
            error: parsed.error.flatten(),
          },
          400,
        ),
        c.req.raw,
        actor,
      );
    }

    const rateLimit = await consumePublicWriteRateLimit(
      c.env,
      "placeReaction",
      getWorkerPlaceReactionRateLimitActor(placeId, actor),
    );

    if (!rateLimit.ok) {
      return applyWorkerWriteHeaders(
        c.json(
          {
            ok: false,
            message: "반응 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
            retryAfterMs: rateLimit.retryAfterMs,
          },
          429,
        ),
        c.req.raw,
        actor,
        rateLimit,
      );
    }

    const result = await getReactionService(c.env).set(
      placeId,
      parsed.data.reaction,
      actor,
    );

    return applyWorkerWriteHeaders(c.json(result), c.req.raw, actor, rateLimit);
  });
}
