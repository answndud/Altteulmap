"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { PlacePriceItem } from "@/features/places/types";

type PlacePriceReportFormProps = {
  placeId: string;
  authenticated: boolean;
  loginHref: string;
  suggestedItems: PlacePriceItem[];
};

type PriceReportActionResponse = {
  ok: boolean;
  message: string;
};

export function PlacePriceReportForm({
  placeId,
  authenticated,
  loginHref,
  suggestedItems,
}: PlacePriceReportFormProps) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!authenticated) {
      router.push(loginHref);
      return;
    }

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
      if (response.status === 401) {
        router.push(loginHref);
        return;
      }
      setMessage(result.message);

      if (!response.ok || !result.ok) {
        return;
      }

      setAmount("");
      setComment("");
    });
  };

  return (
    <section className="rounded-[1.5rem] border border-stone-200 bg-white p-5">
      <h4 className="text-sm font-semibold text-stone-900">새 가격 제보</h4>
      <p className="mt-2 text-sm leading-6 text-stone-500">
        현재 가격이 바뀌었거나 새로운 항목을 발견했다면 남겨주세요. 운영 검토
        후 반영됩니다.
      </p>

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
              className="rounded-full border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {authenticated ? (
        <div className="mt-4 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
            <label className="grid gap-2 text-sm text-stone-700">
              가격 항목명
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                disabled={isPending}
                className="rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="예: 기본 김밥"
              />
            </label>
            <label className="grid gap-2 text-sm text-stone-700">
              가격(원)
              <input
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={isPending}
                className="rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="3500"
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm text-stone-700">
            단위
            <input
              value={unitLabel}
              onChange={(event) => setUnitLabel(event.target.value)}
              disabled={isPending}
              className="rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="예: 1줄, 1인분"
            />
          </label>

          <label className="grid gap-2 text-sm text-stone-700">
            메모
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              disabled={isPending}
              className="rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="예: 2026-03-31 점심 기준 가격표 확인"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-stone-500">
              같은 가격이 두 번 이상 누적되면 이후 검증 로직과 연결할 수 있게
              기록합니다.
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || label.trim().length === 0 || amount.trim().length === 0}
              className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "접수 중..." : "가격 제보 보내기"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.15rem] bg-stone-50 p-4">
          <p className="text-sm leading-6 text-stone-600">
            가격 제보를 남기려면 로그인이 필요합니다.
          </p>
          <Link
            href={loginHref}
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
          >
            로그인하고 제보하기
          </Link>
        </div>
      )}

      {message ? <p className="mt-3 text-xs text-stone-500">{message}</p> : null}
    </section>
  );
}
