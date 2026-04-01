import { NextResponse } from "next/server";

import { getPlaceDetail } from "@/features/places/repository";
import { getSessionUser } from "@/lib/session";
import { getVisitorIdFromCookie } from "@/lib/visitor-id";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const user = await getSessionUser();
  const visitorId = user ? null : await getVisitorIdFromCookie();
  const result = await getPlaceDetail(
    id,
    user
      ? {
          userId: user.id,
          role: user.role,
        }
      : visitorId
        ? {
            role: "guest",
            visitorId,
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
      {
        status: 404,
        headers: noStoreHeaders,
      },
    );
  }

  return NextResponse.json(
    {
      item: place,
      source: result.source,
      mock: result.source === "mock",
    },
    {
      headers: noStoreHeaders,
    },
  );
}
