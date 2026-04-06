import { revalidateAfterPlaceSubmission } from "@/features/places/revalidation";
import { createPlaceSubmission } from "@/features/places/repository";
import { placeSubmissionSchema } from "@/features/submission/schema";
import {
  getPublicWriteActor,
  setPublicWriteActorCookie,
} from "@/lib/public-write-actor";
import {
  applyRateLimitHeaders,
  consumeRateLimitPolicy,
} from "@/lib/rate-limit";

export async function POST(request: Request) {
  const actor = await getPublicWriteActor(request);

  const rateLimit = consumeRateLimitPolicy("placeSubmission", actor.key);

  if (!rateLimit.ok) {
    const response = Response.json(
      {
        ok: false,
        message: "장소 등록 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
        retryAfterMs: rateLimit.retryAfterMs,
      },
      { status: 429 },
    );

    setPublicWriteActorCookie(response, actor, request);

    return applyRateLimitHeaders(response, rateLimit);
  }

  const body = await request.json();
  const parsed = placeSubmissionSchema.safeParse(body);

  if (!parsed.success) {
    const response = Response.json(
      {
        ok: false,
        message: "입력값 검증에 실패했습니다.",
        error: parsed.error.flatten(),
      },
      { status: 400 },
    );

    setPublicWriteActorCookie(response, actor, request);

    return applyRateLimitHeaders(response, rateLimit);
  }

  const result = await createPlaceSubmission(parsed.data, actor.user?.id ?? null);
  if (result.ok) {
    revalidateAfterPlaceSubmission();
  }
  const response = Response.json(result);

  setPublicWriteActorCookie(response, actor, request);

  return applyRateLimitHeaders(response, rateLimit);
}
