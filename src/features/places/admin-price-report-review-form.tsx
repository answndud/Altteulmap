"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type AdminPriceReportReviewFormProps = {
  reportId: string;
  disabled?: boolean;
};

export function AdminPriceReportReviewForm({
  reportId,
  disabled = false,
}: AdminPriceReportReviewFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submitDecision = (decision: "approve" | "reject") => {
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

      if (response.ok && result.ok) {
        router.refresh();
      }
    });
  };

  return (
    <div data-testid="admin-price-review-form" className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => submitDecision("approve")}
          disabled={disabled || isPending}
          data-testid="admin-price-approve-button"
          className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          승인
        </button>
        <button
          type="button"
          onClick={() => submitDecision("reject")}
          disabled={disabled || isPending}
          data-testid="admin-price-reject-button"
          className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          반려
        </button>
      </div>
      {message ? (
        <p data-testid="admin-price-review-message" className="text-xs text-stone-500">
          {isPending ? "처리 중..." : message}
        </p>
      ) : null}
    </div>
  );
}
