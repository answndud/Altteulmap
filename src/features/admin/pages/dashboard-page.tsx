import Link from "next/link";
import { redirect } from "next/navigation";

import { AccessDeniedPanel } from "@/components/access-denied-panel";
import { getAdminOverview } from "@/features/admin/repository";
import { getPlaceShareSourceLabel } from "@/features/places/share";
import {
  listPendingPlaces,
  listPendingPriceReports,
} from "@/features/places/repository";
import { listReports } from "@/features/reports/repository";
import {
  createLoginHref,
  getSessionUser,
  getSessionUserLabel,
} from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(createLoginHref("/admin"));
  }

  if (user.role !== "admin") {
    return (
      <AccessDeniedPanel
        eyebrow="운영"
        title="운영자 권한이 필요합니다"
        description={`${getSessionUserLabel(user)} 계정은 운영 대시보드에 접근할 수 없습니다. 운영자 계정으로 다시 로그인하거나 일반 사용자 화면으로 돌아가세요.`}
        primaryHref="/"
        primaryLabel="지도 화면으로 이동"
        secondaryHref="/login?callbackUrl=%2Fadmin"
        secondaryLabel="다른 계정으로 로그인"
      />
    );
  }

  const [overview, pendingPlaces, pendingPriceReports, reports] =
    await Promise.all([
      getAdminOverview(),
      listPendingPlaces(),
      listPendingPriceReports(),
      listReports(),
    ]);

  const openReports = reports.items.filter(
    (report) => report.status === "open" || report.status === "reviewing",
  );

  return (
    <main className="bg-stone-50 px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-7xl rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-600">
            운영
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
            운영 대시보드
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">
            승인 대기 목록, 신고 큐, 사용자 현황을 한 화면에서 보고 바로
            운영 액션으로 넘어갈 수 있게 정리했습니다.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              overview.source === "database"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-orange-100 text-orange-700"
            }`}
          >
            운영 데이터: {overview.source === "database" ? "실데이터" : "목업"}
          </span>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
            방문 지표: {overview.visitMetricsAvailable ? "수집 중" : "미수집"}
          </span>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article
            data-testid="admin-metric-total-users"
            className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
              Users
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-stone-900">
              {overview.stats.totalUsers}
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              일반 {overview.stats.regularUsers}명 · 운영자 {overview.stats.adminUsers}
              명
            </p>
          </article>

          <article
            data-testid="admin-metric-current-sessions"
            className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
              Sessions
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-stone-900">
              {overview.stats.currentSessions}
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              현재 세션 사용자 {overview.stats.activeUsers}명
            </p>
          </article>

          <article
            data-testid="admin-metric-active-places"
            className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
              Places
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-stone-900">
              {overview.stats.activePlaces}
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              공개 중 장소 · 승인 대기 {overview.stats.pendingPlaces}건
            </p>
          </article>

          <article
            data-testid="admin-metric-open-reports"
            className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
              Reports
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-stone-900">
              {overview.stats.openReports}
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              열린 신고 · 가격 제보 대기 {overview.stats.pendingPriceReports}건
            </p>
          </article>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <article className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
              장소 검토
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-stone-900">
              승인 대기 장소 {pendingPlaces.items.length}건
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              공개 폼으로 들어온 텍스트 기반 장소 제보를 승인하거나 반려합니다.
              운영자가 주소와 네이버 지도 검색 결과를 확인한 뒤 좌표를 확정해
              공개 목록에 반영합니다.
            </p>
            <Link
              href="/admin/places"
              data-testid="admin-overview-places-link"
              className="mt-5 inline-flex rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
            >
              장소 검토 열기
            </Link>
          </article>

          <article className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
              가격 검토
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-stone-900">
              대기 중인 가격 제보 {pendingPriceReports.items.length}건
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              기존 장소에 들어온 가격 변경 제보를 검토하고 대표 가격에 반영합니다.
            </p>
            <Link
              href="/admin/prices"
              data-testid="admin-overview-prices-link"
              className="mt-5 inline-flex rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
            >
              가격 제보 검토 열기
            </Link>
          </article>

          <article className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
              신고 검토
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-stone-900">
              열린 신고 {openReports.length}건
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              가격 오류, 중복 장소, 정보 오류 신고를 상태별로 관리합니다.
            </p>
            <Link
              href="/admin/reports"
              data-testid="admin-overview-reports-link"
              className="mt-5 inline-flex rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
            >
              신고 검토 열기
            </Link>
          </article>
        </div>

        <section className="mt-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-stone-900">
                최근 가입 사용자
              </h2>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                최근 생성된 계정과 현재 세션 상태를 같이 확인합니다.
              </p>
            </div>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
              {overview.recentUsers.length}명
            </span>
          </div>

          <div
            data-testid="admin-recent-user-list"
            className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {overview.recentUsers.map((account) => (
              <article
                key={account.id}
                data-testid="admin-recent-user-card"
                className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
                      {account.role === "admin" ? "운영자" : "일반 사용자"}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-stone-900">
                      {account.nickname || account.email}
                    </h3>
                    <p className="mt-1 text-sm text-stone-500">{account.email}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      account.hasActiveSession
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-stone-200 text-stone-700"
                    }`}
                  >
                    {account.hasActiveSession ? "세션 활성" : "세션 없음"}
                  </span>
                </div>
                <p className="mt-4 text-sm text-stone-500">
                  가입 {account.joinedAt}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-6 xl:grid-cols-2">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-stone-900">
                  최신 장소 등록 목록
                </h2>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  운영자 승인이 필요한 신규 장소 제보입니다.
                </p>
              </div>
              <Link
                href="/admin/places"
                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
              >
                전체 보기
              </Link>
            </div>

            {pendingPlaces.items.length > 0 ? (
              <div
                data-testid="admin-overview-pending-place-list"
                className="mt-6 grid gap-3"
              >
                {pendingPlaces.items.slice(0, 4).map((place) => (
                  <article
                    key={place.id}
                    className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
                      접수 {place.createdAt}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-stone-900">
                      {place.name}
                    </h3>
                    <p className="mt-2 text-sm text-stone-500">{place.address}</p>
                    <p className="mt-1 text-sm text-stone-400">{place.district}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-[1.5rem] border border-dashed border-stone-300 bg-stone-50 p-6 text-sm leading-6 text-stone-600">
                현재 승인 대기 장소가 없습니다.
              </div>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-stone-900">
                  최신 신고 목록
                </h2>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  열린 상태의 신고만 먼저 요약해 보여줍니다.
                </p>
              </div>
              <Link
                href="/admin/reports"
                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
              >
                전체 보기
              </Link>
            </div>

            {openReports.length > 0 ? (
              <div
                data-testid="admin-overview-open-report-list"
                className="mt-6 grid gap-3"
              >
                {openReports.slice(0, 4).map((report) => (
                  <article
                    key={report.id}
                    className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
                      {report.status === "open" ? "열림" : "검토 중"} · {report.createdAt}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-stone-900">
                      {report.placeName}
                    </h3>
                    <p className="mt-2 text-sm text-stone-700">{report.detail}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-[1.5rem] border border-dashed border-stone-300 bg-stone-50 p-6 text-sm leading-6 text-stone-600">
                현재 열린 신고가 없습니다.
              </div>
            )}
          </div>
        </section>

        <section className="mt-10 rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-stone-900">
                방문/활성 사용자 지표
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
                30분 bucket 기준 dedupe 방문 이벤트를 적재합니다. 오늘/7일 방문,
                고유 방문자, DAU/WAU, 7일 재방문율을 한 번에 확인할 수 있습니다.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-600">
              최근 7일 기준
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article
              data-testid="admin-metric-today-visits"
              className="rounded-[1.5rem] border border-stone-200 bg-white p-5"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
                Today Visits
              </p>
              <h3 className="mt-3 text-3xl font-semibold text-stone-900">
                {overview.visitMetrics.todayVisits}
              </h3>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                오늘 고유 방문자 {overview.visitMetrics.todayUniqueVisitors}명
              </p>
            </article>

            <article
              data-testid="admin-metric-shared-visits"
              className="rounded-[1.5rem] border border-stone-200 bg-white p-5"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
                Shared 7d
              </p>
              <h3 className="mt-3 text-3xl font-semibold text-stone-900">
                {overview.visitMetrics.last7DaysSharedVisits}
              </h3>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                오늘 {overview.visitMetrics.todaySharedVisits}회 · 7일 고유 유입{" "}
                {overview.visitMetrics.last7DaysSharedUniqueVisitors}명
              </p>
            </article>

            <article
              data-testid="admin-metric-weekly-visits"
              className="rounded-[1.5rem] border border-stone-200 bg-white p-5"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
                7d Visits
              </p>
              <h3 className="mt-3 text-3xl font-semibold text-stone-900">
                {overview.visitMetrics.last7DaysVisits}
              </h3>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                7일 고유 방문자 {overview.visitMetrics.last7DaysUniqueVisitors}명
              </p>
            </article>

            <article
              data-testid="admin-metric-dau-wau"
              className="rounded-[1.5rem] border border-stone-200 bg-white p-5"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
                DAU / WAU
              </p>
              <h3 className="mt-3 text-3xl font-semibold text-stone-900">
                {overview.visitMetrics.dau} / {overview.visitMetrics.wau}
              </h3>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                일간/주간 활성 방문자
              </p>
            </article>

            <article
              data-testid="admin-metric-returning-rate"
              className="rounded-[1.5rem] border border-stone-200 bg-white p-5"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
                Returning 7d
              </p>
              <h3 className="mt-3 text-3xl font-semibold text-stone-900">
                {overview.visitMetrics.returningVisitorRate7d}%
              </h3>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                재방문 사용자 {overview.visitMetrics.returningVisitors7d}명
              </p>
            </article>
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-stone-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-stone-900">
                  공유 유입 source
                </h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  같은 30분 bucket 안에서는 처음 확인된 공유 유입 source를
                  유지합니다.
                </p>
              </div>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
                7일 기준
              </span>
            </div>

            <div
              data-testid="admin-share-source-breakdown"
              className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4"
            >
              {overview.visitMetrics.shareSourceBreakdown7d.map((item) => (
                <article
                  key={item.source}
                  className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">
                    {getPlaceShareSourceLabel(item.source)}
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-stone-900">
                    {item.visits}
                  </p>
                  <p className="mt-2 text-sm text-stone-600">
                    고유 유입 {item.uniqueVisitors}명
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
