import { useCallback, useState } from "react";

import { fetchJson } from "@/client/routes/admin/api";
import { AdminAccessGate } from "@/client/routes/admin/AdminAccessGate";
import { AdminFrame } from "@/client/routes/admin/AdminFrame";
import { AdminAiReviewPanel, DataBadge, EmptyPanel } from "@/client/routes/admin/AdminShared";
import { formatKrw } from "@/client/routes/admin/labels";
import { useAdminData } from "@/client/routes/admin/useAdminData";
import type { AdminActionResult, AdminListResponse, PendingPlace } from "@/client/routes/admin/types";

export function AdminPlacesRoute() {
  const [version, setVersion] = useState(0);
  const loadPlaces = useCallback(
    () => {
      void version;
      return fetchJson<AdminListResponse<PendingPlace>>("/api/admin/places");
    },
    [version],
  );
  const state = useAdminData(loadPlaces);

  return (
    <AdminFrame
      title="신규 장소 승인 큐"
      description="공개 등록 폼으로 들어온 장소 제보를 승인 또는 반려합니다."
    >
      <AdminAccessGate state={state}>
        {(data) => (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DataBadge source={data.source} mock={data.mock} />
              <span className="altteulmap-badge border-stone-200 bg-white text-stone-600">
                {data.count}건
              </span>
            </div>
            {data.items.length > 0 ? (
              <div className="grid gap-4" data-testid="admin-pending-place-list">
                {data.items.map((place) => (
                  <PendingPlaceCard
                    key={place.id}
                    place={place}
                    disabled={data.mock}
                    onChanged={() => setVersion((value) => value + 1)}
                  />
                ))}
              </div>
            ) : (
              <EmptyPanel message="현재 승인 대기 중인 장소 제보가 없습니다." />
            )}
          </div>
        )}
      </AdminAccessGate>
    </AdminFrame>
  );
}

function PendingPlaceCard({
  place,
  disabled,
  onChanged,
}: {
  place: PendingPlace;
  disabled: boolean;
  onChanged: () => void;
}) {
  const [latitude, setLatitude] = useState(
    typeof place.latitude === "number" ? String(place.latitude) : "",
  );
  const [longitude, setLongitude] = useState(
    typeof place.longitude === "number" ? String(place.longitude) : "",
  );
  const [status, setStatus] = useState<string | null>(null);

  async function submit(decision: "approve" | "reject") {
    setStatus("처리 중입니다.");

    try {
      const body =
        decision === "approve"
          ? { decision, latitude: Number(latitude), longitude: Number(longitude) }
          : { decision };
      const result = await fetchJson<AdminActionResult<PendingPlace>>(
        `/api/admin/places/${place.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      );

      setStatus(result.message);
      onChanged();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "처리하지 못했습니다.");
    }
  }

  return (
    <article data-testid="admin-place-card" className="altteulmap-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold text-[var(--altteul-accent-text)]">
            {place.id}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">
            {place.name}
          </h2>
          <p className="mt-2 text-sm text-stone-500">
            {place.businessName ?? place.name} · {place.district} · 접수{" "}
            {place.createdAt}
          </p>
        </div>
        <div className="altteulmap-panel-muted px-4 py-3 text-right">
          <p className="text-[11px] text-stone-500">대표 가격</p>
          <p className="altteulmap-price-number mt-2 text-lg">
            {formatKrw(place.representativePriceAmount)}원
          </p>
          <p className="text-sm text-stone-500">
            {place.representativePriceLabel}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-3 text-sm leading-6 text-stone-700">
          <div className="altteulmap-panel-muted p-4">
            <p className="text-[11px] text-stone-500">주소</p>
            <p className="mt-2">{place.address}</p>
          </div>
          <div className="altteulmap-panel-muted p-4">
            <p className="text-[11px] text-stone-500">메모</p>
            <p className="mt-2">{place.note}</p>
          </div>
          <div className="altteulmap-panel-muted p-4">
            <p className="text-[11px] text-stone-500">가격 항목</p>
            <div className="mt-3 grid gap-2">
              {place.priceItems.map((item) => (
                <div key={item.id} className="rounded-xl bg-white px-4 py-3">
                  {item.label} · {formatKrw(item.amount)}원
                  {item.unitLabel ? ` / ${item.unitLabel}` : ""}
                </div>
              ))}
            </div>
          </div>
          <AdminAiReviewPanel fallback="주소, 업종, 가격 입력값을 운영자가 최종 확인한 뒤 승인합니다." />
        </div>
        <div className="altteulmap-panel-muted grid gap-3 p-4">
          <label className="grid gap-1 text-sm text-stone-700">
            위도
            <input
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
              data-testid="admin-latitude"
              className="rounded-xl border border-stone-300 px-3 py-2"
              placeholder="37.5665"
            />
          </label>
          <label className="grid gap-1 text-sm text-stone-700">
            경도
            <input
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
              data-testid="admin-longitude"
              className="rounded-xl border border-stone-300 px-3 py-2"
              placeholder="126.9780"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => void submit("approve")}
              data-testid="admin-approve-button"
              className="altteulmap-button altteulmap-accent-solid px-4 py-2 text-sm disabled:opacity-50"
            >
              승인
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => void submit("reject")}
              className="altteulmap-button border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 disabled:opacity-50"
            >
              반려
            </button>
          </div>
          {status ? <p className="text-sm text-stone-600">{status}</p> : null}
        </div>
      </div>
    </article>
  );
}

