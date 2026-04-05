import { revalidateAfterPlaceReactionMutation } from "@/features/places/revalidation";
import { setPlaceReaction } from "@/features/places/repository";
import { placeReactionSchema } from "@/features/places/reaction-schema";
import {
  getPublicWriteActor,
  setPublicWriteActorCookie,
} from "@/lib/public-write-actor";
import {
  applyRateLimitHeaders,
  consumeRateLimitPolicy,
} from "@/lib/rate-limit";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const actor = await getPublicWriteActor(request);

  const rateLimit = consumeRateLimitPolicy("placeReaction", actor.key);

  if (!rateLimit.ok) {
    const response = Response.json(
      {
        ok: false,
        message: "반응 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
        retryAfterMs: rateLimit.retryAfterMs,
      },
      { status: 429 },
    );

    setPublicWriteActorCookie(response, actor, request);
    return applyRateLimitHeaders(response, rateLimit);
  }

  const body = await request.json();
  const parsed = placeReactionSchema.safeParse(body);

  if (!parsed.success) {
    const response = Response.json(
      {
        ok: false,
        message: "반응 입력값 검증에 실패했습니다.",
        error: parsed.error.flatten(),
      },
      { status: 400 },
    );

    setPublicWriteActorCookie(response, actor, request);
    return applyRateLimitHeaders(response, rateLimit);
  }

  const { id } = await context.params;
  const result = await setPlaceReaction(
    id,
    parsed.data.reaction,
    actor.user
      ? {
          userId: actor.user.id,
          email: actor.user.email,
          name: actor.user.name,
        }
      : {
          visitorId: actor.visitorId,
        },
  );

  if (result.ok) {
    revalidateAfterPlaceReactionMutation(id);
  }

  const response = Response.json(result, { status: result.ok ? 200 : 404 });
  setPublicWriteActorCookie(response, actor, request);
  return applyRateLimitHeaders(response, rateLimit);
}
