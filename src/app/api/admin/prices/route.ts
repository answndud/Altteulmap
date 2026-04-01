import { listPendingPriceReports } from "@/features/places/repository";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
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

  const result = await listPendingPriceReports();

  return Response.json({
    items: result.items,
    count: result.items.length,
    source: result.source,
    mock: result.source === "mock",
  });
}
