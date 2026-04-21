"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState, useTransition } from "react";

import { getRateLimitFeedbackMessage } from "@/lib/rate-limit-feedback";
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
  retryAfterMs?: number;
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
      setSubmitResult({
        ...result,
        message: getRateLimitFeedbackMessage({
          response,
          message: result.message,
          retryAfterMs: result.retryAfterMs,
          defaultMessage: "신고 요청이 너무 빠릅니다.",
        }),
      });
    });
  });

  return (
    <div
      className={
        submitResult
          ? "grid gap-6 lg:grid-cols-[1.05fr_0.95fr]"
          : "grid gap-6"
      }
    >
      <form
        onSubmit={onSubmit}
        data-testid="report-submit-form"
        className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="grid gap-6">
          <section>
            <p className="text-sm text-stone-500">신고 대상</p>
            <h2 className="mt-2 text-2xl font-semibold text-stone-900">
              {placeName}
            </h2>
          </section>

          <input type="hidden" {...register("placeId")} />
          <input type="hidden" {...register("placeName")} />

          <label className="grid gap-2 text-sm text-stone-700">
            신고 유형
            <select
              {...register("reasonType")}
              data-testid="report-reason"
              className="altteulmap-input px-4 py-3.5 text-stone-900"
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
              data-testid="report-detail"
              className="altteulmap-input min-h-44 resize-y px-4 py-3.5 text-stone-900"
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
            data-testid="report-submit-button"
            className="altteulmap-accent-solid altteulmap-button inline-flex w-full items-center justify-center whitespace-nowrap px-5 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isPending ? "요청 보내는 중..." : "정보 수정 요청 보내기"}
          </button>
        </div>
      </form>

      {submitResult ? (
        <aside data-testid="report-result">
          <section className="rounded-[2rem] border border-stone-200 bg-stone-50 p-6">
            <h2 className="text-xl font-semibold text-stone-900">접수 내용</h2>
            <div className="mt-4 space-y-4">
              <div
                data-testid="report-result-message"
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
                  <p className="text-stone-500">유형</p>
                  <p className="mt-1 font-medium text-stone-900">
                    {reportReasonMap[submitResult.preview.reasonType]}
                  </p>
                  <p className="mt-4 text-stone-500">상세 설명</p>
                  <p
                    data-testid="report-result-detail"
                    className="mt-1 leading-6 text-stone-700"
                  >
                    {submitResult.preview.detail}
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        </aside>
      ) : null}
    </div>
  );
}
