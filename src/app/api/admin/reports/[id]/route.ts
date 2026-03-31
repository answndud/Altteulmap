import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { updateReportStatus } from "@/features/reports/repository";
import { reportModerationSchema } from "@/features/reports/schema";
import { getSessionUser } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
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

  if (user.role !== "admin") {
    return NextResponse.json(
      {
        ok: false,
        message: "운영자 권한이 필요합니다.",
      },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = reportModerationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "신고 상태 검증에 실패했습니다.",
        error: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const result = await updateReportStatus(id, parsed.data, user.id);

  if (result.ok) {
    revalidatePath("/admin");
    revalidatePath("/admin/reports");
    revalidatePath("/api/admin/reports");
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
