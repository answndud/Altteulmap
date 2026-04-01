import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { createPlaceComment } from "@/features/places/repository";
import { placeCommentSchema } from "@/features/places/write-schema";
import {
  getPublicWriteActor,
  setPublicWriteActorCookie,
} from "@/lib/public-write-actor";
import { consumeRateLimit } from "@/lib/rate-limit";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const actor = await getPublicWriteActor(request);

  const rateLimit = consumeRateLimit({
    scope: "place_comment_submission",
    key: actor.key,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    const response = NextResponse.json(
      {
        ok: false,
        message: "코멘트 등록 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
        retryAfterMs: rateLimit.retryAfterMs,
      },
      { status: 429 },
    );

    setPublicWriteActorCookie(response, actor, request);

    return response;
  }

  const body = await request.json();
  const parsed = placeCommentSchema.safeParse(body);

  if (!parsed.success) {
    const response = NextResponse.json(
      {
        ok: false,
        message: "코멘트 입력값 검증에 실패했습니다.",
        error: parsed.error.flatten(),
      },
      { status: 400 },
    );

    setPublicWriteActorCookie(response, actor, request);

    return response;
  }

  const { id } = await context.params;
  const result = await createPlaceComment(
    id,
    parsed.data,
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
    revalidatePath(`/place/${id}`);
    revalidatePath(`/api/places/${id}`);
  }

  const response = NextResponse.json(result, { status: result.ok ? 200 : 404 });
  setPublicWriteActorCookie(response, actor, request);
  return response;
}
