import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { moderatePriceReport } from "@/features/places/repository";
import { priceReportModerationSchema } from "@/features/places/write-schema";
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
  const parsed = priceReportModerationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "가격 제보 검토 입력값 검증에 실패했습니다.",
        error: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const result = await moderatePriceReport(id, parsed.data, user.id);

  if (result.ok && result.item) {
    revalidatePath("/admin");
    revalidatePath("/admin/prices");
    revalidatePath("/api/admin/prices");
    revalidatePath(`/place/${result.item.placeId}`);
    revalidatePath(`/api/places/${result.item.placeId}`);
    revalidatePath("/");
    revalidatePath("/api/places/map");
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
