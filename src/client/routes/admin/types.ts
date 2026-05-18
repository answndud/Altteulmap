import type { AdminSessionUser } from "@/shared/admin-contracts";

export type {
  AdminActionResult,
  AdminListResponse,
  AdminPlacePriceDetail,
  AdminPriceItem,
  AdminReport,
  AdminSession,
  AdminSessionUser,
  ModerationSuggestion,
  PendingPlace,
  PendingPriceReport,
} from "@/shared/admin-contracts";

export type LoadState<T> =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "forbidden"; user: AdminSessionUser }
  | { status: "ready"; user: AdminSessionUser; data: T }
  | { status: "error"; message: string };
