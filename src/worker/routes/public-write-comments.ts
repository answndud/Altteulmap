import type { Hono } from "hono";

import { getPlaceById } from "@/features/places/queries";
import { placeCommentSchema } from "@/features/places/write-schema";
import { getSessionFromRequest } from "@/worker/auth/session";
import {
  applyWorkerWriteHeaders,
  getWorkerPublicWriteActor,
} from "@/worker/public-write-actor";
import {
  createDatabasePlaceComment,
  deleteDatabasePlaceComment,
} from "@/worker/places-write-comments-repository";
import {
  isWorkerDatabaseEnabled,
  isWorkerMockDataEnabled,
} from "@/worker/db";
import {
  consumePublicWriteRateLimit,
  getTurnstileToken,
  mockCommentStore,
  runWorkerDatabaseRoute,
  verifyTurnstileForPublicWrite,
  type PublicWriteBindings,
  type PublicWriteRouteDependencies,
  type PublicWriteVariables,
} from "@/worker/routes/public-write-support";

export function registerPublicWriteCommentRoutes(
  app: Hono<{
    Bindings: PublicWriteBindings;
    Variables: PublicWriteVariables;
  }>,
  dependencies: PublicWriteRouteDependencies,
) {
  app.post("/api/places/:id/comments", async (c) => {
    const placeId = c.req.param("id");
    const place = getPlaceById(placeId);
    const body = await c.req.json().catch(() => null);
    const parsed = placeCommentSchema.safeParse(body);
    const actor = getWorkerPublicWriteActor(
      c.req.raw,
      getSessionFromRequest(c.req.raw, c.env)?.user ?? null,
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

    if (isWorkerDatabaseEnabled(c.env)) {
      const result = await runWorkerDatabaseRoute(c.env, () =>
        createDatabasePlaceComment(c.env, placeId, parsed.data, actor),
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
        dependencies.databaseUnavailableResponse("코멘트를 저장하지 못했습니다."),
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

    const visitorId = actor.visitorId ?? `user:${actor.user?.id ?? actor.key}`;
    const item = {
      id: `vite-comment-${crypto.randomUUID()}`,
      authorLabel: "익명",
      body: parsed.data.body,
      createdAt: dependencies.formatDate(new Date()),
      canDelete: true,
      ownerVisitorId: visitorId,
    };
    const comments = mockCommentStore.get(placeId) ?? [];

    mockCommentStore.set(placeId, [item, ...comments]);

    return applyWorkerWriteHeaders(
      c.json({
        ok: true,
        message: "코멘트를 등록했습니다.",
        source: "mock",
        mock: true,
        item: {
          id: item.id,
          authorLabel: item.authorLabel,
          body: item.body,
          createdAt: item.createdAt,
          canDelete: item.canDelete,
        },
      }),
      c.req.raw,
      actor,
      rateLimit,
    );
  });

  app.delete("/api/places/:id/comments/:commentId", async (c) => {
    const placeId = c.req.param("id");
    const commentId = c.req.param("commentId");
    const actor = getWorkerPublicWriteActor(
      c.req.raw,
      getSessionFromRequest(c.req.raw, c.env)?.user ?? null,
      {
        createVisitorIfMissing: false,
        env: c.env,
      },
    );

    if (isWorkerDatabaseEnabled(c.env)) {
      if (!actor.user && !actor.visitorId) {
        return c.json(
          {
            ok: false,
            message: "삭제 권한이 없습니다.",
          },
          403,
        );
      }
    }

    const visitorId = actor.visitorId;

    if (isWorkerDatabaseEnabled(c.env)) {
      const result = await runWorkerDatabaseRoute(c.env, () =>
        deleteDatabasePlaceComment(c.env, placeId, commentId, actor),
      );
      const status = result.ok
        ? 200
        : result.message === "삭제 권한이 없습니다."
          ? 403
          : 404;

      return c.json(result, status);
    }

    if (!isWorkerMockDataEnabled(c.env)) {
      return dependencies.databaseUnavailableResponse("코멘트를 삭제하지 못했습니다.");
    }

    const comments = mockCommentStore.get(placeId) ?? [];
    const target = comments.find((comment) => comment.id === commentId);

    if (!visitorId || !target || target.ownerVisitorId !== visitorId) {
      return c.json(
        {
          ok: false,
          message: "삭제 권한이 없습니다.",
          source: "mock",
          mock: true,
          deletedCommentId: null,
        },
        403,
      );
    }

    mockCommentStore.set(
      placeId,
      comments.filter((comment) => comment.id !== commentId),
    );

    return c.json({
      ok: true,
      message: "코멘트를 삭제했습니다.",
      source: "mock",
      mock: true,
      deletedCommentId: commentId,
    });
  });
}
