import { sql } from "drizzle-orm";

import { getWorkerDb, type WorkerDatabaseBindings } from "@/worker/db";

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
    /** 최근 7일 방문자 중 서로 다른 2일 이상 방문한 비율(0~1). 방문자가 없으면 null. */
    returningRate: number | null;
  };
  shares: {
    hitsToday: number;
    bySource: Array<{ source: string; hits: number }>;
  };
  priceReports: {
    submittedLast7Days: number;
    /** 최근 7일에 처리된 제보 중 승인 비율(0~1). 처리된 제보가 없으면 null. */
    approvalRate: number | null;
  };
};

type Row = Record<string, unknown>;

function toInt(value: unknown) {
  return Number(value ?? 0);
}

/**
 * 대시보드 지표를 실제 테이블에서 집계한다. 날짜는 방문 기록과 같은 KST 기준이며,
 * 모든 집계는 인덱스가 있는 컬럼(visit_date, created_at, expires)을 조건으로 쓴다.
 */
export async function getWorkerAdminStats(
  env: WorkerDatabaseBindings,
): Promise<AdminStats> {
  const db = getWorkerDb(env);
  const today = sql`(now() at time zone 'Asia/Seoul')::date`;
  const weekStart = sql`((now() at time zone 'Asia/Seoul')::date - 6)`;

  const [userRows, recentRows, sessionRows, visitRows, returningRows, shareRows, priceRows] =
    await Promise.all([
      db.execute<Row>(sql`
        select count(*)::int as total,
               count(*) filter (where created_at >= now() - interval '7 days')::int as new_7d
        from users`),
      db.execute<Row>(sql`
        select id, coalesce(nickname, split_part(email, '@', 1)) as nickname, role, created_at
        from users order by created_at desc limit 5`),
      db.execute<Row>(sql`
        select count(*)::int as active from auth_sessions where expires > now()`),
      db.execute<Row>(sql`
        select coalesce(sum(hit_count) filter (where visit_date = ${today}), 0)::int as hits_today,
               coalesce(sum(hit_count), 0)::int as hits_7d,
               count(distinct actor_key) filter (where visit_date = ${today})::int as visitors_today,
               count(distinct actor_key)::int as visitors_7d
        from visit_activity where visit_date >= ${weekStart}`),
      db.execute<Row>(sql`
        select count(*) filter (where days >= 2)::int as returning, count(*)::int as total
        from (
          select actor_key, count(distinct visit_date) as days
          from visit_activity where visit_date >= ${weekStart} group by actor_key
        ) visitors`),
      db.execute<Row>(sql`
        select coalesce(entry_source, 'unknown') as source,
               sum(hit_count)::int as hits,
               coalesce(sum(hit_count) filter (where visit_date = ${today}), 0)::int as hits_today
        from visit_activity
        where entry_ref = 'share' and visit_date >= ${weekStart}
        group by 1 order by hits desc`),
      db.execute<Row>(sql`
        select count(*)::int as submitted,
               count(*) filter (where report_status = 'accepted')::int as accepted,
               count(*) filter (where report_status in ('accepted', 'rejected'))::int as decided
        from price_reports where created_at >= now() - interval '7 days'`),
    ]);

  const users = userRows[0] ?? {};
  const visits = visitRows[0] ?? {};
  const returning = returningRows[0] ?? {};
  const prices = priceRows[0] ?? {};
  const returningTotal = toInt(returning.total);
  const decided = toInt(prices.decided);

  return {
    source: "database",
    generatedAt: new Date().toISOString(),
    users: {
      total: toInt(users.total),
      newLast7Days: toInt(users.new_7d),
      recent: [...recentRows].map((row) => ({
        id: String(row.id),
        nickname: String(row.nickname ?? ""),
        role: String(row.role ?? "user"),
        createdAt: new Date(row.created_at as string | Date).toISOString().slice(0, 10),
      })),
    },
    sessions: { active: toInt(sessionRows[0]?.active) },
    visits: {
      hitsToday: toInt(visits.hits_today),
      hitsLast7Days: toInt(visits.hits_7d),
      visitorsToday: toInt(visits.visitors_today),
      visitorsLast7Days: toInt(visits.visitors_7d),
      returningRate:
        returningTotal > 0 ? toInt(returning.returning) / returningTotal : null,
    },
    shares: {
      hitsToday: [...shareRows].reduce((sum, row) => sum + toInt(row.hits_today), 0),
      bySource: [...shareRows].map((row) => ({
        source: String(row.source),
        hits: toInt(row.hits),
      })),
    },
    priceReports: {
      submittedLast7Days: toInt(prices.submitted),
      approvalRate: decided > 0 ? toInt(prices.accepted) / decided : null,
    },
  };
}

export function createMockAdminStats(): AdminStats {
  return {
    source: "mock",
    generatedAt: new Date().toISOString(),
    users: { total: 0, newLast7Days: 0, recent: [] },
    sessions: { active: 0 },
    visits: {
      hitsToday: 0,
      hitsLast7Days: 0,
      visitorsToday: 0,
      visitorsLast7Days: 0,
      returningRate: null,
    },
    shares: { hitsToday: 0, bySource: [] },
    priceReports: { submittedLast7Days: 0, approvalRate: null },
  };
}
