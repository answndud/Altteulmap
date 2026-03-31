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
};

export function AdminReportStatusForm({
  reportId,
  currentStatus,
  disabled = false,
}: AdminReportStatusFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const handleUpdate = (status: keyof typeof reportStatusMap) => {
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

      if (response.ok && result.ok) {
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {reportStatusOptions.map((option) => {
          const isActive = option.value === currentStatus;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleUpdate(option.value)}
              disabled={disabled || isPending || isActive}
              className={`rounded-full px-3 py-2 text-xs font-medium transition ${
                isActive
                  ? "bg-stone-900 text-white"
                  : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {message ? (
        <p className="text-xs text-stone-500">
          {isPending ? "처리 중..." : message}
        </p>
      ) : null}
    </div>
  );
}
