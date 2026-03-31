import { NextResponse } from "next/server";

import { listBookmarks } from "@/features/bookmarks/repository";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
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

  const result = await listBookmarks(user);

  return NextResponse.json({
    items: result.items,
    count: result.items.length,
    source: result.source,
    userLabel: result.userLabel,
    mock: result.source === "mock",
  });
}
