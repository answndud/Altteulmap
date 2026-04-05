import Link from "next/link";
import { redirect } from "next/navigation";

import { AccessDeniedPanel } from "@/components/access-denied-panel";
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

  const [result, overview] = await Promise.all([
    listPendingPlaces(),
    getAdminOverview(),
  ]);

  return (
    <main className="bg-stone-50 px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-7xl rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-600">
              운영
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
              신규 장소 승인 큐
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">
              공개 등록 폼으로 들어온 텍스트 기반 장소 제보를 검토합니다.
              운영자가 주소와 네이버 지도 검색 결과를 참고해 좌표를 확정한 뒤
              승인하면 바로 지도와 상세 페이지에서 확인할 수 있습니다.
            </p>
          </div>
          <Link
            href="/api/admin/places"
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
          >
            응답 보기
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              result.source === "database"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-orange-100 text-orange-700"
            }`}
          >
            데이터 구분: {result.source === "database" ? "실데이터" : "목업"}
          </span>
        </div>

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
          <div data-testid="admin-pending-place-list" className="mt-8 grid gap-4">
            {result.items.map((place) => (
              <AdminPendingPlaceCard
                key={place.id}
                place={place}
                disabled={result.source !== "database"}
              />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50 p-8 text-sm leading-6 text-stone-600">
            현재 승인 대기 중인 장소 제보가 없습니다.
          </div>
        )}
      </section>
    </main>
  );
}
