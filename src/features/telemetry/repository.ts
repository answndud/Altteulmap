import "server-only";

import { countDistinct, gte, sql } from "drizzle-orm";

import { getDb, isDatabaseEnabled, markDatabaseUnavailable } from "@/db/client";
import { visitActivities } from "@/db/schema";
import {
  PLACE_SHARE_SOURCES,
  type PlaceShareSource,
} from "@/features/places/share";

const VISIT_BUCKET_MS = 30 * 60 * 1000;
const VISIT_RETENTION_DAYS = 120;
const VISIT_PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const globalForVisitTelemetry = globalThis as {
  __altteulmapVisitActivityLastPrunedAt?: number;
};

export type VisitActivityScope = "public" | "admin";
export type VisitEntryRef = "share";

export type ShareVisitSourceMetric = {
  source: PlaceShareSource;
  visits: number;
  uniqueVisitors: number;
};

export type RecordVisitActivityInput = {
  actorKey: string;
  entryRef?: VisitEntryRef | null;
  entrySource?: PlaceShareSource | null;
  path: string;
  scope: VisitActivityScope;
  userId?: string | null;
  visitorId?: string | null;
};

export type VisitMetrics = {
  todayVisits: number;
  last7DaysVisits: number;
  todayUniqueVisitors: number;
  last7DaysUniqueVisitors: number;
  todaySharedVisits: number;
  last7DaysSharedVisits: number;
  todaySharedUniqueVisitors: number;
  last7DaysSharedUniqueVisitors: number;
  dau: number;
  wau: number;
  returningVisitors7d: number;
  returningVisitorRate7d: number;
  shareSourceBreakdown7d: ShareVisitSourceMetric[];
};

function toKstDateString(date: Date) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function getKstDateDaysAgo(baseDate: Date, daysAgo: number) {
  const shifted = new Date(baseDate.getTime() + KST_OFFSET_MS);
  const utcMidnight = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() - daysAgo,
  );

  return new Date(utcMidnight).toISOString().slice(0, 10);
}

function getVisitBucketStartedAt(date: Date) {
  return new Date(Math.floor(date.getTime() / VISIT_BUCKET_MS) * VISIT_BUCKET_MS);
}

function normalizeVisitPath(path: string) {
  const trimmed = path.trim();

  if (!trimmed.startsWith("/")) {
    return null;
  }

  const normalized = trimmed.split("?")[0]?.split("#")[0] ?? trimmed;

  if (!normalized || normalized.startsWith("/api") || normalized.startsWith("/_next")) {
    return null;
  }

  return normalized.slice(0, 160);
}

function getRouteGroup(path: string, scope: VisitActivityScope) {
  if (scope === "admin" || path === "/admin" || path.startsWith("/admin/")) {
    return "admin";
  }

  return "public";
}

async function pruneOldVisitActivity(now: Date) {
  const lastPrunedAt = globalForVisitTelemetry.__altteulmapVisitActivityLastPrunedAt ?? 0;

  if (lastPrunedAt > 0 && now.getTime() - lastPrunedAt < VISIT_PRUNE_INTERVAL_MS) {
    return;
  }

  const db = getDb();
  const retentionCutoff = getKstDateDaysAgo(now, VISIT_RETENTION_DAYS);

  await db.delete(visitActivities).where(
    sql`${visitActivities.visitDate} < ${retentionCutoff}`,
  );

  globalForVisitTelemetry.__altteulmapVisitActivityLastPrunedAt = now.getTime();
}

function getEmptyShareSourceBreakdown(): ShareVisitSourceMetric[] {
  return PLACE_SHARE_SOURCES.map((source) => ({
    source,
    visits: 0,
    uniqueVisitors: 0,
  }));
}

export async function recordVisitActivity(input: RecordVisitActivityInput) {
  if (!isDatabaseEnabled()) {
    return { ok: true, tracked: false, source: "mock" as const };
  }

  const normalizedPath = normalizeVisitPath(input.path);

  if (!normalizedPath) {
    return { ok: true, tracked: false, source: "database" as const };
  }

  try {
    const now = new Date();
    const db = getDb();
    const routeGroup = getRouteGroup(normalizedPath, input.scope);

    await pruneOldVisitActivity(now);

    await db
      .insert(visitActivities)
      .values({
        actorKey: input.actorKey,
        userId: input.userId ?? null,
        visitorId: input.visitorId ?? null,
        routeGroup,
        routePath: normalizedPath,
        entryRef: input.entryRef ?? null,
        entrySource: input.entrySource ?? null,
        visitDate: toKstDateString(now),
        bucketStartedAt: getVisitBucketStartedAt(now),
        hitCount: 1,
        firstVisitedAt: now,
        lastVisitedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          visitActivities.actorKey,
          visitActivities.routeGroup,
          visitActivities.bucketStartedAt,
        ],
        set: {
          routePath: normalizedPath,
          entryRef:
            sql`coalesce(${visitActivities.entryRef}, excluded.entry_ref)`,
          entrySource:
            sql`coalesce(${visitActivities.entrySource}, excluded.entry_source)`,
          userId: input.userId ?? null,
          visitorId: input.visitorId ?? null,
          hitCount: sql`${visitActivities.hitCount} + 1`,
          lastVisitedAt: now,
        },
      });
  } catch (error) {
    markDatabaseUnavailable(error);

    if (!isDatabaseEnabled()) {
      return { ok: true, tracked: false, source: "mock" as const };
    }

    throw error;
  }

  return {
    ok: true,
    tracked: true,
    source: "database" as const,
  };
}

