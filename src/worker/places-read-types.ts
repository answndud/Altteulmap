import type {
  PlaceBounds,
  PlaceMapClusterMarkerRecord,
  PlaceMapPlaceMarkerRecord,
  PlacePreviewRecord,
  PlaceQueryBounds,
  PlaceRecord,
  PlaceSort,
} from "@/features/places/types";

export type DataSource = "database" | "mock";

export type WorkerPlaceViewer = {
  role: "user" | "admin" | "guest";
  userId?: string | null;
  visitorId?: string | null;
} | null;

export type PlaceQuery = {
  category?: string | null;
  sort?: PlaceSort;
  bounds?: PlaceQueryBounds | null;
  query?: string | null;
  zoom?: number | null;
};

export type DatabasePlaceRow = {
  internalId: string;
  slug: string;
  name: string;
  businessName: string | null;
  description: string | null;
  note: string | null;
  roadAddress: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
  primaryCategorySlug: string | null;
  representativePriceAmount: number | null;
  representativePriceLabel: string | null;
  likeCount: number;
  dislikeCount: number;
  verifiedPriceItemCount: number;
  lastPriceUpdatedAt: Date | null;
};

export type WorkerMapPlacesResult = {
  items: PlacePreviewRecord[];
  mapMarkers: Array<PlaceMapPlaceMarkerRecord | PlaceMapClusterMarkerRecord>;
  markerMode: "place" | "cluster";
  bounds: PlaceBounds | null;
  count: number;
  source: DataSource;
  cacheStatus: "bypass" | "hit" | "miss";
};

export type WorkerPlaceDetailResult = {
  item: PlaceRecord | null;
  source: DataSource;
};
