import Link from "next/link";
import { notFound } from "next/navigation";

import { getCategoryBySlug } from "@/features/categories/catalog";
import {
  formatKrw,
  getPlaceById,
  getRelatedPlaces,
} from "@/features/places/queries";

type PlacePageProps = {
  params: Promise<{
    id: string;
  }>;
};

function StatusBadge({ verified }: { verified: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        verified
          ? "bg-emerald-100 text-emerald-700"
          : "bg-amber-100 text-amber-700"
      }`}
    >
      {verified ? "검증됨" : "미검증"}
    </span>
  );
}

export default async function PlacePage({ params }: PlacePageProps) {
  const { id } = await params;
  const place = getPlaceById(id);

  if (!place) {
    notFound();
  }

  const category = getCategoryBySlug(place.categorySlug);
  const relatedPlaces = getRelatedPlaces(place.id);

  return (
    <main className="bg-stone-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/map"
          className="inline-flex rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
        >
          지도 목록으로 돌아가기
        </Link>
        <section className="mt-6 rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">
                {category?.parentName ?? "생활비 절감"}
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
                {place.name}
              </h1>
              <p className="mt-3 text-sm text-stone-500">
                {place.businessName ?? place.name} · {category?.name ?? "기타"} ·{" "}
                {place.address}
              </p>
            </div>
            <StatusBadge verified={place.verificationStatus === "verified"} />
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl bg-stone-900 p-6 text-white">
              <p className="text-sm text-stone-300">대표 가격</p>
              <p className="mt-3 text-3xl font-semibold">
                {formatKrw(place.representativePriceAmount)}원
              </p>
              <p className="mt-2 text-sm text-stone-300">
                {place.representativePriceLabel}
              </p>
            </div>
            <div className="rounded-3xl border border-stone-200 bg-stone-50 p-6">
              <p className="text-sm text-stone-500">최근 갱신일</p>
              <p className="mt-3 text-xl font-semibold text-stone-900">
                {place.lastPriceUpdatedAt}
              </p>
              <p className="mt-2 text-sm text-stone-500">{place.district}</p>
            </div>
            <div className="rounded-3xl border border-stone-200 bg-stone-50 p-6">
              <p className="text-sm text-stone-500">메모</p>
              <p className="mt-3 text-sm leading-6 text-stone-700">
                {place.note}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <section>
              <h2 className="text-xl font-semibold text-stone-900">장소 소개</h2>
              <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">
                {place.description}
              </p>

              <h2 className="mt-10 text-xl font-semibold text-stone-900">
                가격 항목
              </h2>
              <div className="mt-4 grid gap-3">
                {place.priceItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4"
                  >
                    <div>
                      <p className="font-medium text-stone-900">{item.label}</p>
                      <p className="mt-1 text-sm text-stone-500">
                        마지막 제보 {item.reportedAt}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-stone-900">
                        {formatKrw(item.amount)}원
                        {item.unitLabel ? ` / ${item.unitLabel}` : ""}
                      </p>
                      <p
                        className={`mt-1 text-xs font-semibold ${
                          item.verificationStatus === "verified"
                            ? "text-emerald-600"
                            : "text-amber-600"
                        }`}
                      >
                        {item.verificationStatus === "verified"
                          ? "검증됨"
                          : "미검증"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <h2 className="mt-10 text-xl font-semibold text-stone-900">
                가격 이력
              </h2>
              <div className="mt-4 grid gap-3">
                {place.history.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-stone-200 bg-white px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-medium text-stone-900">{entry.label}</p>
                      <p className="font-semibold text-stone-900">
                        {formatKrw(entry.amount)}원
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-stone-500">
                      {entry.recordedAt} ·{" "}
                      {entry.verificationStatus === "verified"
                        ? "검증됨"
                        : "미검증"}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <aside className="space-y-8">
              <section className="rounded-3xl border border-stone-200 bg-stone-50 p-6">
                <h2 className="text-lg font-semibold text-stone-900">사용자 코멘트</h2>
                <div className="mt-4 space-y-3">
                  {place.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="rounded-2xl bg-white px-4 py-4 text-sm leading-6 text-stone-700"
                    >
                      <p className="font-medium text-stone-900">
                        {comment.authorLabel}
                      </p>
                      <p className="mt-2">{comment.body}</p>
                      <p className="mt-2 text-xs text-stone-500">
                        {comment.createdAt}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-stone-200 bg-stone-50 p-6">
                <h2 className="text-lg font-semibold text-stone-900">비슷한 장소</h2>
                <div className="mt-4 space-y-3">
                  {relatedPlaces.map((related) => (
                    <Link
                      key={related.id}
                      href={`/place/${related.id}`}
                      className="block rounded-2xl bg-white px-4 py-4 transition hover:border-stone-300 hover:bg-stone-100"
                    >
                      <p className="font-medium text-stone-900">{related.name}</p>
                      <p className="mt-1 text-sm text-stone-500">
                        {related.representativePriceLabel} ·{" "}
                        {formatKrw(related.representativePriceAmount)}원
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
