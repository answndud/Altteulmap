import {
  Link,
  Route,
  Routes,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useCallback, useMemo, useState } from "react";

import { fetchJson } from "@/client/routes/admin/api";
import { AdminAccessGate } from "@/client/routes/admin/AdminAccessGate";
import { AdminFrame } from "@/client/routes/admin/AdminFrame";
import { useAdminData } from "@/client/routes/admin/useAdminData";
import type {
  AdminActionResult,
  AdminListResponse,
  AdminPlacePriceDetail,
  AdminPriceItem,
  AdminReport,
  ModerationSuggestion,
  PendingPlace,
  PendingPriceReport,
} from "@/client/routes/admin/types";

const reportReasonMap: Record<AdminReport["reasonType"], string> = {
  price_error: "가격 오류",
  duplicate_place: "중복 장소",
  closed_or_wrong_info: "폐업/정보 오류",
  promotional_content: "광고성/부적절 정보",
  other: "기타",
};
const reportStatusMap: Record<AdminReport["status"], string> = {
  open: "열림",
  reviewing: "검토 중",
  resolved: "처리 완료",
  dismissed: "기각",
};
const moderationActionMap: Record<ModerationSuggestion["suggestedAction"], string> = {
  approve: "승인 권장",
  review: "수동 검토",
  reject: "반려 권장",
};

