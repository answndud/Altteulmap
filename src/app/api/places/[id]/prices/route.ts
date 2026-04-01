import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { createPlacePriceReport } from "@/features/places/repository";
import { placePriceReportSchema } from "@/features/places/write-schema";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getSessionUser } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
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
    scope: "place_price_submission",
    key: user.id,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: "가격 제보 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
        retryAfterMs: rateLimit.retryAfterMs,
      },
      { status: 429 },
    );
  }

  const body = await request.json();
  const parsed = placePriceReportSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "가격 제보 입력값 검증에 실패했습니다.",
        error: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const result = await createPlacePriceReport(id, parsed.data, user.id);

  if (result.ok) {
    revalidatePath("/admin");
    revalidatePath("/admin/prices");
    revalidatePath("/api/admin/prices");
    revalidatePath(`/place/${id}`);
    revalidatePath(`/api/places/${id}`);
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
