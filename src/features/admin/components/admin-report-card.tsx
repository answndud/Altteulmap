"use client";

import Link from "next/link";
import { useState } from "react";

import { AdminReportStatusForm } from "@/features/reports/admin-report-status-form";
import {
  reportReasonMap,
  reportStatusMap,
  type ReportModerationInput,
} from "@/features/reports/schema";

type AdminReportCardProps = {
  report: {
    id: string;
    placeId: string;
    placeName: string;
    reasonType: keyof typeof reportReasonMap;
    detail: string;
    status: ReportModerationInput["status"];
    createdAt: string;
  };
  disabled?: boolean;
};

const statusClassMap = {
  open: "bg-rose-100 text-rose-700",
  reviewing: "bg-amber-100 text-amber-700",
  resolved: "bg-emerald-100 text-emerald-700",
  dismissed: "bg-stone-200 text-stone-700",
} as const;

export function AdminReportCard({
  report,
  disabled = false,
}: AdminReportCardProps) {
  const [status, setStatus] = useState(report.status);

  return (
    <article
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
          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClassMap[status]}`}
        >
          {reportStatusMap[status]}
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-stone-700">{report.detail}</p>
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
          currentStatus={status}
          disabled={disabled}
          onSuccess={(nextStatus) => {
            setStatus(nextStatus);
          }}
        />
      </div>
    </article>
  );
}
