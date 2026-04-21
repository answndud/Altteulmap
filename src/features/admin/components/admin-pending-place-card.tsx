"use client";

import Link from "next/link";
import { useState } from "react";

import { AdminAiReviewPanel } from "@/features/admin/components/admin-ai-review-panel";
import { getCategoryBySlug } from "@/features/categories/catalog";
import { AdminPlaceReviewForm } from "@/features/places/admin-place-review-form";
import { formatKrw } from "@/features/places/queries";
import type { PendingPlaceRecord } from "@/features/places/repository";

type AdminPendingPlaceCardProps = {
  place: PendingPlaceRecord;
  disabled?: boolean;
};

export function AdminPendingPlaceCard({
  place,
  disabled = false,
}: AdminPendingPlaceCardProps) {
  const [resolvedDecision, setResolvedDecision] = useState<
    "approve" | "reject" | null
  >(null);
  const [resolvedMessage, setResolvedMessage] = useState<string | null>(null);

  if (resolvedDecision) {
    const isApproved = resolvedDecision === "approve";

    return (
      <article
        data-testid="admin-place-processed-card"
        className={`rounded-[1.15rem] border p-4 ${
          isApproved
            ? "border-emerald-200 bg-emerald-50"
            : "border-stone-300 bg-[var(--altteul-bg-subtle)]/75"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold text-[var(--altteul-accent-text)]">
              {place.id}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-stone-950">
              {place.name}
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              {isApproved ? "승인 완료" : "반려 완료"} · 목록을 다시 불러오는 중입니다.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isApproved
                ? "bg-emerald-100 text-emerald-700"
                : "bg-stone-200 text-stone-700"
            }`}
          >
            {isApproved ? "지도 반영 대기" : "큐 제외 완료"}
          </span>
        </div>
        {resolvedMessage ? (
          <p className="mt-4 text-sm leading-6 text-stone-700">
            {resolvedMessage}
          </p>
        ) : null}
      </article>
    );
  }

  const category = getCategoryBySlug(place.categorySlug);

  return (
    <article
      data-testid="admin-place-card"
      className="altteulmap-panel p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold text-[var(--altteul-accent-text)]">
            {place.id}
          </p>
          <h2
            data-testid="admin-place-name"
            className="mt-2 text-xl font-semibold text-stone-950"
          >
            {place.name}
          </h2>
          <p className="mt-2 text-sm text-stone-500">
            {place.businessName ?? place.name} · {category?.name ?? "기타"} · 접수{" "}
            {place.createdAt}
          </p>
        </div>
        <div className="altteulmap-panel-muted px-4 py-3 text-right">
          <p className="text-[11px] text-stone-500">
            대표 가격
          </p>
          <p className="altteulmap-price-number mt-2 text-lg">
            {formatKrw(place.representativePriceAmount)}원
          </p>
          <p className="text-sm text-stone-500">{place.representativePriceLabel}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-4">
          <div className="altteulmap-panel-muted p-4 text-sm leading-6 text-stone-700">
            <p className="text-[11px] text-stone-500">
              주소
            </p>
            <p className="mt-2">{place.address}</p>
            <p className="text-stone-500">{place.district}</p>
          </div>
          <div className="altteulmap-panel-muted p-4 text-sm leading-6 text-stone-700">
            <p className="text-[11px] text-stone-500">
              메모
            </p>
            <p className="mt-2">{place.note}</p>
          </div>
          <div className="altteulmap-panel-muted p-4">
            <p className="text-[11px] text-stone-500">
              제출된 가격 항목
            </p>
            <div className="mt-3 grid gap-2">
              {place.priceItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[0.9rem] border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700"
                >
                  {item.label} · {formatKrw(item.amount)}원
                  {item.unitLabel ? ` / ${item.unitLabel}` : ""}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          {place.moderationSuggestion ? (
            <AdminAiReviewPanel suggestion={place.moderationSuggestion} />
          ) : null}
          <AdminPlaceReviewForm
            placeId={place.id}
            placeName={place.name}
            address={place.address}
            district={place.district}
            defaultLatitude={place.latitude}
            defaultLongitude={place.longitude}
            disabled={disabled}
            onSuccess={(decision, message) => {
              setResolvedDecision(decision);
              setResolvedMessage(message);
            }}
          />
          <Link
            href={`/report?placeId=${place.id}&placeName=${encodeURIComponent(place.name)}`}
            className="altteulmap-button inline-flex border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-white"
          >
            신고 폼으로 보기
          </Link>
        </div>
      </div>
    </article>
  );
}
