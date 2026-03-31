import { NextResponse } from "next/server";

import { createReportSubmission } from "@/features/reports/repository";
import { reportSubmissionSchema } from "@/features/reports/schema";
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
  const parsed = reportSubmissionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "신고 입력값 검증에 실패했습니다.",
        error: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  return NextResponse.json(await createReportSubmission(parsed.data, user.id));
}
