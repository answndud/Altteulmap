import type { PlaceComment, PlaceReactionType } from "@/features/places/types";
import type { RateLimitPolicyName } from "@/lib/rate-limit";
import { getErrorMessage } from "@/worker/http/errors";
import { getPublicTurnstileSiteKey } from "@/worker/http/public-config";
import {
  consumeWorkerRateLimit,
  type WorkerPublicWriteActor,
} from "@/worker/public-write-actor";
import { consumeWorkerPersistentRateLimit } from "@/worker/rate-limit-repository";
import { withWorkerDatabaseConnection } from "@/worker/db";

export type AssetFetcher = {
  fetch(request: Request): Promise<Response> | Response;
};

export type PublicWriteBindings = {
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

export type PublicWriteVariables = {
  requestId: string;
};

export type PublicWriteRouteDependencies = {
  databaseUnavailableResponse(message: string): Response;
  formatDate(date: Date): string;
};

export const mockCommentStore = new Map<
  string,
  Array<PlaceComment & { ownerVisitorId: string }>
>();
export const mockReactionStore = new Map<string, PlaceReactionType>();

export async function runWorkerDatabaseRoute<T>(
  env: PublicWriteBindings,
  load: () => Promise<T>,
) {
  return withWorkerDatabaseConnection(env, load);
}

export async function consumePublicWriteRateLimit(
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

export function getTurnstileToken(body: unknown) {
  if (!body || typeof body !== "object") {
    return "";
  }

  const value = (body as Record<string, unknown>).turnstileToken;

  return typeof value === "string" ? value.trim() : "";
}

export function isLocalTurnstileBypassAllowed(
  request: Request,
  _env: PublicWriteBindings,
) {
  const hostname = new URL(request.url).hostname;

  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

export async function verifyTurnstileForPublicWrite(
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
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
      },
    );
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

export function getWorkerReactionActorKey(
  placeId: string,
  actor: WorkerPublicWriteActor,
) {
  return `${placeId}:${actor.user?.id ?? actor.visitorId ?? actor.key}`;
}

export function getMockReactionSummary(
  placeId: string,
  actor: WorkerPublicWriteActor,
) {
  const actorKey = getWorkerReactionActorKey(placeId, actor);
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

export function getPlaceReactionMessage(reaction: PlaceReactionType | null) {
  if (reaction === "like") {
    return "좋아요를 남겼습니다.";
  }

  if (reaction === "dislike") {
    return "싫어요를 남겼습니다.";
  }

  return "반응을 취소했습니다.";
}
