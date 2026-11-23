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

export type AdminStats = {
  source: "database" | "mock";
  generatedAt: string;
  users: {
    total: number;
    newLast7Days: number;
    recent: Array<{ id: string; nickname: string; role: string; createdAt: string }>;
  };
  sessions: { active: number };
  visits: {
    hitsToday: number;
    hitsLast7Days: number;
    visitorsToday: number;
    visitorsLast7Days: number;
    returningRate: number | null;
  };
  shares: { hitsToday: number; bySource: Array<{ source: string; hits: number }> };
  priceReports: { submittedLast7Days: number; approvalRate: number | null };
};
