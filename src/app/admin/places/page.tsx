import Link from "next/link";
import { redirect } from "next/navigation";

import { AccessDeniedPanel } from "@/components/access-denied-panel";
import { getCategoryBySlug } from "@/features/categories/catalog";
import { AdminPlaceReviewForm } from "@/features/places/admin-place-review-form";
import { formatKrw } from "@/features/places/queries";
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
        eyebrow="Admin"
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

  return (
    <main className="bg-stone-50 px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-7xl rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-600">
              Admin
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
              신규 장소 승인 큐
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">
              등록 폼으로 들어온 장소 제보를 검토합니다. 제출된 좌표를 확인하고
              필요하면 조정한 뒤 승인하면 바로 지도와 상세 페이지에서 확인할 수
              있습니다.
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
              href="/api/admin/places"
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
            >
              API 보기
            </Link>
            <Link
              href="/admin/prices"
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
            >
              가격 제보 큐
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
            데이터 소스: {result.source === "database" ? "DB" : "목업"}
          </span>
        </div>

        {result.items.length > 0 ? (
          <div data-testid="admin-pending-place-list" className="mt-8 grid gap-4">
            {result.items.map((place) => {
              const category = getCategoryBySlug(place.categorySlug);

              return (
                <article
                  key={place.id}
                  data-testid="admin-place-card"
                  className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
                        {place.id}
                      </p>
                      <h2
                        data-testid="admin-place-name"
                        className="mt-2 text-2xl font-semibold text-stone-900"
                      >
                        {place.name}
                      </h2>
                      <p className="mt-2 text-sm text-stone-500">
                        {place.businessName ?? place.name} ·{" "}
                        {category?.name ?? "기타"} · 접수 {place.createdAt}
                      </p>
                    </div>
                    <div className="rounded-3xl bg-white px-4 py-3 text-right">
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                        대표 가격
                      </p>
                      <p className="mt-2 text-lg font-semibold text-stone-900">
                        {formatKrw(place.representativePriceAmount)}원
                      </p>
                      <p className="text-sm text-stone-500">
                        {place.representativePriceLabel}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-4">
                      <div className="rounded-3xl bg-white p-4 text-sm leading-6 text-stone-700">
                        <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                          주소
                        </p>
                        <p className="mt-2">{place.address}</p>
                        <p className="text-stone-500">{place.district}</p>
                      </div>
                      <div className="rounded-3xl bg-white p-4 text-sm leading-6 text-stone-700">
                        <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                          메모
                        </p>
                        <p className="mt-2">{place.note}</p>
                      </div>
                      <div className="rounded-3xl bg-white p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                          제출된 가격 항목
                        </p>
                        <div className="mt-3 grid gap-2">
                          {place.priceItems.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-700"
                            >
                              {item.label} · {formatKrw(item.amount)}원
                              {item.unitLabel ? ` / ${item.unitLabel}` : ""}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <AdminPlaceReviewForm
                        placeId={place.id}
                        placeName={place.name}
                        address={place.address}
                        district={place.district}
                        defaultLatitude={place.latitude}
                        defaultLongitude={place.longitude}
                        disabled={result.source !== "database"}
                      />
                      <Link
                        href={`/report?placeId=${place.id}&placeName=${encodeURIComponent(place.name)}`}
                        className="inline-flex rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
                      >
                        신고 폼으로 보기
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
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
