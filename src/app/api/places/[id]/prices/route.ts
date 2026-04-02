import { revalidatePath } from "next/cache";
import { createPlacePriceReport } from "@/features/places/repository";
import { placePriceReportSchema } from "@/features/places/write-schema";
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
    scope: "place_price_submission",
    key: actor.key,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    const response = Response.json(
      {
        ok: false,
        message: "가격 제보 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
        retryAfterMs: rateLimit.retryAfterMs,
      },
      { status: 429 },
    );

    setPublicWriteActorCookie(response, actor, request);

    return response;
  }

  const body = await request.json();
  const parsed = placePriceReportSchema.safeParse(body);

  if (!parsed.success) {
    const response = Response.json(
      {
        ok: false,
        message: "가격 제보 입력값 검증에 실패했습니다.",
        error: parsed.error.flatten(),
      },
      { status: 400 },
    );

    setPublicWriteActorCookie(response, actor, request);

    return response;
  }

  const { id } = await context.params;
  const result = await createPlacePriceReport(id, parsed.data, actor.user?.id ?? null);

  if (result.ok) {
    revalidatePath("/admin");
    revalidatePath("/admin/prices");
    revalidatePath("/api/admin/prices");
    revalidatePath(`/place/${id}`);
    revalidatePath(`/api/places/${id}`);
  }

  const response = Response.json(result, { status: result.ok ? 200 : 404 });
  setPublicWriteActorCookie(response, actor, request);
  return response;
}
