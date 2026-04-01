import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { setPlaceReaction } from "@/features/places/repository";
import { placeReactionSchema } from "@/features/places/reaction-schema";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getSessionUser } from "@/lib/session";
import {
  createVisitorId,
  getVisitorIdFromCookie,
  setVisitorIdCookie,
} from "@/lib/visitor-id";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  const existingVisitorId = await getVisitorIdFromCookie();
  const visitorId = user ? null : (existingVisitorId ?? createVisitorId());

  const rateLimit = consumeRateLimit({
    scope: "place_reaction",
    key: user?.id ?? visitorId ?? request.headers.get("x-forwarded-for") ?? "guest",
    limit: 20,
    windowMs: 5 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    const response = NextResponse.json(
      {
        ok: false,
        message: "반응 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
        retryAfterMs: rateLimit.retryAfterMs,
      },
      { status: 429 },
    );

    if (!user && visitorId) {
      setVisitorIdCookie(response, visitorId, request.url);
    }

    return response;
  }

  const body = await request.json();
  const parsed = placeReactionSchema.safeParse(body);

  if (!parsed.success) {
    const response = NextResponse.json(
      {
        ok: false,
        message: "반응 입력값 검증에 실패했습니다.",
        error: parsed.error.flatten(),
      },
      { status: 400 },
    );

    if (!user && visitorId) {
      setVisitorIdCookie(response, visitorId, request.url);
    }

    return response;
  }

  const { id } = await context.params;
  const result = await setPlaceReaction(
    id,
    parsed.data.reaction,
    user
      ? {
          userId: user.id,
          email: user.email,
          name: user.name,
        }
      : {
          visitorId,
        },
  );

  if (result.ok) {
    revalidatePath("/");
    revalidatePath(`/place/${id}`);
    revalidatePath(`/api/places/${id}`);
    revalidatePath("/api/places/map");
  }

  const response = NextResponse.json(result, { status: result.ok ? 200 : 404 });

  if (!user && visitorId) {
    setVisitorIdCookie(response, visitorId, request.url);
  }

  return response;
}
