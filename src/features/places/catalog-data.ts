import importedGoodpricePlaces from "@/features/places/imported-goodprice.json";
import { mockPlaces as fallbackMockPlaces } from "@/features/places/mock-data";
import type { PlaceRecord } from "@/features/places/types";

const importedPlaces = importedGoodpricePlaces as PlaceRecord[];

export const mockPlaces: PlaceRecord[] =
  importedPlaces.length > 0 ? importedPlaces : fallbackMockPlaces;
