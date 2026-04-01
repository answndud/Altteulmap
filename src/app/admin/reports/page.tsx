import Link from "next/link";
import { redirect } from "next/navigation";

import { AccessDeniedPanel } from "@/components/access-denied-panel";
import { SessionActionGroup } from "@/features/auth/session-action-group";
import { AdminReportStatusForm } from "@/features/reports/admin-report-status-form";
import { listReports } from "@/features/reports/repository";
import {
  reportReasonMap,
  reportStatusMap,
} from "@/features/reports/schema";
import {
  createLoginHref,
  getSessionUser,
  getSessionUserLabel,
} from "@/lib/session";

export const dynamic = "force-dynamic";

const statusClassMap = {
  open: "bg-rose-100 text-rose-700",
  reviewing: "bg-amber-100 text-amber-700",
  resolved: "bg-emerald-100 text-emerald-700",
  dismissed: "bg-stone-200 text-stone-700",
} as const;

export default async function AdminReportsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(createLoginHref("/admin/reports"));
  }

  if (user.role !== "admin") {
    return (
      <AccessDeniedPanel
        eyebrow="운영"
        title="운영자 권한이 필요합니다"
        description={`${getSessionUserLabel(user)} 계정은 신고 검토 큐에 접근할 수 없습니다. 운영자 계정으로 다시 로그인하거나 일반 사용자 화면으로 돌아가세요.`}
        primaryHref="/"
        primaryLabel="지도 화면으로 이동"
        secondaryHref="/login?callbackUrl=%2Fadmin%2Freports"
        secondaryLabel="운영자 계정으로 로그인"
      />
    );
  }

  const result = await listReports();

  return (
    <main className="bg-stone-50 px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-7xl rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-600">
              운영
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
              신고 검토 큐 초안
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">
              1인 운영 기준 최소 검토 화면입니다. 로컬 초기 단계에서는 목업으로도
              확인할 수 있고, DB가 붙으면 같은 화면에서 실제 신고 큐를 볼 수
              있습니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin"
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
            >
              대시보드
            </Link>
            <Link
              href="/admin/places"
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
            >
              장소 승인 큐
            </Link>
            <Link
              href="/admin/prices"
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
            >
              가격 제보 큐
            </Link>
            <Link
              href="/api/admin/reports"
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
            >
              응답 보기
            </Link>
            <SessionActionGroup user={user} signOutCallbackUrl="/" compact />
          </div>
        </div>

        <div className="mt-6">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              result.source === "database"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-orange-100 text-orange-700"
            }`}
          >
            데이터 구분: {result.source === "database" ? "실데이터" : "목업"}
          </span>
        </div>

        <div data-testid="admin-report-list" className="mt-8 grid gap-4">
          {result.items.map((report) => (
            <article
              key={report.id}
              data-testid="admin-report-card"
              className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
                    {report.id}
                  </p>
                  <h2
                    data-testid="admin-report-place-name"
                    className="mt-2 text-xl font-semibold text-stone-900"
                  >
                    {report.placeName}
                  </h2>
                  <p className="mt-2 text-sm text-stone-500">
                    {reportReasonMap[report.reasonType]} · 접수 {report.createdAt}
                  </p>
                </div>
                <span
                  data-testid="admin-report-status-badge"
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClassMap[report.status]}`}
                >
                  {reportStatusMap[report.status]}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-stone-700">
                {report.detail}
              </p>
              <div className="mt-4 grid gap-4 lg:grid-cols-[auto_1fr] lg:items-start">
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/place/${report.placeId}`}
                    className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
                  >
                    장소 보기
                  </Link>
                  <Link
                    href={`/report?placeId=${report.placeId}&placeName=${encodeURIComponent(report.placeName)}`}
                    className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
                  >
                    신고 재현
                  </Link>
                </div>
                <AdminReportStatusForm
                  reportId={report.id}
                  currentStatus={report.status}
                  disabled={result.source !== "database"}
                />
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
