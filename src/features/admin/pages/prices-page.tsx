import Link from "next/link";
import { redirect } from "next/navigation";

import { AccessDeniedPanel } from "@/components/access-denied-panel";
import { AdminPriceReportReviewForm } from "@/features/places/admin-price-report-review-form";
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

  const [result, recentPlaces] = await Promise.all([
    listPendingPriceReports(),
    listPlaces({ sort: "recent" }),
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
              가격 제보 검토 큐
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">
              기존 장소에 추가로 들어온 가격 제보를 검토합니다. 승인하면 현재
              가격 항목과 대표 가격이 함께 갱신됩니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin"
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
            >
              대시보드
            </Link>
            <Link
              href="/admin/places"
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
            >
              장소 승인 큐
            </Link>
            <Link
              href="/admin/reports"
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
            >
              신고 검토 큐
            </Link>
            <Link
              href="/api/admin/prices"
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
            >
              응답 보기
            </Link>
          </div>
        </div>

        <div className="mt-6">
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

        {result.items.length > 0 ? (
          <div data-testid="admin-price-report-list" className="mt-8 grid gap-4">
            {result.items.map((report) => (
              <article
                key={report.id}
                data-testid="admin-price-report-card"
                className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
                      {report.id}
                    </p>
                    <h2
                      data-testid="admin-price-report-place-name"
                      className="mt-2 text-2xl font-semibold text-stone-900"
                    >
                      {report.placeName}
                    </h2>
                    <p className="mt-2 text-sm text-stone-500">
                      {report.district} · 접수 {report.createdAt}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-white px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                      제보 가격
                    </p>
                    <p
                      data-testid="admin-price-report-amount"
                      className="mt-2 text-lg font-semibold text-stone-900"
                    >
                      {formatKrw(report.amount)}원
                    </p>
                    <p className="text-sm text-stone-500">
                      {report.label}
                      {report.unitLabel ? ` / ${report.unitLabel}` : ""}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-4">
                    <div className="rounded-3xl bg-white p-4 text-sm leading-6 text-stone-700">
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                        현재 저장된 가격
                      </p>
                      {typeof report.existingPriceAmount === "number" ? (
                        <>
                          <p className="mt-2 font-medium text-stone-900">
                            {report.existingPriceLabel}
                          </p>
                          <p className="mt-1">
                            {formatKrw(report.existingPriceAmount)}원
                            {report.existingPriceUnitLabel
                              ? ` / ${report.existingPriceUnitLabel}`
                              : ""}
                          </p>
                          <p className="mt-2 text-xs text-stone-500">
                            {report.existingPriceVerificationStatus === "verified"
                              ? "현재 검증됨"
                              : "현재 미검증"}
                          </p>
                        </>
                      ) : (
                        <p className="mt-2">같은 이름의 기존 가격 항목이 없습니다.</p>
                      )}
                    </div>

                    <div className="rounded-3xl bg-white p-4 text-sm leading-6 text-stone-700">
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                        제보 메모
                      </p>
                      <p className="mt-2">
                        {report.comment || "메모 없이 가격만 접수되었습니다."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Link
                        href={`/place/${report.placeId}`}
                        className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
                      >
                        장소 보기
                      </Link>
                      <Link
                        href={`/admin/prices/places/${report.placeId}`}
                        className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
                      >
                        현재 가격 관리
                      </Link>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-3xl border border-stone-200 bg-white p-4">
                      <p className="text-sm font-semibold text-stone-900">
                        검토 액션
                      </p>
                      <p className="mt-2 text-sm leading-6 text-stone-600">
                        승인하면 현재 가격 항목을 덮어쓰거나 새 항목으로 추가합니다.
                      </p>
                      <div className="mt-4">
                        <AdminPriceReportReviewForm
                          reportId={report.id}
                          disabled={result.source !== "database"}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50 p-8 text-sm leading-6 text-stone-600">
            현재 검토 대기 중인 가격 제보가 없습니다.
          </div>
        )}

        <section className="mt-10">
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
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
              {recentPlaces.items.length}개 장소
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recentPlaces.items.slice(0, 9).map((place) => (
              <article
                key={place.id}
                className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
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
                    className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
                  >
                    가격 관리
                  </Link>
                  <Link
                    href={`/place/${place.id}`}
                    className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
                  >
                    장소 보기
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
