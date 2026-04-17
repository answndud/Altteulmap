"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type AdminPriceItemFormProps = {
  itemId: string;
  label: string;
  amount: number;
  unitLabel?: string;
  verificationStatus: "verified" | "unverified";
  isRepresentative: boolean;
  isActive: boolean;
  disabled?: boolean;
};

type AdminPriceItemResponse = {
  ok: boolean;
  message: string;
};

export function AdminPriceItemForm({
  itemId,
  label: initialLabel,
  amount: initialAmount,
  unitLabel: initialUnitLabel,
  verificationStatus: initialVerificationStatus,
  isRepresentative: initialIsRepresentative,
  isActive: initialIsActive,
  disabled = false,
}: AdminPriceItemFormProps) {
  const router = useRouter();
  const [label, setLabel] = useState(initialLabel);
  const [amount, setAmount] = useState(String(initialAmount));
  const [unitLabel, setUnitLabel] = useState(initialUnitLabel ?? "");
  const [verificationStatus, setVerificationStatus] = useState(
    initialVerificationStatus,
  );
  const [isActive, setIsActive] = useState(initialIsActive);
  const [isRepresentative, setIsRepresentative] = useState(initialIsRepresentative);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"default" | "success" | "error">(
    "default",
  );
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (overrides?: {
    isActive?: boolean;
    isRepresentative?: boolean;
    pendingLabel?: string;
  }) => {
    setPendingLabel(overrides?.pendingLabel ?? "저장");

    startTransition(async () => {
      const nextIsActive = overrides?.isActive ?? isActive;
      const nextIsRepresentative =
        nextIsActive && (overrides?.isRepresentative ?? isRepresentative);

      const response = await fetch(`/api/admin/price-items/${itemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          label,
          amount,
          unitLabel,
          verificationStatus,
          isActive: nextIsActive,
          isRepresentative: nextIsRepresentative,
        }),
      });

      const result = (await response.json()) as AdminPriceItemResponse;
      setMessage(result.message);
      setMessageTone(response.ok && result.ok ? "success" : "error");

      if (response.ok && result.ok) {
        setIsActive(nextIsActive);
        setIsRepresentative(nextIsRepresentative);
        router.refresh();
      }
    });
  };

  return (
    <div className="grid gap-4 rounded-[1.05rem] border border-stone-200 bg-white p-4">
      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <label className="grid gap-2 text-sm text-stone-700">
          항목명
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            disabled={disabled || isPending}
            className="altteulmap-input px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <label className="grid gap-2 text-sm text-stone-700">
          금액
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={disabled || isPending}
            className="altteulmap-input px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <label className="grid gap-2 text-sm text-stone-700">
          단위
          <input
            value={unitLabel}
            onChange={(event) => setUnitLabel(event.target.value)}
            disabled={disabled || isPending}
            className="altteulmap-input px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm text-stone-700">
          검증 상태
          <select
            value={verificationStatus}
            onChange={(event) =>
              setVerificationStatus(
                event.target.value as "verified" | "unverified",
              )
            }
            disabled={disabled || isPending}
            className="altteulmap-input px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="verified">검증됨</option>
            <option value="unverified">미검증</option>
          </select>
        </label>
        <div className="grid gap-2 text-sm text-stone-700">
          <span>상태</span>
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                isActive
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-stone-200 text-stone-700"
              }`}
            >
              {isActive ? "노출 중" : "숨김"}
            </span>
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                isRepresentative
                  ? "bg-orange-100 text-orange-700"
                  : "bg-stone-100 text-stone-600"
              }`}
            >
              {isRepresentative ? "대표 가격" : "일반 가격"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => submit({ pendingLabel: "저장" })}
          disabled={disabled || isPending}
          className="altteulmap-accent-solid altteulmap-button px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
        >
          저장
        </button>
        <button
          type="button"
          onClick={() =>
            submit({
              isRepresentative: true,
              isActive: true,
              pendingLabel: "대표 가격 지정",
            })
          }
          disabled={disabled || isPending || !isActive}
          className="altteulmap-button border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          대표 가격 지정
        </button>
        <button
          type="button"
          onClick={() =>
            submit({
              isActive: !isActive,
              isRepresentative: false,
              pendingLabel: isActive ? "숨기기" : "복원",
            })
          }
          disabled={disabled || isPending}
          className="altteulmap-button border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isActive ? "숨기기" : "복원"}
        </button>
      </div>

      {message ? (
        <div
          aria-live="polite"
          className={`rounded-[0.95rem] border px-4 py-3 text-sm ${
            messageTone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : messageTone === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-stone-200 bg-[var(--altteul-bg-subtle)]/55 text-stone-500"
          }`}
        >
          {isPending ? `${pendingLabel ?? "처리"} 반영 중...` : message}
        </div>
      ) : null}
    </div>
  );
}
