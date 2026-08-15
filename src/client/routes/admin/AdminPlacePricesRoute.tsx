import { useCallback, useState } from "react";
import { useParams } from "react-router-dom";

import { fetchJson } from "@/client/routes/admin/api";
import { AdminAccessGate } from "@/client/routes/admin/AdminAccessGate";
import { AdminFrame } from "@/client/routes/admin/AdminFrame";
import { DataBadge, EmptyPanel } from "@/client/routes/admin/AdminShared";
import { formatKrw } from "@/client/routes/admin/labels";
import { useAdminData } from "@/client/routes/admin/useAdminData";
import type { AdminActionResult, AdminPlacePriceDetail, AdminPriceItem } from "@/client/routes/admin/types";

export function AdminPlacePricesRoute() {
  const { id } = useParams();
  const [version, setVersion] = useState(0);
  const loadPlacePriceDetail = useCallback(
    () => {
      void version;
      return fetchJson<AdminPlacePriceDetail>(
        `/api/admin/prices/places/${encodeURIComponent(id ?? "")}`,
      );
    },
    [id, version],
  );
  const state = useAdminData(loadPlacePriceDetail);

  return (
    <AdminFrame
      title="장소 가격 관리"
      description="현재 저장된 가격 항목을 수정하거나 대표 가격, 검증 상태, 노출 상태를 조정합니다."
    >
      <AdminAccessGate state={state}>
        {(data) => {
          if (!data.item) {
            return <EmptyPanel message="가격 관리 대상을 찾지 못했습니다." />;
          }

          return (
            <div className="grid gap-5">
              <div className="altteulmap-panel-muted p-5">
                <DataBadge source={data.source} mock={data.source !== "database"} />
                <h2 className="mt-4 text-2xl font-semibold text-stone-950">
                  {data.item.name}
                </h2>
                <p className="mt-2 text-sm text-stone-600">
                  {data.item.district} · 대표 가격{" "}
                  {formatKrw(data.item.representativePriceAmount)}원 ·{" "}
                  {data.item.representativePriceLabel}
                </p>
              </div>
              {data.item.priceItems.length > 0 ? (
                <div className="grid gap-4">
                  {data.item.priceItems.map((item) => (
                    <PriceItemEditor
                      key={item.id}
                      item={item}
                      disabled={data.source !== "database"}
                      onChanged={() => setVersion((value) => value + 1)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyPanel message="등록된 가격 항목이 없습니다." />
              )}
            </div>
          );
        }}
      </AdminAccessGate>
    </AdminFrame>
  );
}

function PriceItemEditor({
  item,
  disabled,
  onChanged,
}: {
  item: AdminPriceItem;
  disabled: boolean;
  onChanged: () => void;
}) {
  const [label, setLabel] = useState(item.label);
  const [amount, setAmount] = useState(String(item.amount));
  const [unitLabel, setUnitLabel] = useState(item.unitLabel ?? "");
  const [verificationStatus, setVerificationStatus] = useState(
    item.verificationStatus,
  );
  const [isRepresentative, setIsRepresentative] = useState(item.isRepresentative);
  const [isActive, setIsActive] = useState(item.isActive);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setMessage("저장 중입니다.");

    try {
      const result = await fetchJson<
        AdminActionResult<AdminPriceItem> & { placeId: string | null }
      >(`/api/admin/price-items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          label,
          amount: Number(amount),
          unitLabel,
          verificationStatus,
          isRepresentative,
          isActive,
        }),
      });

      setMessage(result.message);
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장하지 못했습니다.");
    }
  }

  return (
    <article className="altteulmap-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold text-[var(--altteul-accent-text)]">
            {item.id}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">
            {item.label}
          </h2>
          <p className="mt-2 text-sm text-stone-500">
            {formatKrw(item.amount)}원
            {item.unitLabel ? ` / ${item.unitLabel}` : ""} ·{" "}
            {item.verificationStatus === "verified" ? "확인됨" : "확인 전"} ·{" "}
            {item.isActive ? "노출 중" : "숨김"}
          </p>
        </div>
        <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-700">
          {item.isRepresentative ? "대표 가격" : "일반 가격"}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm text-stone-700">
          가격 항목명
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="rounded-xl border border-stone-300 px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm text-stone-700">
          가격
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="rounded-xl border border-stone-300 px-3 py-2"
            inputMode="numeric"
          />
        </label>
        <label className="grid gap-1 text-sm text-stone-700">
          단위
          <input
            value={unitLabel}
            onChange={(event) => setUnitLabel(event.target.value)}
            className="rounded-xl border border-stone-300 px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm text-stone-700">
          검증 상태
          <select
            value={verificationStatus}
            onChange={(event) =>
              setVerificationStatus(event.target.value as AdminPriceItem["verificationStatus"])
            }
            className="rounded-xl border border-stone-300 bg-white px-3 py-2"
          >
            <option value="verified">확인됨</option>
            <option value="unverified">확인 전</option>
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-stone-700">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={isRepresentative}
            onChange={(event) => setIsRepresentative(event.target.checked)}
          />
          대표 가격
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          노출
        </label>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void submit()}
          className="altteulmap-button altteulmap-accent-solid px-4 py-2 text-sm disabled:opacity-50"
        >
          저장
        </button>
        {message ? <p className="w-full text-sm text-stone-600">{message}</p> : null}
      </div>
    </article>
  );
}
