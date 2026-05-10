export type AdminSessionUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
};

export type AdminSession = {
  user?: AdminSessionUser;
  expires?: string;
};

export type AdminListResponse<T> = {
  items: T[];
  count: number;
  source: "database" | "mock";
  mock: boolean;
};

export type AdminActionResult<T> = {
  ok: boolean;
  message: string;
  source: "database" | "mock";
  item: T | null;
};

export type ModerationSuggestion = {
  suggestedAction: "approve" | "review" | "reject";
  confidence: number;
  summary: string;
  checks: string[];
  flags: string[];
};

export type PendingPlace = {
  id: string;
  name: string;
  businessName?: string;
  categorySlug: string;
  address: string;
  district: string;
  note: string;
  representativePriceAmount: number;
  representativePriceLabel: string;
  createdAt: string;
  latitude?: number;
  longitude?: number;
  priceItems: Array<{
    id: string;
    label: string;
    amount: number;
    unitLabel?: string;
  }>;
};

export type PendingPriceReport = {
  id: string;
  placeId: string;
  placeName: string;
  district: string;
  label: string;
  amount: number;
  unitLabel?: string;
  comment?: string;
  createdAt: string;
  existingPriceLabel?: string;
  existingPriceAmount?: number;
  existingPriceUnitLabel?: string;
  moderationSuggestion?: ModerationSuggestion;
};

export type AdminReport = {
  id: string;
  placeId: string;
  placeName: string;
  reasonType:
    | "price_error"
    | "duplicate_place"
    | "closed_or_wrong_info"
    | "promotional_content"
    | "other";
  detail: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  createdAt: string;
  moderationSuggestion?: ModerationSuggestion;
};

export type AdminPriceItem = {
  id: string;
  label: string;
  amount: number;
  unitLabel?: string;
  verificationStatus: "verified" | "unverified";
  verifiedReportCount: number;
  reportedAt: string;
  isRepresentative: boolean;
  isActive: boolean;
};

export type AdminPlacePriceDetail = {
  item: {
    id: string;
    name: string;
    district: string;
    representativePriceAmount: number;
    representativePriceLabel: string;
    verificationStatus: "verified" | "unverified";
    priceItems: AdminPriceItem[];
  } | null;
  source: "database" | "mock";
};

export type LoadState<T> =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "forbidden"; user: AdminSessionUser }
  | { status: "ready"; user: AdminSessionUser; data: T }
  | { status: "error"; message: string };
