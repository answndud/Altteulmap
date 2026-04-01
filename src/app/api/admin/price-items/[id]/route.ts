import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { updatePriceItem } from "@/features/places/repository";
import { adminPriceItemUpdateSchema } from "@/features/places/write-schema";
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
  const parsed = adminPriceItemUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "가격 항목 수정 입력값 검증에 실패했습니다.",
        error: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const result = await updatePriceItem(id, parsed.data, user.id);

  if (result.ok) {
    revalidatePath("/admin");
    revalidatePath("/admin/prices");
    revalidatePath("/api/admin/prices");

    if (result.placeId) {
      revalidatePath(`/admin/prices/places/${result.placeId}`);
      revalidatePath(`/place/${result.placeId}`);
      revalidatePath(`/api/places/${result.placeId}`);
    }

    revalidatePath("/");
    revalidatePath("/api/places/map");
  }

  const status = result.ok
    ? 200
    : result.message === "같은 이름의 가격 항목이 이미 있습니다."
      ? 400
      : 404;

  return NextResponse.json(result, { status });
}
