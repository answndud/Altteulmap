import type { Hono } from "hono";

import { placeReactionSchema } from "@/features/places/reaction-schema";
import { getPlaceById } from "@/features/places/queries";
import { getSessionFromRequest } from "@/worker/auth/session";
import {
  applyWorkerWriteHeaders,
  getWorkerPublicWriteActor,
} from "@/worker/public-write-actor";
import { setDatabasePlaceReaction } from "@/worker/places-write-reactions-repository";
import {
  isWorkerDatabaseEnabled,
  isWorkerMockDataEnabled,
} from "@/worker/db";
import {
  consumePublicWriteRateLimit,
  getMockReactionSummary,
  getPlaceReactionMessage,
  getWorkerPlaceReactionRateLimitActor,
  getWorkerReactionActorKey,
  mockReactionStore,
  runWorkerDatabaseRoute,
  type PublicWriteBindings,
  type PublicWriteRouteDependencies,
  type PublicWriteVariables,
} from "@/worker/routes/public-write-support";

export function registerPublicWriteReactionRoutes(
  app: Hono<{
    Bindings: PublicWriteBindings;
    Variables: PublicWriteVariables;
  }>,
  dependencies: PublicWriteRouteDependencies,
) {
  app.put("/api/places/:id/reaction", async (c) => {
    const placeId = c.req.param("id");
    const place = getPlaceById(placeId);
    const body = await c.req.json().catch(() => null);
    const parsed = placeReactionSchema.safeParse(body);
    const actor = getWorkerPublicWriteActor(
      c.req.raw,
      getSessionFromRequest(c.req.raw, c.env)?.user ?? null,
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

    if (isWorkerDatabaseEnabled(c.env)) {
      const result = await runWorkerDatabaseRoute(c.env, () =>
        setDatabasePlaceReaction(c.env, placeId, parsed.data.reaction, actor),
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
        dependencies.databaseUnavailableResponse("장소 반응을 저장하지 못했습니다."),
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
            source: "mock",
            reaction: null,
            likeCount: 0,
            dislikeCount: 0,
            message: "장소를 찾지 못했습니다.",
            placeId,
          },
          404,
        ),
        c.req.raw,
        actor,
        rateLimit,
      );
    }

    const actorKey = getWorkerReactionActorKey(placeId, actor);

    if (parsed.data.reaction) {
      mockReactionStore.set(actorKey, parsed.data.reaction);
    } else {
      mockReactionStore.delete(actorKey);
    }

    const summary = getMockReactionSummary(placeId, actor);

    return applyWorkerWriteHeaders(
      c.json({
        ok: true,
        source: "mock",
        reaction: summary.viewerReaction,
        likeCount: place.likeCount + summary.likeCount,
        dislikeCount: place.dislikeCount + summary.dislikeCount,
        message: getPlaceReactionMessage(summary.viewerReaction),
        placeId,
      }),
      c.req.raw,
      actor,
      rateLimit,
    );
  });
}
