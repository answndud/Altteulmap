import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { fetchJson } from "@/client/routes/admin/api";
import { AdminAccessGate } from "@/client/routes/admin/AdminAccessGate";
import { AdminFrame } from "@/client/routes/admin/AdminFrame";
import { AdminAiReviewPanel, DataBadge, EmptyPanel } from "@/client/routes/admin/AdminShared";
import { reportReasonMap, reportStatusMap } from "@/client/routes/admin/labels";
import { useAdminData } from "@/client/routes/admin/useAdminData";
import type { AdminActionResult, AdminListResponse, AdminReport } from "@/client/routes/admin/types";

export function AdminReportsRoute() {
  const [version, setVersion] = useState(0);
  const [params] = useSearchParams();
  const statusFilter = params.get("status") ?? "all";
  const loadReports = useCallback(
    () => {
      void version;
      return fetchJson<AdminListResponse<AdminReport>>("/api/admin/reports");
    },
    [version],
  );
  const state = useAdminData(loadReports);

  return (
    <AdminFrame
      title="신고 검토 큐"
      description="공개 신고를 상태별로 좁혀 보고 처리 상태를 변경합니다."
    >
      <AdminAccessGate state={state}>
        {(data) => {
          const filteredItems =
            statusFilter === "all"
              ? data.items
              : data.items.filter((item) => item.status === statusFilter);

          return (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <DataBadge source={data.source} mock={data.mock} />
                <span className="altteulmap-badge border-stone-200 bg-white text-stone-600">
                  {filteredItems.length} / {data.count}건
                </span>
              </div>
              <ReportFilterBar items={data.items} active={statusFilter} />
              <div className="grid gap-4" data-testid="admin-report-list">
                {filteredItems.length > 0 ? (
                  filteredItems.map((report) => (
                    <ReportCard
                      key={report.id}
                      report={report}
                      disabled={data.mock}
                      onChanged={() => setVersion((value) => value + 1)}
                    />
                  ))
                ) : (
                  <EmptyPanel message="해당 상태의 신고가 없습니다." />
                )}
              </div>
            </div>
          );
        }}
      </AdminAccessGate>
    </AdminFrame>
  );
}

function ReportFilterBar({
  items,
  active,
}: {
  items: AdminReport[];
  active: string;
}) {
  const counts = useMemo(
    () => ({
      all: items.length,
      open: items.filter((item) => item.status === "open").length,
      reviewing: items.filter((item) => item.status === "reviewing").length,
      resolved: items.filter((item) => item.status === "resolved").length,
      dismissed: items.filter((item) => item.status === "dismissed").length,
    }),
    [items],
  );
  const filters = [
    { value: "all", label: "전체" },
    { value: "open", label: reportStatusMap.open },
    { value: "reviewing", label: reportStatusMap.reviewing },
    { value: "resolved", label: reportStatusMap.resolved },
    { value: "dismissed", label: reportStatusMap.dismissed },
  ];

  return (
    <div className="altteulmap-segmented flex flex-wrap gap-2">
      {filters.map((filter) => {
        const selected = active === filter.value;
        const href =
          filter.value === "all"
            ? "/admin/reports"
            : `/admin/reports?status=${filter.value}`;

        return (
          <Link
            key={filter.value}
            to={href}
            data-testid={`admin-report-filter-${filter.value}`}
            data-active={selected ? "true" : "false"}
            className={`altteulmap-chip inline-flex items-center gap-2 border px-4 py-2 text-sm ${
              selected
                ? "border-[rgba(151,70,29,0.38)] bg-[rgba(181,90,43,0.12)] text-[var(--altteul-accent-text)]"
                : "border-stone-300 bg-white text-stone-700"
            }`}
          >
            {filter.label}
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs">
              {counts[filter.value as keyof typeof counts]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function ReportCard({
  report,
  disabled,
  onChanged,
}: {
  report: AdminReport;
  disabled: boolean;
  onChanged: () => void;
}) {
  const [status, setStatus] = useState<AdminReport["status"]>(report.status);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(nextStatus: AdminReport["status"]) {
    setMessage("처리 중입니다.");

    try {
      const result = await fetchJson<AdminActionResult<AdminReport>>(
        `/api/admin/reports/${report.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        },
      );

      setStatus(result.item?.status ?? nextStatus);
      setMessage(result.message);
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "처리하지 못했습니다.");
    }
  }

  return (
    <article data-testid="admin-report-card" className="altteulmap-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold text-[var(--altteul-accent-text)]">
            {report.id}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">
            {report.placeName}
          </h2>
          <p className="mt-2 text-sm text-stone-500">
            {reportReasonMap[report.reasonType]} · 접수 {report.createdAt}
          </p>
        </div>
        <span
          data-testid="admin-report-status-badge"
          className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-700"
        >
          {reportStatusMap[status]}
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-stone-700">{report.detail}</p>
      <div className="mt-4">
        <AdminAiReviewPanel
          fallback="신고 사유와 상세 내용을 확인한 뒤 운영자가 상태를 확정합니다."
          suggestion={report.moderationSuggestion}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {Object.entries(reportStatusMap).map(([value, label]) => {
          const nextStatus = value as AdminReport["status"];

          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              data-testid={`admin-report-status-${value}`}
              onClick={() => void submit(nextStatus)}
              className={`altteulmap-button px-4 py-2 text-sm disabled:opacity-50 ${
                status === nextStatus
                  ? "altteulmap-accent-solid"
                  : "border border-stone-300 bg-white text-stone-700"
              }`}
            >
              {label}
            </button>
          );
        })}
        <button
          type="button"
          disabled={disabled}
          onClick={() => void submit(status)}
          className="altteulmap-button altteulmap-accent-solid px-4 py-2 text-sm disabled:opacity-50"
        >
          상태 변경
        </button>
        <Link
          to={`/place/${report.placeId}`}
          className="altteulmap-button border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700"
        >
          장소 보기
        </Link>
        {message ? <p className="w-full text-sm text-stone-600">{message}</p> : null}
      </div>
    </article>
  );
}

