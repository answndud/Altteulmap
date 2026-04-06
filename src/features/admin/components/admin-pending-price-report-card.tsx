"use client";

import Link from "next/link";
import { useState } from "react";

import { AdminAiReviewPanel } from "@/features/admin/components/admin-ai-review-panel";
import { AdminPriceReportReviewForm } from "@/features/places/admin-price-report-review-form";
import { formatKrw } from "@/features/places/queries";
import type { PendingPriceReportRecord } from "@/features/places/repository";

type AdminPendingPriceReportCardProps = {
  report: PendingPriceReportRecord;
  disabled?: boolean;
};

export function AdminPendingPriceReportCard({
  report,
  disabled = false,
}: AdminPendingPriceReportCardProps) {
  const [resolvedDecision, setResolvedDecision] = useState<
    "approve" | "reject" | null
  >(null);
  const [resolvedMessage, setResolvedMessage] = useState<string | null>(null);

  if (resolvedDecision) {
    const isApproved = resolvedDecision === "approve";

    return (
      <article
        data-testid="admin-price-report-processed-card"
        className={`rounded-[1.75rem] border p-5 ${
          isApproved
            ? "border-emerald-200 bg-emerald-50"
            : "border-stone-300 bg-stone-100"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
              {report.id}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-stone-900">
              {report.placeName}
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              {isApproved ? "가격 승인 완료" : "가격 반려 완료"} · 큐를 다시 불러오는 중입니다.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isApproved
                ? "bg-emerald-100 text-emerald-700"
                : "bg-stone-200 text-stone-700"
            }`}
          >
            {isApproved ? "가격 반영 대기" : "큐 제외 완료"}
          </span>
        </div>
        {resolvedMessage ? (
          <p className="mt-4 text-sm leading-6 text-stone-700">
            {resolvedMessage}
          </p>
        ) : null}
      </article>
    );
  }

  return (
    <article
      data-testid="admin-price-report-card"
      className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
            {report.id}
          </p>
          <h2
            data-testid="admin-price-report-place-name"
            className="mt-2 text-2xl font-semibold text-stone-900"
          >
            {report.placeName}
          </h2>
          <p className="mt-2 text-sm text-stone-500">
            {report.district} · 접수 {report.createdAt}
          </p>
        </div>
        <div className="rounded-3xl bg-white px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
            제보 가격
          </p>
          <p
            data-testid="admin-price-report-amount"
            className="mt-2 text-lg font-semibold text-stone-900"
          >
            {formatKrw(report.amount)}원
          </p>
          <p className="text-sm text-stone-500">
            {report.label}
            {report.unitLabel ? ` / ${report.unitLabel}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="rounded-3xl bg-white p-4 text-sm leading-6 text-stone-700">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
              현재 저장된 가격
            </p>
            {typeof report.existingPriceAmount === "number" ? (
              <>
                <p className="mt-2 font-medium text-stone-900">
                  {report.existingPriceLabel}
                </p>
                <p className="mt-1">
                  {formatKrw(report.existingPriceAmount)}원
                  {report.existingPriceUnitLabel
                    ? ` / ${report.existingPriceUnitLabel}`
                    : ""}
                </p>
                <p className="mt-2 text-xs text-stone-500">
                  {report.existingPriceVerificationStatus === "verified"
                    ? "현재 검증됨"
                    : "현재 미검증"}
                </p>
              </>
            ) : (
              <p className="mt-2">같은 이름의 기존 가격 항목이 없습니다.</p>
            )}
          </div>

          <div className="rounded-3xl bg-white p-4 text-sm leading-6 text-stone-700">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
              제보 메모
            </p>
            <p className="mt-2">
              {report.comment || "메모 없이 가격만 접수되었습니다."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/place/${report.placeId}`}
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
            >
              장소 보기
            </Link>
            <Link
              href={`/admin/prices/places/${report.placeId}`}
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
            >
              현재 가격 관리
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          {report.moderationSuggestion ? (
            <AdminAiReviewPanel suggestion={report.moderationSuggestion} />
          ) : null}
          <div className="rounded-3xl border border-stone-200 bg-white p-4">
            <p className="text-sm font-semibold text-stone-900">검토 액션</p>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              승인하면 현재 가격 항목을 덮어쓰거나 새 항목으로 추가합니다.
            </p>
            <div className="mt-4">
              <AdminPriceReportReviewForm
                reportId={report.id}
                disabled={disabled}
                onSuccess={(decision, message) => {
                  setResolvedDecision(decision);
                  setResolvedMessage(message);
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
