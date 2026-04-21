"use client";

import { useState, useTransition } from "react";

import { getRateLimitFeedbackMessage } from "@/lib/rate-limit-feedback";
import type { PlacePriceItem } from "@/features/places/types";

type PlacePriceReportFormProps = {
  placeId: string;
  showHeader?: boolean;
  surface?: "panel" | "plain";
  suggestedItems: PlacePriceItem[];
};

type PriceReportActionResponse = {
  ok: boolean;
  message: string;
  retryAfterMs?: number;
};

type PriceReportFeedback = {
  tone: "success" | "error";
  text: string;
};

export function PlacePriceReportForm({
  placeId,
  showHeader = true,
  surface = "panel",
  suggestedItems,
}: PlacePriceReportFormProps) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [comment, setComment] = useState("");
  const [feedback, setFeedback] = useState<PriceReportFeedback | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      setFeedback(null);
      const response = await fetch(`/api/places/${encodeURIComponent(placeId)}/prices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          label,
          amount,
          unitLabel,
          comment,
        }),
      });

      const result = (await response.json()) as PriceReportActionResponse;
      const resolvedMessage = getRateLimitFeedbackMessage({
        response,
        message: result.message,
        retryAfterMs: result.retryAfterMs,
        defaultMessage: "가격 제보 요청이 너무 빠릅니다.",
      });

      if (!response.ok || !result.ok) {
        setFeedback({
          tone: "error",
          text: resolvedMessage,
        });
        return;
      }

      setFeedback({
        tone: "success",
        text: resolvedMessage,
      });
      setLabel("");
      setAmount("");
      setUnitLabel("");
      setComment("");
    });
  };
  const rootClassName =
    surface === "plain" ? "grid gap-4" : "altteulmap-panel p-4 sm:p-5";
  const suggestedItemsClassName = showHeader ? "mt-4 flex flex-wrap gap-2" : "flex flex-wrap gap-2";
  const formClassName =
    showHeader || suggestedItems.length > 0 ? "mt-4 grid gap-4" : "grid gap-4";

  return (
    <section
      data-testid="place-price-report-form"
      className={rootClassName}
    >
      {showHeader ? (
        <div>
          <p className="altteulmap-section-kicker text-[11px]">가격 제보</p>
          <h4 className="mt-1 text-base font-semibold text-stone-900">새 가격 추가</h4>
          <p className="mt-1 text-sm text-stone-500">
            지금 보이는 대표 가격과 다르면, 확인한 항목 1개만 먼저 남겨주세요.
          </p>
        </div>
      ) : null}

      {suggestedItems.length > 0 ? (
        <div className={suggestedItemsClassName}>
          {suggestedItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setLabel(item.label);
                setUnitLabel(item.unitLabel ?? "");
              }}
              disabled={isPending}
              className="altteulmap-button whitespace-nowrap border border-stone-300 bg-[var(--altteul-bg-subtle)]/75 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className={formClassName}>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <label className="grid min-w-0 gap-2 text-sm text-stone-700">
            가격 항목명
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              disabled={isPending}
              data-testid="price-report-label"
              className="altteulmap-input px-4 py-3.5 text-sm text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="예: 기본 김밥"
            />
          </label>
          <label className="grid min-w-0 gap-2 text-sm text-stone-700">
            가격(원)
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={isPending}
              data-testid="price-report-amount"
              className="altteulmap-input px-4 py-3.5 text-sm text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="3500"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <label className="grid min-w-0 gap-2 text-sm text-stone-700">
            단위
            <input
              value={unitLabel}
              onChange={(event) => setUnitLabel(event.target.value)}
              disabled={isPending}
              data-testid="price-report-unit"
              className="altteulmap-input px-4 py-3.5 text-sm text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="예: 1줄, 1인분"
            />
          </label>

          <label className="grid min-w-0 gap-2 text-sm text-stone-700">
            메모
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              disabled={isPending}
              data-testid="price-report-comment"
              className="altteulmap-input min-h-28 resize-y px-4 py-3.5 text-sm text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="예: 현장 메뉴판 확인, 2026-04-17 점심"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 border-t border-stone-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-stone-500">
            접수된 가격은 운영 검토 후 대표 가격에 반영됩니다.
          </p>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || label.trim().length === 0 || amount.trim().length === 0}
            data-testid="price-report-submit"
            className="altteulmap-accent-solid altteulmap-button inline-flex w-full items-center justify-center whitespace-nowrap px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isPending ? "접수 중..." : "가격 제보하기"}
          </button>
        </div>
      </div>

      {feedback ? (
        <div
          data-testid="price-report-message"
          className={`mt-4 rounded-[1rem] border px-4 py-3 text-sm ${
            feedback.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {feedback.text}
        </div>
      ) : null}
    </section>
  );
}
