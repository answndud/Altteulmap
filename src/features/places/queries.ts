import { getCategoryBySlug } from "@/features/categories/catalog";
import { mockPlaces } from "@/features/places/mock-data";

type PlaceQuery = {
  category?: string | null;
  maxPrice?: number | null;
  sort?: "price" | "recent";
};

export function formatKrw(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

export function getFilteredPlaces({
  category,
  maxPrice,
  sort = "price",
}: PlaceQuery = {}) {
  const filtered = mockPlaces.filter((place) => {
    const categoryMatches = category ? place.categorySlug === category : true;
    const priceMatches = maxPrice
      ? place.representativePriceAmount <= maxPrice
      : true;

    return categoryMatches && priceMatches;
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
