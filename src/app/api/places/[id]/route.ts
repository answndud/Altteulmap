import { NextResponse } from "next/server";

import { getPlaceDetail } from "@/features/places/repository";
import { getSessionUser } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const user = await getSessionUser();
  const result = await getPlaceDetail(
    id,
    user
      ? {
          userId: user.id,
          role: user.role,
        }
      : null,
  );
  const place = result.item;

  if (!place) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Place not found",
        },
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    item: place,
    related: result.related,
    source: result.source,
    mock: result.source === "mock",
  });
}
