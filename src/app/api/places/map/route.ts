import { NextRequest, NextResponse } from "next/server";

import { getFilteredPlaces, getMapBounds } from "@/features/places/queries";

function parsePositiveNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get("category");
  const maxPrice = parsePositiveNumber(searchParams.get("maxPrice"));
  const sort =
    searchParams.get("sort") === "recent" ? "recent" : ("price" as const);

  const places = getFilteredPlaces({
    category,
    maxPrice,
    sort,
  });

  return NextResponse.json({
    items: places,
    count: places.length,
    bounds: getMapBounds(),
    filters: {
      category,
      maxPrice,
      sort,
    },
    mock: true,
  });
}
