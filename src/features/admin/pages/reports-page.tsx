import Link from "next/link";
import { redirect } from "next/navigation";

import { AccessDeniedPanel } from "@/components/access-denied-panel";
import { AdminPageShell } from "@/features/admin/components/admin-page-shell";
import { AdminQueueNav } from "@/features/admin/components/admin-queue-nav";
import { AdminReportCard } from "@/features/admin/components/admin-report-card";
import { AdminSummaryCards } from "@/features/admin/components/admin-summary-cards";
import { getAdminOverview } from "@/features/admin/repository";
import { listReports } from "@/features/reports/repository";
import {
  reportStatusMap,
  reportStatusOptions,
  type ReportModerationInput,
} from "@/features/reports/schema";
import {
  createLoginHref,
  getSessionUser,
  getSessionUserLabel,
} from "@/lib/session";

export const dynamic = "force-dynamic";

type AdminReportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type ReportStatusFilter = ReportModerationInput["status"] | "all";

function getFirstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseStatusFilter(value: string | undefined): ReportStatusFilter {
  if (
    value === "open" ||
    value === "reviewing" ||
    value === "resolved" ||
    value === "dismissed"
  ) {
    return value;
  }

  return "all";
}

export default async function AdminReportsPage({
  searchParams,
}: AdminReportsPageProps) {
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

  const params = await searchParams;
  const statusFilter = parseStatusFilter(getFirstValue(params.status));

  const result = await listReports();
  const overview = await getAdminOverview();
  const statusCounts = {
    all: result.items.length,
    open: result.items.filter((report) => report.status === "open").length,
    reviewing: result.items.filter((report) => report.status === "reviewing")
      .length,
    resolved: result.items.filter((report) => report.status === "resolved")
      .length,
    dismissed: result.items.filter((report) => report.status === "dismissed")
      .length,
  } satisfies Record<ReportStatusFilter, number>;
  const filteredItems =
    statusFilter === "all"
      ? result.items
      : result.items.filter((report) => report.status === statusFilter);
  const resolvedCount = statusCounts.resolved + statusCounts.dismissed;

  return (
    <AdminPageShell
      title="신고 검토 큐"
      description="공개 신고를 상태별로 좁혀 보고 즉시 처리합니다. AI 1차 검수가 처리 후보와 확인 포인트를 먼저 정리하고, 운영자는 장소 상세와 신고 폼을 함께 열어 재현할 수 있습니다."
      actions={
        <Link
          href="/api/admin/reports"
          className="altteulmap-button border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-white"
        >
          응답 보기
        </Link>
      }
      statusBadges={
        <span
          className={`altteulmap-badge ${
            result.source === "database"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-[rgba(181,90,43,0.18)] bg-[rgba(181,90,43,0.12)] text-[var(--altteul-accent-text)]"
          }`}
        >
          데이터: {result.source === "database" ? "실데이터" : "목업"}
        </span>
      }
    >
      <div className="grid gap-6">
        <AdminQueueNav current="reports" stats={overview.stats} />
        <AdminSummaryCards
          items={[
            {
              id: "open-reports",
              label: "열린 신고",
              value: statusCounts.open,
              detail: "아직 손대지 않은 신고 수입니다.",
            },
            {
              id: "reviewing-reports",
              label: "검토 중 신고",
              value: statusCounts.reviewing,
              detail: "운영자가 처리 중으로 표시한 신고 수입니다.",
            },
            {
              id: "resolved-reports",
              label: "처리 완료/기각",
              value: resolvedCount,
              detail: "이미 처리 방향이 정해진 신고 수입니다.",
            },
          ]}
        />

        <div
          data-testid="admin-report-filter-bar"
          className="altteulmap-segmented flex flex-wrap gap-2"
        >
          <Link
            href="/admin/reports"
            data-testid="admin-report-filter-all"
            data-active={statusFilter === "all" ? "true" : "false"}
            aria-current={statusFilter === "all" ? "page" : undefined}
            className={`altteulmap-chip inline-flex items-center gap-2 border px-4 py-2 text-sm font-medium ${
              statusFilter === "all"
                ? "border-[rgba(151,70,29,0.38)] bg-[rgba(181,90,43,0.12)] text-[var(--altteul-accent-text)]"
                : "border-stone-300 bg-white text-stone-700 transition hover:bg-white"
            }`}
          >
            <span>전체</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                statusFilter === "all"
                  ? "bg-white/85 text-[var(--altteul-accent-text)]"
                  : "bg-[var(--altteul-bg-subtle)] text-stone-600"
              }`}
            >
              {statusCounts.all}
            </span>
          </Link>
          {reportStatusOptions.map((statusOption) => {
            const active = statusFilter === statusOption.value;

            return (
              <Link
                key={statusOption.value}
                href={`/admin/reports?status=${statusOption.value}`}
                data-testid={`admin-report-filter-${statusOption.value}`}
                data-active={active ? "true" : "false"}
                aria-current={active ? "page" : undefined}
                className={`altteulmap-chip inline-flex items-center gap-2 border px-4 py-2 text-sm font-medium ${
                  active
                    ? "border-[rgba(151,70,29,0.38)] bg-[rgba(181,90,43,0.12)] text-[var(--altteul-accent-text)]"
                    : "border-stone-300 bg-white text-stone-700 transition hover:bg-white"
                }`}
              >
                <span>{reportStatusMap[statusOption.value]}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    active
                      ? "bg-white/85 text-[var(--altteul-accent-text)]"
                      : "bg-[var(--altteul-bg-subtle)] text-stone-600"
                  }`}
                >
                  {statusCounts[statusOption.value]}
                </span>
              </Link>
            );
          })}
        </div>

        {filteredItems.length > 0 ? (
          <div data-testid="admin-report-list" className="grid gap-4">
            {filteredItems.map((report) => (
              <AdminReportCard
                key={report.id}
                report={report}
                disabled={result.source !== "database"}
              />
            ))}
          </div>
        ) : (
          <div
            data-testid="admin-report-empty"
            className="rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50 p-8 text-sm leading-6 text-stone-600"
          >
            {statusFilter === "all"
              ? "현재 접수된 신고가 없습니다."
              : `${reportStatusMap[statusFilter]} 상태의 신고가 없습니다.`}
          </div>
        )}
      </div>
    </AdminPageShell>
  );
}