function getEmptyVisitMetrics(): VisitMetrics {
  return {
    todayVisits: 0,
    last7DaysVisits: 0,
    todayUniqueVisitors: 0,
    last7DaysUniqueVisitors: 0,
    todaySharedVisits: 0,
    last7DaysSharedVisits: 0,
    todaySharedUniqueVisitors: 0,
    last7DaysSharedUniqueVisitors: 0,
    dau: 0,
    wau: 0,
    returningVisitors7d: 0,
    returningVisitorRate7d: 0,
    shareSourceBreakdown7d: getEmptyShareSourceBreakdown(),
  };
}

export async function getVisitMetrics(): Promise<VisitMetrics> {
  if (!isDatabaseEnabled()) {
    return getEmptyVisitMetrics();
  }

  try {
    const db = getDb();
    const now = new Date();
    const today = toKstDateString(now);
    const last7DaysStart = getKstDateDaysAgo(now, 6);
    const [visitsRow] = await db
      .select({
        todayVisits:
          sql<number>`count(*) filter (where ${visitActivities.visitDate} = ${today})::int`,
        last7DaysVisits:
          sql<number>`count(*) filter (where ${visitActivities.visitDate} >= ${last7DaysStart})::int`,
        todayUniqueVisitors:
          sql<number>`count(distinct ${visitActivities.actorKey}) filter (where ${visitActivities.visitDate} = ${today})::int`,
        last7DaysUniqueVisitors:
          sql<number>`count(distinct ${visitActivities.actorKey}) filter (where ${visitActivities.visitDate} >= ${last7DaysStart})::int`,
        todaySharedVisits:
          sql<number>`count(*) filter (where ${visitActivities.visitDate} = ${today} and ${visitActivities.entryRef} = 'share')::int`,
        last7DaysSharedVisits:
          sql<number>`count(*) filter (where ${visitActivities.visitDate} >= ${last7DaysStart} and ${visitActivities.entryRef} = 'share')::int`,
        todaySharedUniqueVisitors:
          sql<number>`count(distinct ${visitActivities.actorKey}) filter (where ${visitActivities.visitDate} = ${today} and ${visitActivities.entryRef} = 'share')::int`,
        last7DaysSharedUniqueVisitors:
          sql<number>`count(distinct ${visitActivities.actorKey}) filter (where ${visitActivities.visitDate} >= ${last7DaysStart} and ${visitActivities.entryRef} = 'share')::int`,
      })
      .from(visitActivities);

    const returningActivity = db
      .select({
        actorKey: visitActivities.actorKey,
        activeDays: countDistinct(visitActivities.visitDate).as("active_days"),
      })
      .from(visitActivities)
      .where(gte(visitActivities.visitDate, last7DaysStart))
      .groupBy(visitActivities.actorKey)
      .as("returning_activity");

    const [returningRow] = await db
      .select({
        returningVisitors7d:
          sql<number>`count(*) filter (where ${returningActivity.activeDays} >= 2)::int`,
      })
      .from(returningActivity);

    const shareSourceRows = await db
      .select({
        source: visitActivities.entrySource,
        uniqueVisitors: sql<number>`count(distinct ${visitActivities.actorKey})::int`,
        visits: sql<number>`count(*)::int`,
      })
      .from(visitActivities)
      .where(
        sql`${visitActivities.visitDate} >= ${last7DaysStart} and ${visitActivities.entryRef} = 'share' and ${visitActivities.entrySource} is not null`,
      )
      .groupBy(visitActivities.entrySource);

    const wau = Number(visitsRow?.last7DaysUniqueVisitors ?? 0);
    const returningVisitors7d = Number(returningRow?.returningVisitors7d ?? 0);
    const shareSourceBySource = new Map(
      shareSourceRows.flatMap((row) =>
        row.source
          ? [
              [
                row.source,
                {
                  visits: Number(row.visits ?? 0),
                  uniqueVisitors: Number(row.uniqueVisitors ?? 0),
                },
              ] as const,
            ]
          : [],
      ),
    );

    return {
      todayVisits: Number(visitsRow?.todayVisits ?? 0),
      last7DaysVisits: Number(visitsRow?.last7DaysVisits ?? 0),
      todayUniqueVisitors: Number(visitsRow?.todayUniqueVisitors ?? 0),
      last7DaysUniqueVisitors: wau,
      todaySharedVisits: Number(visitsRow?.todaySharedVisits ?? 0),
      last7DaysSharedVisits: Number(visitsRow?.last7DaysSharedVisits ?? 0),
      todaySharedUniqueVisitors: Number(visitsRow?.todaySharedUniqueVisitors ?? 0),
      last7DaysSharedUniqueVisitors: Number(
        visitsRow?.last7DaysSharedUniqueVisitors ?? 0,
      ),
      dau: Number(visitsRow?.todayUniqueVisitors ?? 0),
      wau,
      returningVisitors7d,
      returningVisitorRate7d:
        wau > 0 ? Number(((returningVisitors7d / wau) * 100).toFixed(1)) : 0,
      shareSourceBreakdown7d: PLACE_SHARE_SOURCES.map((source) => ({
        source,
        visits: shareSourceBySource.get(source)?.visits ?? 0,
        uniqueVisitors: shareSourceBySource.get(source)?.uniqueVisitors ?? 0,
      })),
    };
  } catch (error) {
    markDatabaseUnavailable(error);

    if (!isDatabaseEnabled()) {
      return getEmptyVisitMetrics();
    }

    throw error;
  }
}
