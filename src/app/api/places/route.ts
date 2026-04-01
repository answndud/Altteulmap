import { NextResponse } from "next/server";

import { createPlaceSubmission } from "@/features/places/repository";
import { placeSubmissionSchema } from "@/features/submission/schema";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getSessionUser } from "@/lib/session";

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        message: "로그인이 필요합니다.",
      },
      { status: 401 },
    );
  }

  const rateLimit = consumeRateLimit({
    scope: "place_submission",
    key: user.id,
    limit: 5,
    windowMs: 30 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: "장소 등록 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
        retryAfterMs: rateLimit.retryAfterMs,
      },
      { status: 429 },
    );
  }

  const body = await request.json();
  const parsed = placeSubmissionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "입력값 검증에 실패했습니다.",
        error: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  return NextResponse.json(await createPlaceSubmission(parsed.data, user.id));
}
