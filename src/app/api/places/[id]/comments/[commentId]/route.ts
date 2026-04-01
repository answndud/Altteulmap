import { revalidatePath } from "next/cache";
import { deletePlaceComment } from "@/features/places/repository";
import { getPublicWriteActor } from "@/lib/public-write-actor";

type RouteContext = {
  params: Promise<{
    id: string;
    commentId: string;
  }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const actor = await getPublicWriteActor(request, {
    createVisitorIfMissing: false,
  });

  if (!actor.user && !actor.visitorId) {
    return Response.json(
      {
        ok: false,
        message: "삭제 권한이 없습니다.",
      },
      { status: 403 },
    );
  }

  const { id, commentId } = await context.params;
  const result = await deletePlaceComment(id, commentId, {
    role: actor.user?.role ?? "guest",
    userId: actor.user?.id ?? null,
    visitorId: actor.visitorId,
  });

  if (result.ok) {
    revalidatePath(`/place/${id}`);
    revalidatePath(`/api/places/${id}`);
  }

  const status =
    result.ok ? 200 : result.message === "삭제 권한이 없습니다." ? 403 : 404;

  return Response.json(result, { status });
}
