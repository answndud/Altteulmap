import { NextResponse } from "next/server";

import { placeSubmissionSchema } from "@/features/submission/schema";

export async function POST(request: Request) {
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

  return NextResponse.json({
    ok: true,
    message:
      "목업 제출이 완료되었습니다. 현재 단계에서는 DB 저장 없이 payload만 검증합니다.",
    mock: true,
    preview: {
      id: `draft-${Date.now()}`,
      ...parsed.data,
    },
  });
}
