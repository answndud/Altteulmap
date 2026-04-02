import "server-only";

import { and, desc, eq, gt, or, sql } from "drizzle-orm";

import { getDb, isDatabaseEnabled } from "@/db/client";
import {
  authSessions,
  contentReports,
  places,
  priceReports,
  users,
} from "@/db/schema";
import {
  authAccountHints,
  type AppUserRole,
} from "@/features/auth/constants";
import { mockPlaces } from "@/features/places/catalog-data";
import { mockReports } from "@/features/reports/mock-data";

type DataSource = "mock" | "database";

export type AdminOverviewUserRecord = {
  id: string;
  email: string;
  nickname: string | null;
  role: AppUserRole;
  joinedAt: string;
  hasActiveSession: boolean;
};

export type AdminOverviewResult = {
  source: DataSource;
  visitMetricsAvailable: boolean;
  stats: {
    totalUsers: number;
    adminUsers: number;
    regularUsers: number;
    currentSessions: number;
    activeUsers: number;
    activePlaces: number;
    pendingPlaces: number;
    pendingPriceReports: number;
    openReports: number;
  };
  recentUsers: AdminOverviewUserRecord[];
};

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
});

function formatDate(value: Date) {
  return dateFormatter.format(value);
}

function getMockAdminOverview(): AdminOverviewResult {
  return {
    source: "mock",
    visitMetricsAvailable: false,
    stats: {
      totalUsers: 2,
      adminUsers: 1,
      regularUsers: 1,
      currentSessions: 0,
      activeUsers: 0,
      activePlaces: mockPlaces.length,
      pendingPlaces: 0,
      pendingPriceReports: 0,
      openReports: mockReports.filter(
        (report) => report.status === "open" || report.status === "reviewing",
      ).length,
    },
    recentUsers: authAccountHints.map((account) => ({
      id: account.email,
      email: account.email,
      nickname: account.role === "admin" ? "운영자" : "근처 주민",
      role: account.role,
      joinedAt: "기본 계정",
      hasActiveSession: false,
    })),
  };
}

async function getDatabaseAdminOverview(): Promise<AdminOverviewResult> {
  const db = getDb();
  const now = new Date();

  const [
    [userCountsRow],
    [sessionCountsRow],
    [placeCountsRow],
    [pendingPriceReportCountsRow],
    [openReportCountsRow],
    recentUsersRows,
    activeSessionUserRows,
  ] = await Promise.all([
    db
      .select({
        totalUsers: sql<number>`count(*)::int`,
        adminUsers:
          sql<number>`count(*) filter (where ${users.role} = 'admin')::int`,
        regularUsers:
          sql<number>`count(*) filter (where ${users.role} = 'user')::int`,
      })
      .from(users),
    db
      .select({
        currentSessions: sql<number>`count(*)::int`,
        activeUsers: sql<number>`count(distinct ${authSessions.userId})::int`,
      })
      .from(authSessions)
      .where(gt(authSessions.expires, now)),
    db
      .select({
        activePlaces:
          sql<number>`count(*) filter (where ${places.status} = 'active')::int`,
        pendingPlaces:
          sql<number>`count(*) filter (where ${places.status} = 'pending_review')::int`,
      })
      .from(places),
    db
      .select({
        pendingPriceReports: sql<number>`count(*)::int`,
      })
      .from(priceReports)
      .where(eq(priceReports.reportStatus, "pending_review")),
    db
      .select({
        openReports: sql<number>`count(*)::int`,
      })
      .from(contentReports)
      .where(
        and(
          eq(contentReports.targetType, "place"),
          or(
            eq(contentReports.status, "open"),
            eq(contentReports.status, "reviewing"),
          ),
        ),
      ),
    db
      .select({
        id: users.id,
        email: users.email,
        nickname: users.nickname,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(6),
    db
      .select({
        userId: authSessions.userId,
      })
      .from(authSessions)
      .where(gt(authSessions.expires, now))
      .groupBy(authSessions.userId),
  ]);

  const activeSessionUserIds = new Set(
    activeSessionUserRows.map((row) => row.userId),
  );

  return {
    source: "database",
    visitMetricsAvailable: false,
    stats: {
      totalUsers: Number(userCountsRow?.totalUsers ?? 0),
      adminUsers: Number(userCountsRow?.adminUsers ?? 0),
      regularUsers: Number(userCountsRow?.regularUsers ?? 0),
      currentSessions: Number(sessionCountsRow?.currentSessions ?? 0),
      activeUsers: Number(sessionCountsRow?.activeUsers ?? 0),
      activePlaces: Number(placeCountsRow?.activePlaces ?? 0),
      pendingPlaces: Number(placeCountsRow?.pendingPlaces ?? 0),
      pendingPriceReports: Number(
        pendingPriceReportCountsRow?.pendingPriceReports ?? 0,
      ),
      openReports: Number(openReportCountsRow?.openReports ?? 0),
    },
    recentUsers: recentUsersRows.map((user) => ({
      id: user.id,
      email: user.email,
      nickname: user.nickname ?? null,
      role: user.role,
      joinedAt: formatDate(user.createdAt),
      hasActiveSession: activeSessionUserIds.has(user.id),
    })),
  };
}

export async function getAdminOverview() {
  if (!isDatabaseEnabled()) {
    return getMockAdminOverview();
  }

  try {
    return await getDatabaseAdminOverview();
  } catch (error) {
    console.error("Failed to load admin overview. Falling back to mock data.", error);

    return getMockAdminOverview();
  }
}
