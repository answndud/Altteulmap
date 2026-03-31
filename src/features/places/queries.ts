import { getCategoryBySlug } from "@/features/categories/catalog";
import { mockPlaces } from "@/features/places/mock-data";
import type { PlaceQueryBounds, PlaceRecord } from "@/features/places/types";

type PlaceQuery = {
  category?: string | null;
  maxPrice?: number | null;
  sort?: "price" | "recent";
  bounds?: PlaceQueryBounds | null;
  query?: string | null;
};

export function formatKrw(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("ko-KR");
}

function matchesPlaceQuery(place: PlaceRecord, query: string) {
  const category = getCategoryBySlug(place.categorySlug);
  const haystack = [
    place.name,
    place.businessName,
    place.address,
    place.district,
    place.representativePriceLabel,
    place.description,
    place.note,
    category?.name,
    category?.parentName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("ko-KR");

  return haystack.includes(query);
}

export function getFilteredPlaces({
  category,
  maxPrice,
  sort = "price",
  bounds,
  query,
}: PlaceQuery = {}) {
  const normalizedQuery = normalizeSearchText(query);
  const filtered = mockPlaces.filter((place) => {
    const categoryMatches = category ? place.categorySlug === category : true;
    const priceMatches = maxPrice
      ? place.representativePriceAmount <= maxPrice
      : true;
    const boundsMatch = bounds
      ? place.latitude >= bounds.minLat &&
        place.latitude <= bounds.maxLat &&
        place.longitude >= bounds.minLng &&
        place.longitude <= bounds.maxLng
      : true;
    const queryMatches = normalizedQuery
      ? matchesPlaceQuery(place, normalizedQuery)
      : true;

    return categoryMatches && priceMatches && boundsMatch && queryMatches;
  });

  return filtered.sort((left, right) => {
    if (sort === "recent") {
      return (
        new Date(right.lastPriceUpdatedAt).getTime() -
        new Date(left.lastPriceUpdatedAt).getTime()
      );
    }

    return left.representativePriceAmount - right.representativePriceAmount;
  });
}

export function getPlaceById(id: string) {
  return mockPlaces.find((place) => place.id === id) ?? null;
}

export function getRelatedPlaces(id: string) {
  const current = getPlaceById(id);

  if (!current) {
    return [];
  }

  const currentCategory = getCategoryBySlug(current.categorySlug);

  return mockPlaces
    .filter((place) => {
      if (place.id === id) {
        return false;
      }

      const placeCategory = getCategoryBySlug(place.categorySlug);

      return placeCategory?.parentSlug === currentCategory?.parentSlug;
    })
    .slice(0, 3);
}

export function getMapBounds() {
  const latitudes = mockPlaces.map((place) => place.latitude);
  const longitudes = mockPlaces.map((place) => place.longitude);

  return {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLng: Math.min(...longitudes),
    maxLng: Math.max(...longitudes),
  };
}
