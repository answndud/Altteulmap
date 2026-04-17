import Link from "next/link";
import { redirect } from "next/navigation";

import { AccessDeniedPanel } from "@/components/access-denied-panel";
import { AdminPageShell } from "@/features/admin/components/admin-page-shell";
import { AdminQueueNav } from "@/features/admin/components/admin-queue-nav";
import { AdminPendingPlaceCard } from "@/features/admin/components/admin-pending-place-card";
import { AdminSummaryCards } from "@/features/admin/components/admin-summary-cards";
import { getAdminOverview } from "@/features/admin/repository";
import { listPendingPlaces } from "@/features/places/repository";
import {
  createLoginHref,
  getSessionUser,
  getSessionUserLabel,
} from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPlacesPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(createLoginHref("/admin/places"));
  }

  if (user.role !== "admin") {
    return (
      <AccessDeniedPanel
        eyebrow="운영"
        title="운영자 권한이 필요합니다"
        description={`${getSessionUserLabel(user)} 계정은 장소 승인 큐에 접근할 수 없습니다. 운영자 계정으로 다시 로그인하거나 일반 사용자 화면으로 돌아가세요.`}
        primaryHref="/"
        primaryLabel="지도 화면으로 이동"
        secondaryHref="/login?callbackUrl=%2Fadmin%2Fplaces"
        secondaryLabel="운영자 계정으로 로그인"
      />
    );
  }

  const result = await listPendingPlaces();
  const overview = await getAdminOverview();

  return (
    <AdminPageShell
      title="신규 장소 승인 큐"
      description="공개 등록 폼으로 들어온 텍스트 기반 장소 제보를 검토합니다. 운영자가 주소와 네이버 지도 검색 결과를 참고해 위치를 확정한 뒤 승인하면 바로 지도와 상세에 반영됩니다."
      actions={
        <Link
          href="/api/admin/places"
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
        <AdminQueueNav current="places" stats={overview.stats} />
        <AdminSummaryCards
          items={[
            {
              id: "pending-places",
              label: "승인 대기 장소",
              value: result.items.length,
              detail: "지금 검토가 필요한 신규 장소 제보 수입니다.",
            },
            {
              id: "active-places",
              label: "공개 중 장소",
              value: overview.stats.activePlaces,
              detail: "현재 지도와 상세 페이지에 노출 중인 장소 수입니다.",
            },
            {
              id: "open-reports",
              label: "열린 신고",
              value: overview.stats.openReports,
              detail: "장소 검토와 함께 확인할 공개 신고 수입니다.",
            },
          ]}
        />

        {result.items.length > 0 ? (
          <div data-testid="admin-pending-place-list" className="grid gap-4">
            {result.items.map((place) => (
              <AdminPendingPlaceCard
                key={place.id}
                place={place}
                disabled={result.source !== "database"}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50 p-8 text-sm leading-6 text-stone-600">
            현재 승인 대기 중인 장소 제보가 없습니다.
          </div>
        )}
      </div>
    </AdminPageShell>
  );
}
