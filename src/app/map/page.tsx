import Link from "next/link";

import {
  categoryGroups,
  getCategoryBySlug,
} from "@/features/categories/catalog";
import {
  formatKrw,
  getFilteredPlaces,
  getMapBounds,
} from "@/features/places/queries";

type MapPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const priceOptions = [
  { label: "전체 가격", value: null },
  { label: "5,000원 이하", value: 5000 },
  { label: "10,000원 이하", value: 10000 },
  { label: "20,000원 이하", value: 20000 },
];

const sortOptions = [
  { label: "가격순", value: "price" },
  { label: "최근 갱신순", value: "recent" },
] as const;

function getFirstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function createHref(params: {
  category?: string | null;
  maxPrice?: number | null;
  sort?: string | null;
}) {
  const search = new URLSearchParams();

  if (params.category) {
    search.set("category", params.category);
  }

  if (params.maxPrice) {
    search.set("maxPrice", String(params.maxPrice));
  }

  if (params.sort && params.sort !== "price") {
    search.set("sort", params.sort);
  }

  const query = search.toString();

  return query ? `/map?${query}` : "/map";
}

export default async function MapPage({ searchParams }: MapPageProps) {
  const params = await searchParams;
  const activeCategory = getFirstValue(params.category) ?? null;
  const activeMaxPrice = Number(getFirstValue(params.maxPrice) ?? "") || null;
  const activeSort =
    getFirstValue(params.sort) === "recent" ? "recent" : "price";

  const places = getFilteredPlaces({
    category: activeCategory,
    maxPrice: activeMaxPrice,
    sort: activeSort,
  });
  const selectedCategory = getCategoryBySlug(activeCategory);
  const bounds = getMapBounds();
  const latRange = Math.max(bounds.maxLat - bounds.minLat, 0.01);
  const lngRange = Math.max(bounds.maxLng - bounds.minLng, 0.01);

  return (
    <main className="bg-stone-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-600">
                Read MVP
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
                지도 탐색 읽기 흐름 초안
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">
                외부 계정 없이도 다음 구현 단계로 넘어갈 수 있도록 목업 데이터로
                지도 탐색과 장소 상세 구조를 먼저 만들었습니다. 이후에는 이
                구조를 DB 조회와 네이버 지도 SDK로 교체하면 됩니다.
              </p>
            </div>
            <div className="rounded-3xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
              현재 데이터는 목업입니다.
            </div>
          </div>

          <div className="mt-8 grid gap-4 rounded-3xl border border-stone-200 bg-stone-50 p-5">
            <section>
              <p className="text-sm font-medium text-stone-700">카테고리</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={createHref({
                    category: null,
                    maxPrice: activeMaxPrice,
                    sort: activeSort,
                  })}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    !activeCategory
                      ? "bg-stone-900 text-white"
                      : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  전체
                </Link>
                {categoryGroups.flatMap((group) =>
                  group.children.map((category) => {
                    const isActive = activeCategory === category.slug;

                    return (
                      <Link
                        key={category.slug}
                        href={createHref({
                          category: category.slug,
                          maxPrice: activeMaxPrice,
                          sort: activeSort,
                        })}
                        className={`rounded-full px-4 py-2 text-sm transition ${
                          isActive
                            ? "bg-stone-900 text-white"
                            : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                        }`}
                      >
                        {category.name}
                      </Link>
                    );
                  }),
                )}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-stone-700">가격 필터</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {priceOptions.map((option) => {
                    const isActive = activeMaxPrice === option.value;

                    return (
                      <Link
                        key={option.label}
                        href={createHref({
                          category: activeCategory,
                          maxPrice: option.value,
                          sort: activeSort,
                        })}
                        className={`rounded-full px-4 py-2 text-sm transition ${
                          isActive
                            ? "bg-orange-600 text-white"
                            : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                        }`}
                      >
                        {option.label}
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-stone-700">정렬</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sortOptions.map((option) => {
                    const isActive = activeSort === option.value;

                    return (
                      <Link
                        key={option.value}
                        href={createHref({
                          category: activeCategory,
                          maxPrice: activeMaxPrice,
                          sort: option.value,
                        })}
                        className={`rounded-full px-4 py-2 text-sm transition ${
                          isActive
                            ? "bg-stone-900 text-white"
                            : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                        }`}
                      >
                        {option.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <section className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-stone-900">
                    지도 프리뷰
                  </h2>
                  <p className="text-sm text-stone-500">
                    네이버 지도 SDK 연동 전 임시 시각화
                  </p>
                </div>
                <div className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-600">
                  {places.length}곳
                </div>
              </div>
              <div className="relative h-[28rem] bg-[linear-gradient(to_right,#e7e5e4_1px,transparent_1px),linear-gradient(to_bottom,#e7e5e4_1px,transparent_1px)] bg-[size:32px_32px] bg-stone-50">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.12),transparent_28%)]" />
                {places.map((place, index) => {
                  const top =
                    ((bounds.maxLat - place.latitude) / latRange) * 70 + 10;
                  const left =
                    ((place.longitude - bounds.minLng) / lngRange) * 72 + 8;

                  return (
                    <Link
                      key={place.id}
                      href={`/place/${place.id}`}
                      className="absolute"
                      style={{
                        top: `${top}%`,
                        left: `${left}%`,
                      }}
                    >
                      <span className="flex h-10 min-w-10 items-center justify-center rounded-full bg-stone-900 px-3 text-xs font-semibold text-white shadow-lg">
                        {index + 1}
                      </span>
                    </Link>
                  );
                })}
                <div className="absolute bottom-4 left-4 rounded-2xl bg-white/90 px-4 py-3 text-sm text-stone-700 shadow-sm backdrop-blur">
                  {selectedCategory
                    ? `${selectedCategory.name} 카테고리만 표시 중`
                    : "전체 카테고리 표시 중"}
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-stone-900">
                    결과 목록
                  </h2>
                  <p className="text-sm text-stone-500">
                    대표 가격 기준으로 필터링됩니다
                  </p>
                </div>
                <Link
                  href="/api/places/map"
                  className="text-sm text-orange-700 underline underline-offset-4"
                >
                  API 보기
                </Link>
              </div>
              {places.length > 0 ? (
                places.map((place) => {
                  const category = getCategoryBySlug(place.categorySlug);

                  return (
                    <Link
                      key={place.id}
                      href={`/place/${place.id}`}
                      className="block rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
                            {category?.parentName ?? "기타"}
                          </p>
                          <h3 className="mt-2 text-xl font-semibold text-stone-900">
                            {place.name}
                          </h3>
                          <p className="mt-2 text-sm text-stone-500">
                            {category?.name ?? "기타"} · {place.district}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            place.verificationStatus === "verified"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {place.verificationStatus === "verified"
                            ? "검증됨"
                            : "미검증"}
                        </span>
                      </div>
                      <div className="mt-5 flex items-end justify-between gap-4">
                        <div>
                          <p className="text-sm text-stone-500">
                            {place.representativePriceLabel}
                          </p>
                          <p className="mt-1 text-2xl font-semibold text-stone-900">
                            {formatKrw(place.representativePriceAmount)}원
                          </p>
                        </div>
                        <p className="text-sm text-stone-500">
                          갱신 {place.lastPriceUpdatedAt}
                        </p>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-white p-8 text-center text-sm leading-7 text-stone-500">
                  현재 조건에 맞는 목업 데이터가 없습니다. 다른 카테고리나 가격
                  필터로 다시 확인해보세요.
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
