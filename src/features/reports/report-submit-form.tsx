"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState, useTransition } from "react";

import {
  reportReasonMap,
  reportReasonOptions,
  type ReportSubmissionFormInput,
  type ReportSubmissionInput,
  reportSubmissionSchema,
} from "@/features/reports/schema";

type SubmitResult = {
  ok: boolean;
  message: string;
  source?: "mock" | "database";
  preview?: {
    id: string;
    placeId: string;
    placeName: string;
    reasonType: keyof typeof reportReasonMap;
    detail: string;
  };
};

type ReportSubmitFormProps = {
  placeId: string;
  placeName: string;
};

export function ReportSubmitForm({
  placeId,
  placeName,
}: ReportSubmitFormProps) {
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<
    ReportSubmissionFormInput,
    undefined,
    ReportSubmissionInput
  >({
    resolver: zodResolver(reportSubmissionSchema),
    defaultValues: {
      placeId,
      placeName,
      reasonType: "price_error",
      detail: "",
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = (await response.json()) as SubmitResult;
      setSubmitResult(result);
    });
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <form
        onSubmit={onSubmit}
        className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="grid gap-6">
          <section>
            <p className="text-sm text-stone-500">신고 대상</p>
            <h2 className="mt-2 text-2xl font-semibold text-stone-900">
              {placeName}
            </h2>
            <p className="mt-2 text-sm text-stone-500">ID: {placeId}</p>
          </section>

          <input type="hidden" {...register("placeId")} />
          <input type="hidden" {...register("placeName")} />

          <label className="grid gap-2 text-sm text-stone-700">
            신고 유형
            <select
              {...register("reasonType")}
              className="rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
            >
              {reportReasonOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.reasonType ? (
              <span className="text-xs text-rose-600">
                {errors.reasonType.message}
              </span>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm text-stone-700">
            상세 설명
            <textarea
              {...register("detail")}
              rows={8}
              className="rounded-3xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
              placeholder="예: 가격표는 7,500원으로 바뀌었는데 화면에는 7,000원으로 표시됩니다."
            />
            {errors.detail ? (
              <span className="text-xs text-rose-600">
                {errors.detail.message}
              </span>
            ) : null}
          </label>

          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "신고 접수 중..." : "신고 제출"}
          </button>
        </div>
      </form>

      <aside className="space-y-6">
        <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">
            Reporting
          </p>
          <h2 className="mt-3 text-xl font-semibold text-stone-900">
            현재 단계에서 가능한 것
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-stone-600">
            <li>장소별 신고 진입과 유형 선택</li>
            <li>Zod 기반 서버 검증</li>
            <li>운영자 검토용 payload 확인</li>
            <li>목업 fallback 또는 DB 저장 경로 준비</li>
          </ul>
        </section>

        <section className="rounded-[2rem] border border-stone-200 bg-stone-50 p-6">
          <h2 className="text-xl font-semibold text-stone-900">신고 결과</h2>
          {submitResult ? (
            <div className="mt-4 space-y-4">
              <div
                className={`rounded-2xl px-4 py-3 text-sm ${
                  submitResult.ok
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {submitResult.message}
              </div>
              {submitResult.preview ? (
                <div className="rounded-3xl border border-stone-200 bg-white p-5 text-sm text-stone-700">
                  <p className="text-stone-500">신고 ID</p>
                  <p className="mt-1 font-medium text-stone-900">
                    {submitResult.preview.id}
                  </p>
                  {submitResult.source ? (
                    <>
                      <p className="mt-4 text-stone-500">처리 경로</p>
                      <p className="mt-1 font-medium text-stone-900">
                        {submitResult.source === "database" ? "DB" : "목업"}
                      </p>
                    </>
                  ) : null}
                  <p className="mt-4 text-stone-500">유형</p>
                  <p className="mt-1 font-medium text-stone-900">
                    {reportReasonMap[submitResult.preview.reasonType]}
                  </p>
                  <p className="mt-4 text-stone-500">상세 설명</p>
                  <p className="mt-1 leading-6 text-stone-700">
                    {submitResult.preview.detail}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-stone-600">
              아직 신고하지 않았습니다. 제출하면 서버 검증 결과와 정리된 신고
              payload를 여기서 확인할 수 있습니다.
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}
