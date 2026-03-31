import { NextResponse } from "next/server";

import { getPlaceById, getRelatedPlaces } from "@/features/places/queries";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const place = getPlaceById(id);

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
    related: getRelatedPlaces(id),
    mock: true,
  });
}
