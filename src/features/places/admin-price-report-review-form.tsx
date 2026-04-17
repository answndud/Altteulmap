"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type AdminPriceReportReviewFormProps = {
  reportId: string;
  disabled?: boolean;
  onSuccess?: (decision: "approve" | "reject", message: string) => void;
};

export function AdminPriceReportReviewForm({
  reportId,
  disabled = false,
  onSuccess,
}: AdminPriceReportReviewFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"default" | "success" | "error">(
    "default",
  );
  const [lastDecision, setLastDecision] = useState<"approve" | "reject" | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const submitDecision = (decision: "approve" | "reject") => {
    setLastDecision(decision);

    startTransition(async () => {
      const response = await fetch(`/api/admin/prices/${reportId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ decision }),
      });

      const result = (await response.json()) as {
        ok: boolean;
        message: string;
      };

      setMessage(result.message);
      setMessageTone(response.ok && result.ok ? "success" : "error");

      if (response.ok && result.ok) {
        onSuccess?.(decision, result.message);
        router.refresh();
      }
    });
  };

  return (
    <div data-testid="admin-price-review-form" className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => submitDecision("approve")}
          disabled={disabled || isPending}
          data-testid="admin-price-approve-button"
          className="altteulmap-accent-solid altteulmap-button px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
        >
          승인
        </button>
        <button
          type="button"
          onClick={() => submitDecision("reject")}
          disabled={disabled || isPending}
          data-testid="admin-price-reject-button"
          className="altteulmap-button border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          반려
        </button>
      </div>
      {message ? (
        <div
          data-testid="admin-price-review-message"
          aria-live="polite"
          className={`rounded-[0.95rem] border px-4 py-3 text-sm ${
            messageTone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : messageTone === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-stone-200 bg-[var(--altteul-bg-subtle)]/55 text-stone-500"
          }`}
        >
          {isPending
            ? lastDecision === "approve"
              ? "승인 반영 중..."
              : "반려 반영 중..."
            : message}
        </div>
      ) : null}
    </div>
  );
}
