import Link from "next/link";
import { redirect } from "next/navigation";

import { AccessDeniedPanel } from "@/components/access-denied-panel";
import { AdminPageShell } from "@/features/admin/components/admin-page-shell";
import { AdminQueueNav } from "@/features/admin/components/admin-queue-nav";
import { AdminPendingPriceReportCard } from "@/features/admin/components/admin-pending-price-report-card";
import { AdminSummaryCards } from "@/features/admin/components/admin-summary-cards";
import { getAdminOverview } from "@/features/admin/repository";
import { formatKrw } from "@/features/places/queries";
import {
  listPendingPriceReports,
  listPlaces,
} from "@/features/places/repository";
import {
  createLoginHref,
  getSessionUser,
  getSessionUserLabel,
} from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPricesPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(createLoginHref("/admin/prices"));
  }

  if (user.role !== "admin") {
    return (
      <AccessDeniedPanel
        eyebrow="운영"
        title="운영자 권한이 필요합니다"
        description={`${getSessionUserLabel(user)} 계정은 가격 제보 검토 큐에 접근할 수 없습니다. 운영자 계정으로 다시 로그인하거나 일반 사용자 화면으로 돌아가세요.`}
        primaryHref="/"
        primaryLabel="지도 화면으로 이동"
        secondaryHref="/login?callbackUrl=%2Fadmin%2Fprices"
        secondaryLabel="운영자 계정으로 로그인"
      />
    );
  }

  const result = await listPendingPriceReports();
  const recentPlaces = await listPlaces({ sort: "recent" });
  const overview = await getAdminOverview();

  return (
    <AdminPageShell
      title="가격 제보 검토 큐"
      description="기존 장소에 추가로 들어온 가격 제보를 검토합니다. 승인하면 현재 가격 항목과 대표 가격이 함께 갱신되고, AI 1차 검수가 기존 값과 차이를 먼저 요약합니다."
      actions={
        <Link
          href="/api/admin/prices"
          className="altteulmap-button border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-white"
        >
          응답 보기
        </Link>
      }
      statusBadges={
        <span
          className={`altteulmap-badge ${
            result.source === "database"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-[rgba(181,90,43,0.18)] bg-[rgba(181,90,43,0.12)] text-[var(--altteul-accent-text)]"
          }`}
        >
          데이터: {result.source === "database" ? "실데이터" : "목업"}
        </span>
      }
    >
      <div className="grid gap-6">
        <AdminQueueNav current="prices" stats={overview.stats} />
        <AdminSummaryCards
          items={[
            {
              id: "pending-price-reports",
              label: "대기 중인 가격 제보",
              value: result.items.length,
              detail: "대표 가격에 반영하기 전 검토가 필요한 제보 수입니다.",
            },
            {
              id: "active-places",
              label: "공개 중 장소",
              value: overview.stats.activePlaces,
              detail: "현재 가격 관리 대상으로 바로 열 수 있는 장소 수입니다.",
            },
            {
              id: "pending-places",
              label: "승인 대기 장소",
              value: overview.stats.pendingPlaces,
              detail: "새 장소 승인 큐와 함께 보면 좋은 미처리 제보 수입니다.",
            },
          ]}
        />

        {result.items.length > 0 ? (
          <div data-testid="admin-price-report-list" className="grid gap-4">
            {result.items.map((report) => (
              <AdminPendingPriceReportCard
                key={report.id}
                report={report}
                disabled={result.source !== "database"}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50 p-8 text-sm leading-6 text-stone-600">
            현재 검토 대기 중인 가격 제보가 없습니다.
          </div>
        )}

        <section className="altteulmap-panel-muted p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-stone-900">
                현재 가격 관리
              </h2>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                최근 업데이트된 장소부터 현재 가격 항목을 직접 수정하거나 숨길 수
                있습니다.
              </p>
            </div>
            <span className="altteulmap-badge border-stone-200 bg-white text-stone-600">
              {recentPlaces.items.length}개 장소
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recentPlaces.items.slice(0, 9).map((place) => (
              <article
                key={place.id}
                className="rounded-[1.15rem] border border-stone-200 bg-white p-5"
              >
                <p className="text-[11px] tracking-[0.14em] text-[var(--altteul-accent-text)]">
                  {place.district}
                </p>
                <h3 className="mt-2 text-xl font-semibold text-stone-900">
                  {place.name}
                </h3>
                <p className="mt-3 text-sm text-stone-500">
                  {place.representativePriceLabel}
                </p>
                <p className="mt-1 text-lg font-semibold text-stone-900">
                  {formatKrw(place.representativePriceAmount)}원
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/admin/prices/places/${place.id}`}
                    className="altteulmap-button altteulmap-accent-solid px-4 py-2 text-sm"
                  >
                    가격 관리
                  </Link>
                  <Link
                    href={`/place/${place.id}`}
                    className="altteulmap-button border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-white"
                  >
                    장소 보기
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}
