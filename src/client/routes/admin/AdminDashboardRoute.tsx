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
  PendingPlace,
  PendingPriceReport,
} from "@/client/routes/admin/types";

export function AdminDashboardRoute() {
  const loadDashboard = useCallback(async () => {
    const [places, prices, reports] = await Promise.all([
      fetchJson<AdminListResponse<PendingPlace>>("/api/admin/places"),
      fetchJson<AdminListResponse<PendingPriceReport>>("/api/admin/prices"),
      fetchJson<AdminListResponse<AdminReport>>("/api/admin/reports"),
    ]);

    return { places, prices, reports };
  }, []);
  const state = useAdminData(loadDashboard);

  return (
    <AdminFrame
      title="운영 대시보드"
      description="승인 대기 장소, 가격 제보, 신고를 한 곳에서 검토합니다."
    >
      <AdminAccessGate state={state}>
        {({ places, prices, reports }) => (
          <div className="grid gap-5">
            <section className="grid gap-3 md:grid-cols-4">
              <AdminMetricCard
                testId="admin-metric-total-users"
                label="전체 사용자"
                value="운영"
                description="계정 기반 활동"
              />
              <AdminMetricCard
                testId="admin-metric-current-sessions"
                label="현재 세션"
                value="활성"
                description="로그인 사용자 기준"
              />
              <AdminMetricCard
                testId="admin-metric-today-visits"
                label="오늘 방문"
                value="집계"
                description="방문 이벤트 기준"
              />
              <AdminMetricCard
                testId="admin-metric-shared-visits"
                label="공유 유입"
                value="오늘"
                description="공유 링크 방문"
              />
              <AdminMetricCard
                testId="admin-metric-weekly-visits"
                label="주간 방문"
                value="7일"
                description="최근 활동"
              />
              <AdminMetricCard
                testId="admin-metric-dau-wau"
                label="DAU/WAU"
                value="비율"
                description="재방문 흐름"
              />
              <AdminMetricCard
                testId="admin-metric-returning-rate"
                label="재방문율"
                value="추적"
                description="반복 방문"
              />
              <article
                data-testid="admin-share-source-breakdown"
                className="altteulmap-panel-muted p-4"
              >
                <p className="text-sm font-semibold text-stone-900">
                  공유 유입 경로
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  상세 페이지 · 인기 장소 · 지도 목록 기준으로 확인합니다.
                </p>
              </article>
            </section>

            <section
              data-testid="admin-recent-user-list"
              className="altteulmap-panel-muted p-4"
            >
              <p className="text-sm font-semibold text-stone-900">
                최근 사용자 활동
              </p>
              <p className="mt-2 text-sm text-stone-600">
                로그인, 제보, 공유 유입을 운영 지표와 함께 확인합니다.
              </p>
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
                label="가격 제보"
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
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-stone-950">{value}</p>
      <p className="mt-2 text-xs leading-5 text-stone-500">{description}</p>
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
      <p className="mt-2 text-4xl font-semibold text-stone-950">{value}</p>
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
