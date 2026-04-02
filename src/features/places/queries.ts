import { getCategoryBySlug } from "@/features/categories/catalog";
import { mockPlaces } from "@/features/places/catalog-data";
import type {
  PlaceQueryBounds,
  PlaceRecord,
  PlaceSort,
} from "@/features/places/types";

type PlaceQuery = {
  category?: string | null;
  maxPrice?: number | null;
  sort?: PlaceSort;
  bounds?: PlaceQueryBounds | null;
  query?: string | null;
};

export function formatKrw(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

export function sortPlaceRecords(items: PlaceRecord[], sort: PlaceSort) {
  return [...items].sort((left, right) => {
    if (sort === "recent") {
      return (
        new Date(right.lastPriceUpdatedAt).getTime() -
        new Date(left.lastPriceUpdatedAt).getTime()
      );
    }

    return left.representativePriceAmount - right.representativePriceAmount;
  });
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

  return sortPlaceRecords(filtered, sort);
}

export function getPlaceById(id: string) {
  return mockPlaces.find((place) => place.id === id) ?? null;
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
