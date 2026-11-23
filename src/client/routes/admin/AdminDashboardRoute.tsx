import { useCallback } from "react";
import { Link } from "react-router-dom";

import { fetchJson } from "@/client/routes/admin/api";
import { AdminAccessGate } from "@/client/routes/admin/AdminAccessGate";
import { AdminFrame } from "@/client/routes/admin/AdminFrame";
import { DataBadge } from "@/client/routes/admin/AdminShared";
import { useAdminData } from "@/client/routes/admin/useAdminData";
import type {
  AdminListResponse,
  AdminReport,
  AdminStats,
  PendingPlace,
  PendingPriceReport,
} from "@/client/routes/admin/types";

export function AdminDashboardRoute() {
  const loadDashboard = useCallback(async () => {
    const [places, prices, reports, stats] = await Promise.all([
      fetchJson<AdminListResponse<PendingPlace>>("/api/admin/places"),
      fetchJson<AdminListResponse<PendingPriceReport>>("/api/admin/prices"),
      fetchJson<AdminListResponse<AdminReport>>("/api/admin/reports"),
      fetchJson<AdminStats>("/api/admin/stats"),
    ]);

    return { places, prices, reports, stats };
  }, []);
  const state = useAdminData(loadDashboard);

  return (
    <AdminFrame
      showNav={state.status === "ready"}
      title="운영 대시보드"
      description="승인 대기 장소, 가격 정보, 신고를 한 곳에서 검토합니다."
    >
      <AdminAccessGate state={state}>
        {({ places, prices, reports, stats }) => (
          <div className="grid gap-5">
            <section className="grid gap-3 md:grid-cols-4">
              <AdminMetricCard
                testId="admin-metric-total-users"
                label="전체 사용자"
                value={formatCount(stats.users.total)}
                description={`최근 7일 신규 ${formatCount(stats.users.newLast7Days)}명`}
              />
              <AdminMetricCard
                testId="admin-metric-current-sessions"
                label="로그인 세션"
                value={formatCount(stats.sessions.active)}
                description="만료되지 않은 세션 수"
              />
              <AdminMetricCard
                testId="admin-metric-today-visits"
                label="오늘 방문"
                value={formatCount(stats.visits.hitsToday)}
                description={`방문자 ${formatCount(stats.visits.visitorsToday)}명 (DAU)`}
              />
              <AdminMetricCard
                testId="admin-metric-shared-visits"
                label="오늘 공유 유입"
                value={formatCount(stats.shares.hitsToday)}
                description="공유 링크로 들어온 방문"
              />
              <AdminMetricCard
                testId="admin-metric-weekly-visits"
                label="최근 7일 방문"
                value={formatCount(stats.visits.hitsLast7Days)}
                description={`방문자 ${formatCount(stats.visits.visitorsLast7Days)}명 (WAU)`}
              />
              <AdminMetricCard
                testId="admin-metric-dau-wau"
                label="DAU/WAU"
                value={formatRate(
                  stats.visits.visitorsLast7Days > 0
                    ? stats.visits.visitorsToday / stats.visits.visitorsLast7Days
                    : null,
                )}
                description="오늘 방문자 ÷ 7일 방문자"
              />
              <AdminMetricCard
                testId="admin-metric-returning-rate"
                label="재방문율"
                value={formatRate(stats.visits.returningRate)}
                description="7일 중 이틀 이상 방문한 비율"
              />
              <AdminMetricCard
                testId="admin-metric-price-approval"
                label="가격 제보 승인율"
                value={formatRate(stats.priceReports.approvalRate)}
                description={`최근 7일 제보 ${formatCount(stats.priceReports.submittedLast7Days)}건`}
              />
            </section>

            <section
              data-testid="admin-share-source-breakdown"
              className="altteulmap-panel-muted p-4"
            >
              <p className="text-sm font-semibold text-[var(--altteul-text-primary)]">
                공유 유입 경로 (최근 7일)
              </p>
              <ul className="mt-3 grid gap-2 text-sm text-[var(--altteul-text-secondary)] md:grid-cols-4">
                {SHARE_SOURCES.map(({ key, label }) => (
                  <li key={key} className="flex justify-between gap-3">
                    <span>{label}</span>
                    <span className="font-semibold tabular-nums text-[var(--altteul-text-strong)]">
                      {formatCount(
                        stats.shares.bySource.find((item) => item.source === key)?.hits ?? 0,
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section
              data-testid="admin-recent-user-list"
              className="altteulmap-panel-muted p-4"
            >
              <p className="text-sm font-semibold text-[var(--altteul-text-primary)]">
                최근 가입 사용자
              </p>
              {stats.users.recent.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--altteul-text-secondary)]">
                  아직 가입한 사용자가 없습니다.
                </p>
              ) : (
                <ul className="mt-3 grid gap-2 text-sm text-[var(--altteul-text-secondary)]">
                  {stats.users.recent.map((user) => (
                    <li key={user.id} className="flex justify-between gap-3">
                      <span>
                        {user.nickname}
                        {user.role === "admin" ? " · 운영자" : ""}
                      </span>
                      <span className="tabular-nums">{user.createdAt}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="grid gap-4 md:grid-cols-3">
              <DashboardCard
                label="승인 대기 장소"
                value={places.count}
                href="/admin/places"
                source={places.source}
                mock={places.mock}
                testId="admin-overview-places-link"
              />
              <DashboardCard
                label="가격 정보"
                value={prices.count}
                href="/admin/prices"
                source={prices.source}
                mock={prices.mock}
              />
              <DashboardCard
                label="신고"
                value={reports.count}
                href="/admin/reports"
                source={reports.source}
                mock={reports.mock}
                testId="admin-overview-reports-link"
              />
            </div>
          </div>
        )}
      </AdminAccessGate>
    </AdminFrame>
  );
}

const SHARE_SOURCES = [
  { key: "detail", label: "상세 페이지" },
  { key: "detail_sheet", label: "상세 시트" },
  { key: "list", label: "지도 목록" },
  { key: "trending", label: "인기 장소" },
];

function formatCount(value: number) {
  return value.toLocaleString("ko-KR");
}

function formatRate(value: number | null) {
  return value === null ? "-" : `${Math.round(value * 100)}%`;
}

function AdminMetricCard({
  description,
  label,
  testId,
  value,
}: {
  description: string;
  label: string;
  testId: string;
  value: string;
}) {
  return (
    <article data-testid={testId} className="altteulmap-panel-muted p-4">
      <p className="text-xs text-[var(--altteul-text-tertiary)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--altteul-text-strong)]">{value}</p>
      <p className="mt-2 text-xs leading-5 text-[var(--altteul-text-tertiary)]">{description}</p>
    </article>
  );
}

function DashboardCard({
  label,
  value,
  href,
  source,
  mock,
  testId,
}: {
  label: string;
  value: number;
  href: string;
  source: string;
  mock: boolean;
  testId?: string;
}) {
  return (
    <article className="altteulmap-panel-muted p-5">
      <DataBadge source={source} mock={mock} />
      <p className="mt-5 text-sm text-[var(--altteul-accent-text)]">{label}</p>
      <p className="mt-2 text-[2.5rem] font-semibold text-[var(--altteul-text-strong)]">{value}</p>
      <Link
        to={href}
        data-testid={testId}
        className="altteulmap-button altteulmap-accent-solid mt-5 inline-flex px-4 py-2 text-sm"
      >
        열기
      </Link>
    </article>
  );
}
