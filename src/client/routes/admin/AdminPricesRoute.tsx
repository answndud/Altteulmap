import { useCallback, useState } from "react";
import { Link } from "react-router-dom";

import { fetchJson } from "@/client/routes/admin/api";
import { AdminAccessGate } from "@/client/routes/admin/AdminAccessGate";
import { AdminFrame } from "@/client/routes/admin/AdminFrame";
import { AdminAiReviewPanel, DataBadge, EmptyPanel } from "@/client/routes/admin/AdminShared";
import { formatKrw } from "@/client/routes/admin/labels";
import { useAdminData } from "@/client/routes/admin/useAdminData";
import type { AdminActionResult, AdminListResponse, PendingPriceReport } from "@/client/routes/admin/types";

export function AdminPricesRoute() {
  const [version, setVersion] = useState(0);
  const loadPrices = useCallback(
    () => {
      void version;
      return fetchJson<AdminListResponse<PendingPriceReport>>("/api/admin/prices");
    },
    [version],
  );
  const state = useAdminData(loadPrices);

  return (
    <AdminFrame
      title="가격 제보 검토 큐"
      description="기존 장소에 들어온 가격 제보를 승인하거나 반려합니다."
    >
      <AdminAccessGate state={state}>
        {(data) => (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DataBadge source={data.source} mock={data.mock} />
              <span className="altteulmap-badge border-stone-200 bg-white text-stone-600">
                {data.count}건
              </span>
            </div>
            <div className="grid gap-4" data-testid="admin-price-report-list">
              {data.items.length > 0 ? (
                data.items.map((report) => (
                  <PendingPriceCard
                    key={report.id}
                    report={report}
                    disabled={data.mock}
                    onChanged={() => setVersion((value) => value + 1)}
                  />
                ))
              ) : (
                <EmptyPanel message="현재 검토 대기 중인 가격 제보가 없습니다." />
              )}
            </div>
          </div>
        )}
      </AdminAccessGate>
    </AdminFrame>
  );
}

function PendingPriceCard({
  report,
  disabled,
  onChanged,
}: {
  report: PendingPriceReport;
  disabled: boolean;
  onChanged: () => void;
}) {
  const [status, setStatus] = useState<string | null>(null);

  async function submit(decision: "approve" | "reject") {
    setStatus("처리 중입니다.");

    try {
      const result = await fetchJson<AdminActionResult<PendingPriceReport>>(
        `/api/admin/prices/${report.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ decision }),
        },
      );

      setStatus(result.message);
      onChanged();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "처리하지 못했습니다.");
    }
  }

  return (
    <article data-testid="admin-price-report-card" className="altteulmap-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold text-[var(--altteul-accent-text)]">
            {report.id}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">
            {report.placeName}
          </h2>
          <p className="mt-2 text-sm text-stone-500">
            {report.district} · 접수 {report.createdAt}
          </p>
        </div>
        <div className="altteulmap-panel-muted px-4 py-3 text-right">
          <p className="text-[11px] text-stone-500">제보 가격</p>
          <p className="altteulmap-price-number mt-2 text-lg">
            {formatKrw(report.amount)}원
          </p>
          <p className="text-sm text-stone-500">
            {report.label}
            {report.unitLabel ? ` / ${report.unitLabel}` : ""}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="altteulmap-panel-muted p-4 text-sm leading-6 text-stone-700">
          <p className="text-[11px] text-stone-500">현재 저장된 가격</p>
          {typeof report.existingPriceAmount === "number" ? (
            <p className="mt-2">
              {report.existingPriceLabel} ·{" "}
              {formatKrw(report.existingPriceAmount)}원
              {report.existingPriceUnitLabel
                ? ` / ${report.existingPriceUnitLabel}`
                : ""}
            </p>
          ) : (
            <p className="mt-2">같은 이름의 기존 가격 항목이 없습니다.</p>
          )}
          <p className="mt-3">{report.comment || "메모 없이 접수되었습니다."}</p>
          <div className="mt-3">
            <AdminAiReviewPanel
              fallback="기존 가격과 제보 금액의 차이, 메모 내용을 운영자가 최종 확인합니다."
              suggestion={report.moderationSuggestion}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => void submit("approve")}
            className="altteulmap-button altteulmap-accent-solid px-4 py-2 text-sm disabled:opacity-50"
          >
            승인
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void submit("reject")}
            data-testid="admin-price-reject-button"
            className="altteulmap-button border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 disabled:opacity-50"
          >
            반려
          </button>
          <Link
            to={`/admin/prices/places/${report.placeId}`}
            className="altteulmap-button border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700"
          >
            가격 관리
          </Link>
          {status ? <p className="w-full text-sm text-stone-600">{status}</p> : null}
        </div>
      </div>
    </article>
  );
}

