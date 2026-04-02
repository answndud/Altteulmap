import { revalidatePath } from "next/cache";
import {
  listPendingPlaces,
  moderatePlaceSubmission,
} from "@/features/places/repository";
import { placeModerationSchema } from "@/features/submission/schema";
import { getSessionUser } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!user) {
    return Response.json(
      {
        ok: false,
        message: "로그인이 필요합니다.",
      },
      { status: 401 },
    );
  }

  if (user.role !== "admin") {
    return Response.json(
      {
        ok: false,
        message: "운영자 권한이 필요합니다.",
      },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const result = await listPendingPlaces();
  const item = result.items.find((place) => place.id === id) ?? null;

  return Response.json(
    {
      item,
      source: result.source,
      mock: result.source === "mock",
    },
    { status: item ? 200 : 404 },
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!user) {
    return Response.json(
      {
        ok: false,
        message: "로그인이 필요합니다.",
      },
      { status: 401 },
    );
  }

  if (user.role !== "admin") {
    return Response.json(
      {
        ok: false,
        message: "운영자 권한이 필요합니다.",
      },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = placeModerationSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        message: "장소 검토 입력값 검증에 실패했습니다.",
        error: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const result = await moderatePlaceSubmission(id, parsed.data, user.id);

  if (result.ok) {
    revalidatePath("/admin");
    revalidatePath("/admin/places");
    revalidatePath("/api/admin/places");
    revalidatePath("/");
    revalidatePath("/api/places/map");
    revalidatePath(`/place/${id}`);
    revalidatePath(`/api/places/${id}`);
  }

  return Response.json(result, { status: result.ok ? 200 : 404 });
}
