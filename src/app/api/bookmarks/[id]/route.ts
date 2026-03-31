import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { setBookmark } from "@/features/bookmarks/repository";
import { bookmarkToggleSchema } from "@/features/bookmarks/schema";
import { getSessionUser } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        message: "로그인이 필요합니다.",
        requiresAuth: true,
      },
      { status: 401 },
    );
  }

  const body = await request.json();
  const parsed = bookmarkToggleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "북마크 입력값 검증에 실패했습니다.",
        error: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const result = await setBookmark(id, parsed.data.bookmarked, user);

  if (result.ok) {
    revalidatePath("/bookmarks");
    revalidatePath("/api/bookmarks");
    revalidatePath("/map");
    revalidatePath("/api/places/map");
    revalidatePath(`/place/${id}`);
    revalidatePath(`/api/places/${id}`);
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
