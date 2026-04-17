"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  reportStatusMap,
  reportStatusOptions,
} from "@/features/reports/schema";

type AdminReportStatusFormProps = {
  reportId: string;
  currentStatus: keyof typeof reportStatusMap;
  disabled?: boolean;
  onSuccess?: (
    status: keyof typeof reportStatusMap,
    message: string,
  ) => void;
};

export function AdminReportStatusForm({
  reportId,
  currentStatus,
  disabled = false,
  onSuccess,
}: AdminReportStatusFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"default" | "success" | "error">(
    "default",
  );
  const [pendingStatus, setPendingStatus] = useState<
    keyof typeof reportStatusMap | null
  >(null);

  const handleUpdate = (status: keyof typeof reportStatusMap) => {
    setPendingStatus(status);

    startTransition(async () => {
      const response = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const result = (await response.json()) as {
        ok: boolean;
        message: string;
      };

      setMessage(result.message);
      setMessageTone(response.ok && result.ok ? "success" : "error");

      if (response.ok && result.ok) {
        onSuccess?.(status, result.message);
        router.refresh();
      }
    });
  };

  return (
    <div data-testid="admin-report-status-form" className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {reportStatusOptions.map((option) => {
          const isActive = option.value === currentStatus;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleUpdate(option.value)}
              disabled={disabled || isPending || isActive}
              data-testid={`admin-report-status-${option.value}`}
              className={`altteulmap-button px-3 py-2 text-xs font-medium transition ${
                isActive
                  ? "altteulmap-accent-solid"
                  : "border border-stone-300 bg-white text-stone-700 hover:bg-white"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {message ? (
        <div
          data-testid="admin-report-status-message"
          aria-live="polite"
          className={`rounded-[0.95rem] border px-4 py-3 text-sm ${
            messageTone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : messageTone === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-stone-200 bg-[var(--altteul-bg-subtle)]/55 text-stone-500"
          }`}
        >
          {isPending && pendingStatus
            ? `${reportStatusMap[pendingStatus]} 상태로 반영 중...`
            : message}
        </div>
      ) : null}
    </div>
  );
}