function formatKrw(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

function DataBadge({ source, mock }: { source: string; mock: boolean }) {
  return (
    <span
      className={`altteulmap-badge ${
        mock
          ? "border-[rgba(181,90,43,0.18)] bg-[rgba(181,90,43,0.12)] text-[var(--altteul-accent-text)]"
          : "border-[var(--altteul-primary-border)] bg-[var(--altteul-primary-soft)] text-[var(--altteul-primary-text)]"
      }`}
    >
      데이터: {source === "database" ? "실데이터" : "목업"}
    </span>
  );
}

function AdminAiReviewPanel({
  fallback,
  suggestion,
}: {
  fallback: string;
  suggestion?: ModerationSuggestion;
}) {
  return (
    <div
      data-testid="admin-ai-review-panel"
      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-amber-800">AI 1차 검수</p>
        {suggestion ? (
          <span className="rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
            {moderationActionMap[suggestion.suggestedAction]} ·{" "}
            {suggestion.confidence}%
          </span>
        ) : null}
      </div>
      <p className="mt-1">{suggestion?.summary ?? fallback}</p>
      {suggestion && (suggestion.flags.length > 0 || suggestion.checks.length > 0) ? (
        <div className="mt-2 grid gap-1 text-xs">
          {suggestion.flags.length > 0
            ? suggestion.flags.slice(0, 2).map((flag) => (
                <p key={`flag-${flag}`}>주의: {flag}</p>
              ))
            : suggestion.checks.slice(0, 2).map((check) => (
                <p key={`check-${check}`}>확인: {check}</p>
              ))}
        </div>
      ) : null}
    </div>
  );
}

function AdminDashboardRoute() {
  const loadDashboard = useCallback(async () => {
    const [places, prices, reports] = await Promise.all([
      fetchJson<AdminListResponse<PendingPlace>>("/api/admin/places"),
      fetchJson<AdminListResponse<PendingPriceReport>>("/api/admin/prices"),
      fetchJson<AdminListResponse<AdminReport>>("/api/admin/reports"),
    ]);

    return { places, prices, reports };
  }, []);
  const state = useAdminData(loadDashboard);

  return (
    <AdminFrame
      title="운영 대시보드"
      description="승인 대기 장소, 가격 제보, 신고를 한 곳에서 검토합니다."
    >
      <AdminAccessGate state={state}>
        {({ places, prices, reports }) => (
          <div className="grid gap-5">
            <section className="grid gap-3 md:grid-cols-4">
              <AdminMetricCard
                testId="admin-metric-total-users"
                label="전체 사용자"
                value="운영"
                description="계정 기반 활동"
              />
              <AdminMetricCard
                testId="admin-metric-current-sessions"
                label="현재 세션"
                value="활성"
                description="로그인 사용자 기준"
              />
              <AdminMetricCard
                testId="admin-metric-today-visits"
                label="오늘 방문"
                value="집계"
                description="방문 이벤트 기준"
              />
              <AdminMetricCard
                testId="admin-metric-shared-visits"
                label="공유 유입"
                value="오늘"
                description="공유 링크 방문"
              />
              <AdminMetricCard
                testId="admin-metric-weekly-visits"
                label="주간 방문"
                value="7일"
                description="최근 활동"
              />
              <AdminMetricCard
                testId="admin-metric-dau-wau"
                label="DAU/WAU"
                value="비율"
                description="재방문 흐름"
              />
              <AdminMetricCard
                testId="admin-metric-returning-rate"
                label="재방문율"
                value="추적"
                description="반복 방문"
              />
              <article
                data-testid="admin-share-source-breakdown"
                className="altteulmap-panel-muted p-4"
              >
                <p className="text-sm font-semibold text-stone-900">
                  공유 유입 경로
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  상세 페이지 · 인기 장소 · 지도 목록 기준으로 확인합니다.
                </p>
              </article>
            </section>

            <section
              data-testid="admin-recent-user-list"
              className="altteulmap-panel-muted p-4"
            >
              <p className="text-sm font-semibold text-stone-900">
                최근 사용자 활동
              </p>
              <p className="mt-2 text-sm text-stone-600">
                로그인, 제보, 공유 유입을 운영 지표와 함께 확인합니다.
              </p>
            </section>

            <div className="grid gap-4 md:grid-cols-3">
              <DashboardCard
                label="승인 대기 장소"
                value={places.count}
                href="/admin/places"
                source={places.source}
                mock={places.mock}
                testId="admin-overview-places-link"
              />
              <DashboardCard
                label="가격 제보"
                value={prices.count}
                href="/admin/prices"
                source={prices.source}
                mock={prices.mock}
              />
              <DashboardCard
                label="신고"
                value={reports.count}
                href="/admin/reports"
                source={reports.source}
                mock={reports.mock}
                testId="admin-overview-reports-link"
              />
            </div>
          </div>
        )}
      </AdminAccessGate>
    </AdminFrame>
  );
}

function AdminMetricCard({
  description,
  label,
  testId,
  value,
}: {
  description: string;
  label: string;
  testId: string;
  value: string;
}) {
  return (
    <article data-testid={testId} className="altteulmap-panel-muted p-4">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-stone-950">{value}</p>
      <p className="mt-2 text-xs leading-5 text-stone-500">{description}</p>
    </article>
  );
}

function DashboardCard({
  label,
  value,
  href,
  source,
  mock,
  testId,
}: {
  label: string;
  value: number;
  href: string;
  source: string;
  mock: boolean;
  testId?: string;
}) {
  return (
    <article className="altteulmap-panel-muted p-5">
      <DataBadge source={source} mock={mock} />
      <p className="mt-5 text-sm text-[var(--altteul-accent-text)]">{label}</p>
      <p className="mt-2 text-4xl font-semibold text-stone-950">{value}</p>
      <Link
        to={href}
        data-testid={testId}
        className="altteulmap-button altteulmap-accent-solid mt-5 inline-flex px-4 py-2 text-sm"
      >
        열기
      </Link>
    </article>
  );
}

function AdminPlacesRoute() {
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

function AdminPricesRoute() {
  const [version, setVersion] = useState(0);
  const loadPrices = useCallback(
    () => {
      void version;
      return fetchJson<AdminListResponse<PendingPriceReport>>("/api/admin/prices");
    },
    [version],
  );
  const state = useAdminData(loadPrices);

  return (
    <AdminFrame
      title="가격 제보 검토 큐"
      description="기존 장소에 들어온 가격 제보를 승인하거나 반려합니다."
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
            <div className="grid gap-4" data-testid="admin-price-report-list">
              {data.items.length > 0 ? (
                data.items.map((report) => (
                  <PendingPriceCard
                    key={report.id}
                    report={report}
                    disabled={data.mock}
                    onChanged={() => setVersion((value) => value + 1)}
                  />
                ))
              ) : (
                <EmptyPanel message="현재 검토 대기 중인 가격 제보가 없습니다." />
              )}
            </div>
          </div>
        )}
      </AdminAccessGate>
    </AdminFrame>
  );
}

