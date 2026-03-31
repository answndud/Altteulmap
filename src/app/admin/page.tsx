import Link from "next/link";
import { redirect } from "next/navigation";

import { AccessDeniedPanel } from "@/components/access-denied-panel";
import {
  listPendingPlaces,
  listPendingPriceReports,
} from "@/features/places/repository";
import { listReports } from "@/features/reports/repository";
import {
  createLoginHref,
  getSessionUser,
  getSessionUserLabel,
} from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(createLoginHref("/admin"));
  }

  if (user.role !== "admin") {
    return (
      <AccessDeniedPanel
        eyebrow="Admin"
        title="운영자 권한이 필요합니다"
        description={`${getSessionUserLabel(user)} 계정은 운영 대시보드에 접근할 수 없습니다. 운영자 계정으로 다시 로그인하거나 일반 사용자 화면으로 돌아가세요.`}
        primaryHref="/map"
        primaryLabel="지도 화면으로 이동"
        secondaryHref="/login?callbackUrl=%2Fadmin"
        secondaryLabel="다른 계정으로 로그인"
      />
    );
  }

  const [pendingPlaces, pendingPriceReports, reports] = await Promise.all([
    listPendingPlaces(),
    listPendingPriceReports(),
    listReports(),
  ]);

  const openReportCount = reports.items.filter(
    (report) => report.status === "open" || report.status === "reviewing",
  ).length;

  return (
    <main className="bg-stone-50 px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-7xl rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-600">
          Admin
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          운영 대시보드 초안
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">
          로컬 개발 단계에서 제보 승인과 신고 검토를 끝까지 확인할 수 있도록
          최소 운영 도구를 붙였습니다.
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <article className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
              Place queue
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-stone-900">
              승인 대기 장소 {pendingPlaces.items.length}건
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              등록 폼으로 들어온 신규 장소 제보를 승인하거나 반려합니다. 승인 시
              좌표를 입력하면 지도 목록에 노출됩니다.
            </p>
            <Link
              href="/admin/places"
              className="mt-5 inline-flex rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
            >
              장소 검토 열기
            </Link>
          </article>

          <article className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
              Price queue
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-stone-900">
              대기 중인 가격 제보 {pendingPriceReports.items.length}건
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              기존 장소에 들어온 가격 변경 제보를 검토하고 대표 가격에 반영합니다.
            </p>
            <Link
              href="/admin/prices"
              className="mt-5 inline-flex rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
            >
              가격 제보 검토 열기
            </Link>
          </article>

          <article className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
              Report queue
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-stone-900">
              열린 신고 {openReportCount}건
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              가격 오류, 중복 장소, 정보 오류 신고를 상태별로 관리합니다.
            </p>
            <Link
              href="/admin/reports"
              className="mt-5 inline-flex rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
            >
              신고 검토 열기
            </Link>
          </article>
        </div>
      </section>
    </main>
  );
}
