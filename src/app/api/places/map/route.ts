import { NextRequest, NextResponse } from "next/server";

import { listPlaces } from "@/features/places/repository";

function parsePositiveNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseFiniteNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get("category");
  const query = searchParams.get("query")?.trim() || null;
  const searchScope =
    query && searchParams.get("scope") === "global" ? "global" : "viewport";
  const maxPrice = parsePositiveNumber(searchParams.get("maxPrice"));
  const minLat = parseFiniteNumber(searchParams.get("minLat"));
  const maxLat = parseFiniteNumber(searchParams.get("maxLat"));
  const minLng = parseFiniteNumber(searchParams.get("minLng"));
  const maxLng = parseFiniteNumber(searchParams.get("maxLng"));
  const sort =
    searchParams.get("sort") === "recent" ? "recent" : ("price" as const);
  const bounds =
    minLat !== null && maxLat !== null && minLng !== null && maxLng !== null
      ? {
          minLat,
          maxLat,
          minLng,
          maxLng,
        }
      : null;

  const result = await listPlaces({
    category,
    maxPrice,
    query,
    sort,
    bounds: searchScope === "viewport" ? bounds : null,
  });

  return NextResponse.json({
    items: result.items,
    count: result.items.length,
    bounds: result.bounds,
    filters: {
      category,
      maxPrice,
      query,
      searchScope,
      sort,
      bounds: searchScope === "viewport" ? bounds : null,
    },
    source: result.source,
    mock: result.source === "mock",
  });
}