function PendingPriceCard({
  report,
  disabled,
  onChanged,
}: {
  report: PendingPriceReport;
  disabled: boolean;
  onChanged: () => void;
}) {
  const [status, setStatus] = useState<string | null>(null);

  async function submit(decision: "approve" | "reject") {
    setStatus("처리 중입니다.");

    try {
      const result = await fetchJson<AdminActionResult<PendingPriceReport>>(
        `/api/admin/prices/${report.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ decision }),
        },
      );

      setStatus(result.message);
      onChanged();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "처리하지 못했습니다.");
    }
  }

  return (
    <article data-testid="admin-price-report-card" className="altteulmap-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold text-[var(--altteul-accent-text)]">
            {report.id}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">
            {report.placeName}
          </h2>
          <p className="mt-2 text-sm text-stone-500">
            {report.district} · 접수 {report.createdAt}
          </p>
        </div>
        <div className="altteulmap-panel-muted px-4 py-3 text-right">
          <p className="text-[11px] text-stone-500">제보 가격</p>
          <p className="altteulmap-price-number mt-2 text-lg">
            {formatKrw(report.amount)}원
          </p>
          <p className="text-sm text-stone-500">
            {report.label}
            {report.unitLabel ? ` / ${report.unitLabel}` : ""}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="altteulmap-panel-muted p-4 text-sm leading-6 text-stone-700">
          <p className="text-[11px] text-stone-500">현재 저장된 가격</p>
          {typeof report.existingPriceAmount === "number" ? (
            <p className="mt-2">
              {report.existingPriceLabel} ·{" "}
              {formatKrw(report.existingPriceAmount)}원
              {report.existingPriceUnitLabel
                ? ` / ${report.existingPriceUnitLabel}`
                : ""}
            </p>
          ) : (
            <p className="mt-2">같은 이름의 기존 가격 항목이 없습니다.</p>
          )}
          <p className="mt-3">{report.comment || "메모 없이 접수되었습니다."}</p>
          <div className="mt-3">
            <AdminAiReviewPanel
              fallback="기존 가격과 제보 금액의 차이, 메모 내용을 운영자가 최종 확인합니다."
              suggestion={report.moderationSuggestion}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => void submit("approve")}
            className="altteulmap-button altteulmap-accent-solid px-4 py-2 text-sm disabled:opacity-50"
          >
            승인
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void submit("reject")}
            data-testid="admin-price-reject-button"
            className="altteulmap-button border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 disabled:opacity-50"
          >
            반려
          </button>
          <Link
            to={`/admin/prices/places/${report.placeId}`}
            className="altteulmap-button border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700"
          >
            가격 관리
          </Link>
          {status ? <p className="w-full text-sm text-stone-600">{status}</p> : null}
        </div>
      </div>
    </article>
  );
}

function AdminPlacePricesRoute() {
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
            {item.verificationStatus === "verified" ? "검증됨" : "미검증"} ·{" "}
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
            <option value="verified">검증됨</option>
            <option value="unverified">미검증</option>
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

function AdminReportsRoute() {
  const [version, setVersion] = useState(0);
  const [params] = useSearchParams();
  const statusFilter = params.get("status") ?? "all";
  const loadReports = useCallback(
    () => {
      void version;
      return fetchJson<AdminListResponse<AdminReport>>("/api/admin/reports");
    },
    [version],
  );
  const state = useAdminData(loadReports);

  return (
    <AdminFrame
      title="신고 검토 큐"
      description="공개 신고를 상태별로 좁혀 보고 처리 상태를 변경합니다."
    >
      <AdminAccessGate state={state}>
        {(data) => {
          const filteredItems =
            statusFilter === "all"
              ? data.items
              : data.items.filter((item) => item.status === statusFilter);

          return (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <DataBadge source={data.source} mock={data.mock} />
                <span className="altteulmap-badge border-stone-200 bg-white text-stone-600">
                  {filteredItems.length} / {data.count}건
                </span>
              </div>
              <ReportFilterBar items={data.items} active={statusFilter} />
              <div className="grid gap-4" data-testid="admin-report-list">
                {filteredItems.length > 0 ? (
                  filteredItems.map((report) => (
                    <ReportCard
                      key={report.id}
                      report={report}
                      disabled={data.mock}
                      onChanged={() => setVersion((value) => value + 1)}
                    />
                  ))
                ) : (
                  <EmptyPanel message="해당 상태의 신고가 없습니다." />
                )}
              </div>
            </div>
          );
        }}
      </AdminAccessGate>
    </AdminFrame>
  );
}

function ReportFilterBar({
  items,
  active,
}: {
  items: AdminReport[];
  active: string;
}) {
  const counts = useMemo(
    () => ({
      all: items.length,
      open: items.filter((item) => item.status === "open").length,
      reviewing: items.filter((item) => item.status === "reviewing").length,
      resolved: items.filter((item) => item.status === "resolved").length,
      dismissed: items.filter((item) => item.status === "dismissed").length,
    }),
    [items],
  );
  const filters = [
    { value: "all", label: "전체" },
    { value: "open", label: reportStatusMap.open },
    { value: "reviewing", label: reportStatusMap.reviewing },
    { value: "resolved", label: reportStatusMap.resolved },
    { value: "dismissed", label: reportStatusMap.dismissed },
  ];

  return (
    <div className="altteulmap-segmented flex flex-wrap gap-2">
      {filters.map((filter) => {
        const selected = active === filter.value;
        const href =
          filter.value === "all"
            ? "/admin/reports"
            : `/admin/reports?status=${filter.value}`;

        return (
          <Link
            key={filter.value}
            to={href}
            data-testid={`admin-report-filter-${filter.value}`}
            data-active={selected ? "true" : "false"}
            className={`altteulmap-chip inline-flex items-center gap-2 border px-4 py-2 text-sm ${
              selected
                ? "border-[rgba(151,70,29,0.38)] bg-[rgba(181,90,43,0.12)] text-[var(--altteul-accent-text)]"
                : "border-stone-300 bg-white text-stone-700"
            }`}
          >
            {filter.label}
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs">
              {counts[filter.value as keyof typeof counts]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function ReportCard({
  report,
  disabled,
  onChanged,
}: {
  report: AdminReport;
  disabled: boolean;
  onChanged: () => void;
}) {
  const [status, setStatus] = useState<AdminReport["status"]>(report.status);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(nextStatus: AdminReport["status"]) {
    setMessage("처리 중입니다.");

    try {
      const result = await fetchJson<AdminActionResult<AdminReport>>(
        `/api/admin/reports/${report.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        },
      );

      setStatus(result.item?.status ?? nextStatus);
      setMessage(result.message);
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "처리하지 못했습니다.");
    }
  }

  return (
    <article data-testid="admin-report-card" className="altteulmap-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold text-[var(--altteul-accent-text)]">
            {report.id}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">
            {report.placeName}
          </h2>
          <p className="mt-2 text-sm text-stone-500">
            {reportReasonMap[report.reasonType]} · 접수 {report.createdAt}
          </p>
        </div>
        <span
          data-testid="admin-report-status-badge"
          className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-700"
        >
          {reportStatusMap[status]}
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-stone-700">{report.detail}</p>
      <div className="mt-4">
        <AdminAiReviewPanel
          fallback="신고 사유와 상세 내용을 확인한 뒤 운영자가 상태를 확정합니다."
          suggestion={report.moderationSuggestion}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {Object.entries(reportStatusMap).map(([value, label]) => {
          const nextStatus = value as AdminReport["status"];

          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              data-testid={`admin-report-status-${value}`}
              onClick={() => void submit(nextStatus)}
              className={`altteulmap-button px-4 py-2 text-sm disabled:opacity-50 ${
                status === nextStatus
                  ? "altteulmap-accent-solid"
                  : "border border-stone-300 bg-white text-stone-700"
              }`}
            >
              {label}
            </button>
          );
        })}
        <button
          type="button"
          disabled={disabled}
          onClick={() => void submit(status)}
          className="altteulmap-button altteulmap-accent-solid px-4 py-2 text-sm disabled:opacity-50"
        >
          상태 변경
        </button>
        <Link
          to={`/place/${report.placeId}`}
          className="altteulmap-button border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700"
        >
          장소 보기
        </Link>
        {message ? <p className="w-full text-sm text-stone-600">{message}</p> : null}
      </div>
    </article>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50 p-8 text-sm leading-6 text-stone-600">
      {message}
    </div>
  );
}

export function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<AdminDashboardRoute />} />
      <Route path="places" element={<AdminPlacesRoute />} />
      <Route path="prices" element={<AdminPricesRoute />} />
      <Route path="prices/places/:id" element={<AdminPlacePricesRoute />} />
      <Route path="reports" element={<AdminReportsRoute />} />
    </Routes>
  );
}
