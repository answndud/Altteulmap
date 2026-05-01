import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { VitePlaceReactionButtons } from "@/client/components/VitePlaceReactionButtons";
import { getCategoryBySlug } from "@/features/categories/catalog";
import { RouteResetDetails } from "@/features/map/route-reset-details";
import { PlaceCommentsSection } from "@/features/places/place-comments-section";
import { PlacePriceReportForm } from "@/features/places/place-price-report-form";
import { PlaceShareButton } from "@/features/places/place-share-button";
import { createPlaceSharePayload } from "@/features/places/share";
import type { PlaceReactionType } from "@/features/places/types";
import type { PlaceRecord } from "@/features/places/types";

type PlaceDetailResponse = {
  item: PlaceRecord;
  source: "database" | "mock";
  mock: boolean;
};

type LoadState =
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: PlaceDetailResponse; error: null }
  | { status: "not-found"; data: null; error: string }
  | { status: "error"; data: null; error: string };

function formatKrw(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

export function PlaceDetailRoute() {
  const { id } = useParams();
  const [state, setState] = useState<LoadState>({
    status: "loading",
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!id) {
      return;
    }

    const controller = new AbortController();

    fetch(`/api/places/${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404) {
          throw new Error("NOT_FOUND");
        }

        if (!response.ok) {
          throw new Error("장소 상세를 불러오지 못했습니다.");
        }

        return (await response.json()) as PlaceDetailResponse;
      })
      .then((data) => {
        setState({ status: "success", data, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (error instanceof Error && error.message === "NOT_FOUND") {
          setState({
            status: "not-found",
            data: null,
            error: "장소를 찾을 수 없습니다.",
          });
          return;
        }

        setState({
          status: "error",
          data: null,
          error:
            error instanceof Error
              ? error.message
              : "장소 상세를 불러오지 못했습니다.",
        });
      });

    return () => {
      controller.abort();
    };
  }, [id]);

  if (!id) {
    return (
      <main className="bg-[var(--altteul-bg-canvas)] px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto grid max-w-6xl gap-4 rounded-[1rem] border border-stone-200 bg-white p-6">
          <p className="text-sm text-stone-500">장소를 찾을 수 없습니다.</p>
          <Link
            to="/"
            className="altteulmap-button w-fit border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700"
          >
            지도로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  if (state.status === "loading") {
    return (
      <main className="bg-[var(--altteul-bg-canvas)] px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-6xl rounded-[1rem] border border-stone-200 bg-white p-6 text-sm text-stone-500">
          장소 상세를 불러오는 중입니다.
        </div>
      </main>
    );
  }

  if (state.status === "not-found" || state.status === "error") {
    return (
      <main className="bg-[var(--altteul-bg-canvas)] px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto grid max-w-6xl gap-4 rounded-[1rem] border border-stone-200 bg-white p-6">
          <p className="text-sm text-stone-500">{state.error}</p>
          <Link
            to="/"
            className="altteulmap-button w-fit border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700"
          >
            지도로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  const place = state.data.item;
  const category = getCategoryBySlug(place.categorySlug);
  const sharePayload = createPlaceSharePayload(place, "detail");
  const verificationLabel =
    place.verificationStatus === "verified" ? "검증됨" : "미검증";
  const summaryItems = [category?.name ?? "기타", place.district, verificationLabel];
  const handleReactionUpdate = (nextState: {
    dislikeCount: number;
    likeCount: number;
    viewerReaction: PlaceReactionType | null;
  }) => {
    setState({
      status: "success",
      error: null,
      data: {
        ...state.data,
        item: {
          ...place,
          dislikeCount: nextState.dislikeCount,
          likeCount: nextState.likeCount,
          viewerReaction: nextState.viewerReaction,
        },
      },
    });
  };

  return (
    <main className="bg-[var(--altteul-bg-canvas)] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/"
          className="altteulmap-button inline-flex whitespace-nowrap border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-white"
        >
          지도로 돌아가기
        </Link>

        <section className="mt-5 grid gap-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
            <section className="altteulmap-accent-panel rounded-[1rem] p-5 sm:p-6">
              <p className="altteulmap-section-kicker">
                {category?.parentName ?? "장소"}
              </p>
              <h1 className="mt-2 break-keep text-[2rem] font-semibold leading-tight text-stone-950 sm:text-[2.6rem]">
                {place.name}
              </h1>
              {place.businessName && place.businessName !== place.name ? (
                <p className="mt-3 text-sm text-[var(--altteul-accent-text)]">
                  사업장 이름 {place.businessName}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {summaryItems.map((item) => (
                  <span
                    key={item}
                    className="altteulmap-badge bg-white/80 px-2.5 py-1 text-[11px] font-medium text-[var(--altteul-accent-text)]"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <p className="mt-6 text-[11px] font-medium uppercase text-[var(--altteul-accent-text)]">
                대표 가격
              </p>
              <p className="altteulmap-price-number mt-2 text-[2.4rem] sm:text-[2.8rem]">
                {formatKrw(place.representativePriceAmount)}원
              </p>
              <p className="mt-2 text-sm text-[var(--altteul-accent-text)]">
                {place.representativePriceLabel}
              </p>
              <div className="mt-4">
                <VitePlaceReactionButtons
                  key={`${place.id}:${place.likeCount}:${place.dislikeCount}:${place.viewerReaction ?? "none"}`}
                  placeId={place.id}
                  initialLikeCount={place.likeCount}
                  initialDislikeCount={place.dislikeCount}
                  initialViewerReaction={place.viewerReaction}
                  onUpdate={handleReactionUpdate}
                />
              </div>
              <div className="mt-3">
                <PlaceShareButton
                  path={sharePayload.path}
                  title={sharePayload.title}
                  text={sharePayload.text}
                  testId="place-page-share-button"
                  messageTestId="place-page-share-message"
                />
              </div>
            </section>

            <aside className="grid gap-3">
              <section className="rounded-[1rem] border border-stone-200 bg-[var(--altteul-bg-subtle)]/65 p-4">
                <p className="text-xs font-medium text-stone-500">최근 갱신</p>
                <p className="mt-2 text-base font-semibold text-stone-900">
                  {place.lastPriceUpdatedAt}
                </p>
              </section>
              <section className="rounded-[1rem] border border-stone-200 bg-[var(--altteul-bg-subtle)]/65 p-4">
                <p className="text-xs font-medium text-stone-500">주소</p>
                <p className="mt-2 text-sm leading-6 text-stone-700">
                  {place.address}
                </p>
              </section>
              {(place.description || place.note) && (
                <section className="rounded-[1rem] border border-stone-200 bg-[var(--altteul-bg-subtle)]/65 p-4">
                  <p className="text-xs font-medium text-stone-500">메모</p>
                  <p className="mt-2 text-sm leading-6 text-stone-700">
                    {place.note || place.description}
                  </p>
                </section>
              )}
              <Link
                to={`/report?placeId=${place.id}&placeName=${encodeURIComponent(place.name)}`}
                className="altteulmap-accent-ghost altteulmap-button inline-flex w-fit whitespace-nowrap border px-4 py-2 text-sm transition"
              >
                신고하기
              </Link>
            </aside>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)]">
            <section className="grid gap-5">
              {place.description ? (
                <section className="altteulmap-panel p-5">
                  <p className="altteulmap-section-kicker text-[11px]">소개</p>
                  <p className="mt-3 text-sm leading-7 text-stone-700">
                    {place.description}
                  </p>
                </section>
              ) : null}

              <section className="altteulmap-panel p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="altteulmap-section-kicker text-[11px]">가격</p>
                    <h2 className="mt-1 text-lg font-semibold text-stone-900">
                      가격 항목
                    </h2>
                  </div>
                  <span className="altteulmap-badge px-3 py-1 text-xs font-medium">
                    {place.priceItems.length}개
                  </span>
                </div>
                <div className="mt-4 divide-y divide-stone-200">
                  {place.priceItems.map((item) => (
                    <div key={item.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-medium text-stone-900">{item.label}</p>
                          <p className="mt-1 text-xs text-stone-500">
                            마지막 제보 {item.reportedAt}
                          </p>
                        </div>
                        <div className="shrink-0 text-left sm:text-right">
                          <p className="altteulmap-price-number text-lg">
                            {formatKrw(item.amount)}원
                            {item.unitLabel ? ` / ${item.unitLabel}` : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </section>

            <aside className="grid content-start gap-3">
              <RouteResetDetails
                className="overflow-hidden rounded-[1rem] border border-stone-200 bg-[var(--altteul-bg-surface)]"
                summaryClassName="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left [&::-webkit-details-marker]:hidden"
                summary={
                  <>
                    <div className="min-w-0">
                      <p className="altteulmap-section-kicker text-[11px]">가격 제보</p>
                      <h3 className="mt-1 text-base font-semibold text-stone-900">
                        새 가격 남기기
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-stone-500">
                        가격표가 달라졌을 때만 열어 작성합니다.
                      </p>
                    </div>
                    <span className="altteulmap-badge shrink-0 px-3 py-1 text-xs font-medium">
                      열기
                    </span>
                  </>
                }
                bodyClassName="border-t border-stone-200 p-4"
              >
                <PlacePriceReportForm
                  key={`${place.id}-price-form`}
                  placeId={place.id}
                  showHeader={false}
                  surface="plain"
                  suggestedItems={place.priceItems}
                />
              </RouteResetDetails>

              <RouteResetDetails
                className="overflow-hidden rounded-[1rem] border border-stone-200 bg-[var(--altteul-bg-surface)]"
                summaryClassName="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left [&::-webkit-details-marker]:hidden"
                summary={
                  <>
                    <div className="min-w-0">
                      <p className="altteulmap-section-kicker text-[11px]">코멘트</p>
                      <h3 className="mt-1 text-base font-semibold text-stone-900">
                        이용 메모 보기
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-stone-500">
                        현재 {place.comments.length}개가 등록돼 있습니다.
                      </p>
                    </div>
                    <span className="altteulmap-badge shrink-0 px-3 py-1 text-xs font-medium">
                      열기
                    </span>
                  </>
                }
                bodyClassName="border-t border-stone-200 p-4"
              >
                <PlaceCommentsSection
                  key={`${place.id}-comments`}
                  placeId={place.id}
                  initialComments={place.comments}
                  showHeader={false}
                  surface="plain"
                />
              </RouteResetDetails>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
