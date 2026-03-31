import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { deletePlaceComment } from "@/features/places/repository";
import { getSessionUser } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    id: string;
    commentId: string;
  }>;
};

export async function DELETE(_: Request, context: RouteContext) {
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

  const { id, commentId } = await context.params;
  const result = await deletePlaceComment(id, commentId, {
    userId: user.id,
    role: user.role,
  });

  if (result.ok) {
    revalidatePath(`/place/${id}`);
    revalidatePath(`/api/places/${id}`);
  }

  const status =
    result.ok ? 200 : result.message === "삭제 권한이 없습니다." ? 403 : 404;

  return NextResponse.json(result, { status });
}
