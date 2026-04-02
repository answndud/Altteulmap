import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AccessDeniedPanel } from "@/components/access-denied-panel";
import { SessionActionGroup } from "@/features/auth/session-action-group";
import { AdminPriceItemForm } from "@/features/places/admin-price-item-form";
import { formatKrw } from "@/features/places/queries";
import { getAdminPlacePriceDetail } from "@/features/places/repository";
import {
  createLoginHref,
  getSessionUser,
  getSessionUserLabel,
} from "@/lib/session";

type AdminPlacePricePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function AdminPlacePricesDetailPage({
  params,
}: AdminPlacePricePageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(createLoginHref("/admin/prices"));
  }

  if (user.role !== "admin") {
    return (
      <AccessDeniedPanel
        eyebrow="운영"
        title="운영자 권한이 필요합니다"
        description={`${getSessionUserLabel(user)} 계정은 장소별 가격 관리 화면에 접근할 수 없습니다. 운영자 계정으로 다시 로그인하거나 일반 사용자 화면으로 돌아가세요.`}
        primaryHref="/"
        primaryLabel="지도 화면으로 이동"
        secondaryHref="/login?callbackUrl=%2Fadmin%2Fprices"
        secondaryLabel="운영자 계정으로 로그인"
      />
    );
  }

  const { id } = await params;
  const result = await getAdminPlacePriceDetail(id);

  if (!result.item) {
    notFound();
  }

  const place = result.item;

  return (
    <main className="bg-stone-50 px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-7xl rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-600">
              운영
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
              {place.name} 가격 관리
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">
              대표 가격 규칙은 `대표 가격 플래그 + 검증 상태 + 최신성` 우선이며,
              대표 플래그가 없으면 현재 활성 항목 중 최저가를 대표값으로 사용합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/prices"
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
            >
              가격 검토 큐
            </Link>
            <Link
              href={`/place/${place.id}`}
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
            >
              장소 보기
            </Link>
            <SessionActionGroup user={user} signOutCallbackUrl="/" compact />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-stone-900 p-6 text-white">
            <p className="text-sm text-stone-300">현재 대표 가격</p>
            <p className="mt-3 text-3xl font-semibold">
              {formatKrw(place.representativePriceAmount)}원
            </p>
            <p className="mt-2 text-sm text-stone-300">
              {place.representativePriceLabel}
            </p>
          </div>
          <div className="rounded-3xl border border-stone-200 bg-stone-50 p-6">
            <p className="text-sm text-stone-500">지역</p>
            <p className="mt-3 text-xl font-semibold text-stone-900">
              {place.district}
            </p>
          </div>
          <div className="rounded-3xl border border-stone-200 bg-stone-50 p-6">
            <p className="text-sm text-stone-500">대표 검증 상태</p>
            <p className="mt-3 text-xl font-semibold text-stone-900">
              {place.verificationStatus === "verified" ? "검증됨" : "미검증"}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4">
          {place.priceItems.map((item) => (
            <article
              key={item.id}
              className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
                    {item.id}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-stone-900">
                    {item.label}
                  </h2>
                  <p className="mt-2 text-sm text-stone-500">
                    최근 반영 {item.reportedAt || "기록 없음"} · 검증 누적{" "}
                    {item.verifiedReportCount}회
                  </p>
                </div>
                <div className="rounded-3xl bg-white px-4 py-3 text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    현재 금액
                  </p>
                  <p className="mt-2 text-lg font-semibold text-stone-900">
                    {formatKrw(item.amount)}원
                  </p>
                  <p className="text-sm text-stone-500">
                    {item.unitLabel ? ` / ${item.unitLabel}` : "단위 없음"}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <AdminPriceItemForm
                  itemId={item.id}
                  label={item.label}
                  amount={item.amount}
                  unitLabel={item.unitLabel}
                  verificationStatus={item.verificationStatus}
                  isRepresentative={item.isRepresentative}
                  isActive={item.isActive}
                  disabled={result.source !== "database"}
                />
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
