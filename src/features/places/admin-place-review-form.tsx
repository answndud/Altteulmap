"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { AdminPlaceCoordinatePicker } from "@/features/places/admin-place-coordinate-picker";

type AdminPlaceReviewFormProps = {
  placeId: string;
  placeName: string;
  address: string;
  district: string;
  defaultLatitude?: number;
  defaultLongitude?: number;
  disabled?: boolean;
};

export function AdminPlaceReviewForm({
  placeId,
  placeName,
  address,
  district,
  defaultLatitude,
  defaultLongitude,
  disabled = false,
}: AdminPlaceReviewFormProps) {
  const router = useRouter();
  const [latitude, setLatitude] = useState(
    defaultLatitude ? String(defaultLatitude) : "",
  );
  const [longitude, setLongitude] = useState(
    defaultLongitude ? String(defaultLongitude) : "",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submitDecision = (decision: "approve" | "reject") => {
    startTransition(async () => {
      const response = await fetch(`/api/admin/places/${placeId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          decision,
          latitude: latitude ? Number(latitude) : undefined,
          longitude: longitude ? Number(longitude) : undefined,
        }),
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
    <div
      data-testid="admin-review-form"
      className="space-y-4 rounded-3xl border border-stone-200 bg-white p-4"
    >
      <AdminPlaceCoordinatePicker
        placeName={placeName}
        address={address}
        district={district}
        latitude={latitude}
        longitude={longitude}
        onChange={({ latitude: nextLatitude, longitude: nextLongitude }) => {
          setLatitude(nextLatitude);
          setLongitude(nextLongitude);
        }}
        disabled={disabled || isPending}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm text-stone-700">
          위도
          <input
            type="number"
            step="0.000001"
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
            disabled={disabled || isPending}
            data-testid="admin-latitude"
            className="rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
            placeholder="37.5665"
          />
        </label>
        <label className="grid gap-2 text-sm text-stone-700">
          경도
          <input
            type="number"
            step="0.000001"
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
            disabled={disabled || isPending}
            data-testid="admin-longitude"
            className="rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
            placeholder="126.9780"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => submitDecision("approve")}
          disabled={disabled || isPending}
          data-testid="admin-approve-button"
          className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          승인
        </button>
        <button
          type="button"
          onClick={() => submitDecision("reject")}
          disabled={disabled || isPending}
          data-testid="admin-reject-button"
          className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          반려
        </button>
      </div>

      {message ? (
        <p data-testid="admin-review-message" className="text-xs text-stone-500">
          {isPending ? "처리 중..." : message}
        </p>
      ) : null}
    </div>
  );
}
