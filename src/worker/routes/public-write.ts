import type { Hono } from "hono";

import { reportSubmissionSchema } from "@/features/reports/schema";
import { placeReactionSchema } from "@/features/places/reaction-schema";
import { getPlaceById } from "@/features/places/queries";
import type { PlaceComment, PlaceReactionType } from "@/features/places/types";
import {
  placeCommentSchema,
  placePriceReportSchema,
} from "@/features/places/write-schema";
import { placeSubmissionSchema } from "@/features/submission/schema";
import { getSessionFromRequest } from "@/worker/auth/session";
import {
  getOrCreateVisitorId,
  getVisitorIdFromCookie,
} from "@/worker/http/cookies";
import { getErrorMessage } from "@/worker/http/errors";
import { getPublicTurnstileSiteKey } from "@/worker/http/public-config";
import {
  applyWorkerWriteHeaders,
  consumeWorkerRateLimit,
  getWorkerPublicWriteActor,
  type WorkerPublicWriteActor,
} from "@/worker/public-write-actor";
import { consumeWorkerPersistentRateLimit } from "@/worker/rate-limit-repository";
import { createDatabaseReportSubmission } from "@/worker/reports-write-repository";
import {
  createDatabasePlaceComment,
  createDatabasePlacePriceReport,
  createDatabasePlaceSubmission,
  deleteDatabasePlaceComment,
  setDatabasePlaceReaction,
} from "@/worker/places-write-repository";
import {
  isWorkerDatabaseEnabled,
  isWorkerMockDataEnabled,
  withWorkerDatabaseConnection,
} from "@/worker/db";
import type { RateLimitPolicyName } from "@/lib/rate-limit";

type AssetFetcher = {
  fetch(request: Request): Promise<Response> | Response;
};

type PublicWriteBindings = {
  ASSETS: AssetFetcher;
  AUTH_SECRET?: string;
  DATABASE_URL?: string;
  HYPERDRIVE?: {
    connectionString?: string;
  };
  NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string;
  TURNSTILE_BYPASS_TOKEN?: string;
  TURNSTILE_SECRET_KEY?: string;
  USE_MOCK_DATA?: string;
};

type PublicWriteVariables = {
  requestId: string;
};

type PublicWriteRouteDependencies = {
  databaseUnavailableResponse(message: string): Response;
  formatDate(date: Date): string;
};

const mockCommentStore = new Map<
  string,
  Array<PlaceComment & { ownerVisitorId: string }>
>();
const mockReactionStore = new Map<string, PlaceReactionType>();

async function runWorkerDatabaseRoute<T>(
  env: PublicWriteBindings,
  load: () => Promise<T>,
) {
  return withWorkerDatabaseConnection(env, load);
}

async function consumePublicWriteRateLimit(
  env: PublicWriteBindings,
  policyName: RateLimitPolicyName,
  actor: WorkerPublicWriteActor,
) {
  return (
    (await runWorkerDatabaseRoute(env, () =>
      consumeWorkerPersistentRateLimit(env, policyName, actor),
    )) ?? consumeWorkerRateLimit(policyName, actor)
  );
}

function getTurnstileToken(body: unknown) {
  if (!body || typeof body !== "object") {
    return "";
  }

  const value = (body as Record<string, unknown>).turnstileToken;

  return typeof value === "string" ? value.trim() : "";
}

export function isLocalTurnstileBypassAllowed(
  request: Request,
  env: PublicWriteBindings,
) {
  const hostname = new URL(request.url).hostname;

  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    env.USE_MOCK_DATA === "true"
  );
}

async function verifyTurnstileForPublicWrite(
  env: PublicWriteBindings,
  request: Request,
  token: string,
) {
  const canUseLocalBypass = isLocalTurnstileBypassAllowed(request, env);
  const bypassToken = env.TURNSTILE_BYPASS_TOKEN?.trim();

  if (
    canUseLocalBypass &&
    (!getPublicTurnstileSiteKey(env) ||
      !env.TURNSTILE_SECRET_KEY ||
      (Boolean(bypassToken) && token === bypassToken))
  ) {
    return { ok: true as const, bypass: true };
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    return {
      ok: false as const,
      status: 503 as const,
      message: "보안 확인 설정이 필요합니다. 잠시 후 다시 시도해주세요.",
    };
  }

  if (!token) {
    return {
      ok: false as const,
      status: 400 as const,
      message: "보안 확인을 완료해주세요.",
    };
  }

  const formData = new FormData();
  formData.set("secret", env.TURNSTILE_SECRET_KEY);
  formData.set("response", token);

  const remoteIp = request.headers.get("CF-Connecting-IP");
  if (remoteIp) {
    formData.set("remoteip", remoteIp);
  }

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });
    const result = (await response.json().catch(() => null)) as
      | { success?: boolean; "error-codes"?: string[] }
      | null;

    if (response.ok && result?.success === true) {
      return { ok: true as const, bypass: false };
    }
  } catch (error) {
    console.error("Failed to verify Turnstile token.", {
      message: getErrorMessage(error),
    });
  }

  return {
    ok: false as const,
    status: 403 as const,
    message: "보안 확인에 실패했습니다. 새로고침 후 다시 시도해주세요.",
  };
}

export function getMockPublicWriteComments(
  placeId: string,
  visitorId: string | null,
) {
  return (mockCommentStore.get(placeId) ?? []).map((comment) => ({
    id: comment.id,
    authorLabel: comment.authorLabel,
    body: comment.body,
    createdAt: comment.createdAt,
    canDelete: Boolean(visitorId && comment.ownerVisitorId === visitorId),
  }));
}

function getReactionActorKey(placeId: string, request: Request) {
  return `${placeId}:${getOrCreateVisitorId(request)}`;
}

function getWorkerReactionActorKey(
  placeId: string,
  actor: WorkerPublicWriteActor,
) {
  return `${placeId}:${actor.user?.id ?? actor.visitorId ?? actor.key}`;
}

function getMockReactionSummary(placeId: string, request: Request) {
  const actorKey = getReactionActorKey(placeId, request);
  let likeCount = 0;
  let dislikeCount = 0;

  for (const [key, reaction] of mockReactionStore) {
    if (!key.startsWith(`${placeId}:`)) {
      continue;
    }

    if (reaction === "like") {
      likeCount += 1;
    } else {
      dislikeCount += 1;
    }
  }

  return {
    actorKey,
    dislikeCount,
    likeCount,
    viewerReaction: mockReactionStore.get(actorKey) ?? null,
  };
}

function getPlaceReactionMessage(reaction: PlaceReactionType | null) {
  if (reaction === "like") {
    return "좋아요를 남겼습니다.";
  }

  if (reaction === "dislike") {
    return "싫어요를 남겼습니다.";
  }

  return "반응을 취소했습니다.";
}

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

  app.post("/api/places/:id/comments", async (c) => {
    const placeId = c.req.param("id");
    const place = getPlaceById(placeId);
    const body = await c.req.json().catch(() => null);
    const parsed = placeCommentSchema.safeParse(body);
    const actor = getWorkerPublicWriteActor(
      c.req.raw,
      getSessionFromRequest(c.req.raw, c.env)?.user ?? null,
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

    const visitorId = actor.visitorId ?? getOrCreateVisitorId(c.req.raw);
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

    const visitorId = getVisitorIdFromCookie(c.req.header("cookie") ?? null);

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
