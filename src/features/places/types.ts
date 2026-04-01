export type PlacePriceItem = {
  id: string;
  label: string;
  amount: number;
  unitLabel?: string;
  verificationStatus: "verified" | "unverified";
  reportedAt: string;
};

export type PlaceComment = {
  id: string;
  authorLabel: string;
  body: string;
  createdAt: string;
  canDelete?: boolean;
};

export type PlaceReactionType = "like" | "dislike";

export type PlaceHistoryEntry = {
  id: string;
  label: string;
  amount: number;
  verificationStatus: "verified" | "unverified";
  recordedAt: string;
};

export type PlaceBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export type PlaceQueryBounds = PlaceBounds;

export type PlaceSearchScope = "viewport" | "global";
export type PlaceSort = "price" | "recent" | "likes";

export type PlaceRecord = {
  id: string;
  name: string;
  businessName?: string;
  categorySlug: string;
  address: string;
  district: string;
  latitude: number;
  longitude: number;
  representativePriceAmount: number;
  representativePriceLabel: string;
  verificationStatus: "verified" | "unverified";
  lastPriceUpdatedAt: string;
  description: string;
  note: string;
  likeCount: number;
  dislikeCount: number;
  viewerReaction: PlaceReactionType | null;
  priceItems: PlacePriceItem[];
  history: PlaceHistoryEntry[];
  comments: PlaceComment[];
};
