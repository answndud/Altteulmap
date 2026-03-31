import { NextResponse } from "next/server";

import { createPlaceSubmission } from "@/features/places/repository";
import { placeSubmissionSchema } from "@/features/submission/schema";
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
