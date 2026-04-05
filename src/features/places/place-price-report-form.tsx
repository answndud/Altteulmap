"use client";

import { useState, useTransition } from "react";

import { getRateLimitFeedbackMessage } from "@/lib/rate-limit-feedback";
import type { PlacePriceItem } from "@/features/places/types";

type PlacePriceReportFormProps = {
  placeId: string;
  suggestedItems: PlacePriceItem[];
};

type PriceReportActionResponse = {
  ok: boolean;
  message: string;
  retryAfterMs?: number;
};

export function PlacePriceReportForm({
  placeId,
  suggestedItems,
}: PlacePriceReportFormProps) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
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
      setMessage(
        getRateLimitFeedbackMessage({
          response,
          message: result.message,
          retryAfterMs: result.retryAfterMs,
          defaultMessage: "가격 제보 요청이 너무 빠릅니다.",
        }),
      );

      if (!response.ok || !result.ok) {
        return;
      }

      setAmount("");
      setComment("");
    });
  };

  return (
    <section
      data-testid="place-price-report-form"
      className="rounded-[1.5rem] border border-stone-200 bg-white p-4 sm:p-5"
    >
      <h4 className="text-sm font-semibold text-stone-900">새 가격 제보</h4>

      {suggestedItems.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestedItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setLabel(item.label);
                setUnitLabel(item.unitLabel ?? "");
              }}
              disabled={isPending}
              className="altteulmap-button whitespace-nowrap border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <label className="grid min-w-0 gap-2 text-sm text-stone-700">
            가격 항목명
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              disabled={isPending}
              data-testid="price-report-label"
              className="altteulmap-input px-4 py-3.5 text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
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
              className="altteulmap-input px-4 py-3.5 text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="3500"
            />
          </label>
        </div>

        <label className="grid min-w-0 gap-2 text-sm text-stone-700">
          단위
          <input
            value={unitLabel}
            onChange={(event) => setUnitLabel(event.target.value)}
            disabled={isPending}
            data-testid="price-report-unit"
            className="altteulmap-input px-4 py-3.5 text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
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
            className="altteulmap-input min-h-32 resize-y px-4 py-3.5 text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
            placeholder="예: 2026-03-31 점심 기준 가격표 확인"
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || label.trim().length === 0 || amount.trim().length === 0}
            data-testid="price-report-submit"
            className="altteulmap-accent-solid altteulmap-button inline-flex w-full items-center justify-center whitespace-nowrap px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isPending ? "접수 중..." : "제보 보내기"}
          </button>
        </div>
      </div>

      {message ? (
        <p data-testid="price-report-message" className="mt-3 text-xs text-stone-500">
          {message}
        </p>
      ) : null}
    </section>
  );
}
