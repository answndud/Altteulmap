import { revalidateAfterPlacePriceSubmission } from "@/features/places/revalidation";
import { createPlacePriceReport } from "@/features/places/repository";
import { placePriceReportSchema } from "@/features/places/write-schema";
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

export async function POST(request: Request, context: RouteContext) {
  const actor = await getPublicWriteActor(request);

  const rateLimit = consumeRateLimitPolicy("placePriceSubmission", actor.key);

  if (!rateLimit.ok) {
    const response = Response.json(
      {
        ok: false,
        message: "가격 제보 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
        retryAfterMs: rateLimit.retryAfterMs,
      },
      { status: 429 },
    );

    setPublicWriteActorCookie(response, actor, request);

    return applyRateLimitHeaders(response, rateLimit);
  }

  const body = await request.json();
  const parsed = placePriceReportSchema.safeParse(body);

  if (!parsed.success) {
    const response = Response.json(
      {
        ok: false,
        message: "가격 제보 입력값 검증에 실패했습니다.",
        error: parsed.error.flatten(),
      },
      { status: 400 },
    );

    setPublicWriteActorCookie(response, actor, request);

    return applyRateLimitHeaders(response, rateLimit);
  }

  const { id } = await context.params;
  const result = await createPlacePriceReport(id, parsed.data, actor.user?.id ?? null);

  if (result.ok) {
    revalidateAfterPlacePriceSubmission(id);
  }

  const response = Response.json(result, { status: result.ok ? 200 : 404 });
  setPublicWriteActorCookie(response, actor, request);
  return applyRateLimitHeaders(response, rateLimit);
}
