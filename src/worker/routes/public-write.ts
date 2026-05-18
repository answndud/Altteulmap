import type { Hono } from "hono";

import { reportSubmissionSchema } from "@/features/reports/schema";
import { placeReactionSchema } from "@/features/places/reaction-schema";
import { getPlaceById } from "@/features/places/queries";
import { placePriceReportSchema } from "@/features/places/write-schema";
import { placeSubmissionSchema } from "@/features/submission/schema";
import { getSessionFromRequest } from "@/worker/auth/session";
import {
  applyWorkerWriteHeaders,
  getWorkerPublicWriteActor,
} from "@/worker/public-write-actor";
import { createDatabaseReportSubmission } from "@/worker/reports-write-repository";
import {
  createDatabasePlacePriceReport,
  createDatabasePlaceSubmission,
  setDatabasePlaceReaction,
} from "@/worker/places-write-repository";
import {
  isWorkerDatabaseEnabled,
  isWorkerMockDataEnabled,
} from "@/worker/db";
import {
  consumePublicWriteRateLimit,
  getMockReactionSummary,
  getPlaceReactionMessage,
  getTurnstileToken,
  getWorkerReactionActorKey,
  mockReactionStore,
  runWorkerDatabaseRoute,
  verifyTurnstileForPublicWrite,
  type PublicWriteBindings,
  type PublicWriteRouteDependencies,
  type PublicWriteVariables,
} from "@/worker/routes/public-write-support";
import { registerPublicWriteCommentRoutes } from "@/worker/routes/public-write-comments";

export function registerPublicWriteRoutes(
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

  registerPublicWriteCommentRoutes(app, dependencies);

  app.put("/api/places/:id/reaction", async (c) => {
    const placeId = c.req.param("id");
    const place = getPlaceById(placeId);
    const body = await c.req.json().catch(() => null);
    const parsed = placeReactionSchema.safeParse(body);
    const actor = getWorkerPublicWriteActor(
      c.req.raw,
      getSessionFromRequest(c.req.raw, c.env)?.user ?? null,
    );
    const rateLimit = await consumePublicWriteRateLimit(c.env, "placeReaction", actor);

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

    const summary = getMockReactionSummary(placeId, c.req.raw);

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

  app.post("/api/places", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = placeSubmissionSchema.safeParse(body);
    const actor = getWorkerPublicWriteActor(
      c.req.raw,
      getSessionFromRequest(c.req.raw, c.env)?.user ?? null,
    );
    const rateLimit = await consumePublicWriteRateLimit(c.env, "placeSubmission", actor);

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

  app.post("/api/reports", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = reportSubmissionSchema.safeParse(body);
    const actor = getWorkerPublicWriteActor(
      c.req.raw,
      getSessionFromRequest(c.req.raw, c.env)?.user ?? null,
    );
    const rateLimit = await consumePublicWriteRateLimit(
      c.env,
      "contentReportSubmission",
      actor,
    );

    if (!rateLimit.ok) {
      return applyWorkerWriteHeaders(
        c.json(
          {
            ok: false,
            message: "신고 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
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
            message: "신고 입력값 검증에 실패했습니다.",
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
        createDatabaseReportSubmission(c.env, parsed.data, actor),
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
        dependencies.databaseUnavailableResponse("신고를 저장하지 못했습니다."),
        c.req.raw,
        actor,
        rateLimit,
      );
    }

    return applyWorkerWriteHeaders(
      c.json({
        ok: true,
        message: "신고가 접수되었습니다. 운영 검토 큐에서 바로 확인할 수 있습니다.",
        mock: true,
        source: "mock",
        preview: {
          id: `vite-report-${crypto.randomUUID()}`,
          placeId: parsed.data.placeId,
          placeName: parsed.data.placeName,
          reasonType: parsed.data.reasonType,
          detail: parsed.data.detail,
        },
      }),
      c.req.raw,
      actor,
      rateLimit,
    );
  });
}
