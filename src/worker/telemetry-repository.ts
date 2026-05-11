import { sql } from "drizzle-orm";

import { visitActivities } from "@/db/schema";
import {
  closeWorkerDatabaseConnection,
  getWorkerDb,
  isWorkerDatabaseEnabled,
  markWorkerDatabaseUnavailable,
  type WorkerDatabaseBindings,
} from "@/worker/db";

const VISIT_BUCKET_MS = 30 * 60 * 1000;
const VISIT_RETENTION_DAYS = 120;
const VISIT_PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const globalForVisitTelemetry = globalThis as typeof globalThis & {
  __altteulmapWorkerVisitActivityLastPrunedAt?: number;
};

export type WorkerVisitActivityScope = "public" | "admin";
type WorkerVisitEntryRef = "share";
type WorkerPlaceShareSource =
  | "detail"
  | "detail_sheet"
  | "list"
  | "trending";

export type RecordWorkerVisitActivityInput = {
  actorKey: string;
  entryRef?: WorkerVisitEntryRef | null;
  entrySource?: WorkerPlaceShareSource | null;
  path: string;
  scope: WorkerVisitActivityScope;
  userId?: string | null;
  visitorId?: string | null;
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

function getRouteGroup(path: string, scope: WorkerVisitActivityScope) {
  if (scope === "admin" || path === "/admin" || path.startsWith("/admin/")) {
    return "admin";
  }

  return "public";
}

async function pruneOldVisitActivity(
  env: WorkerDatabaseBindings,
  now: Date,
) {
  const lastPrunedAt =
    globalForVisitTelemetry.__altteulmapWorkerVisitActivityLastPrunedAt ?? 0;

  if (lastPrunedAt > 0 && now.getTime() - lastPrunedAt < VISIT_PRUNE_INTERVAL_MS) {
    return;
  }

  const db = getWorkerDb(env);
  const retentionCutoff = getKstDateDaysAgo(now, VISIT_RETENTION_DAYS);

  await db.delete(visitActivities).where(
    sql`${visitActivities.visitDate} < ${retentionCutoff}`,
  );

  globalForVisitTelemetry.__altteulmapWorkerVisitActivityLastPrunedAt =
    now.getTime();
}

export async function recordWorkerVisitActivity(
  env: WorkerDatabaseBindings,
  input: RecordWorkerVisitActivityInput,
) {
  if (!isWorkerDatabaseEnabled(env)) {
    return { ok: true, tracked: false, source: "mock" as const };
  }

  const normalizedPath = normalizeVisitPath(input.path);

  if (!normalizedPath) {
    return { ok: true, tracked: false, source: "database" as const };
  }

  try {
    const now = new Date();
    const db = getWorkerDb(env);
    const routeGroup = getRouteGroup(normalizedPath, input.scope);

    await pruneOldVisitActivity(env, now);

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
    markWorkerDatabaseUnavailable();

    if (!isWorkerDatabaseEnabled(env)) {
      return { ok: true, tracked: false, source: "mock" as const };
    }

    throw error;
  } finally {
    await closeWorkerDatabaseConnection();
  }

  return {
    ok: true,
    tracked: true,
    source: "database" as const,
  };
}
