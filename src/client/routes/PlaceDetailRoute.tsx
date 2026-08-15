import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { VitePlaceReactionButtons } from "@/client/components/VitePlaceReactionButtons";
import { getCategoryBySlug } from "@/features/categories/catalog";
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
        <div className="altteulmap-panel mx-auto grid max-w-6xl gap-4 p-6">
          <p className="text-sm text-[var(--altteul-text-tertiary)]">장소를 찾을 수 없습니다.</p>
          <Link
            to="/"
            className="altteulmap-button w-fit px-4 py-2 text-sm font-medium"
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
        <div className="altteulmap-panel mx-auto max-w-6xl p-6 text-sm text-[var(--altteul-text-tertiary)]">
          장소 상세를 불러오는 중입니다.
        </div>
      </main>
    );
  }

  if (state.status === "not-found" || state.status === "error") {
    return (
      <main className="bg-[var(--altteul-bg-canvas)] px-4 py-6 sm:px-6 sm:py-8">
        <div className="altteulmap-panel mx-auto grid max-w-6xl gap-4 p-6">
          <p className="text-sm text-[var(--altteul-text-tertiary)]">{state.error}</p>
          <Link
            to="/"
            className="altteulmap-button w-fit px-4 py-2 text-sm font-medium"
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
    place.verificationStatus === "verified" ? "확인됨" : "확인 전";
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
          className="altteulmap-button inline-flex whitespace-nowrap px-4 py-2 text-sm font-medium transition"
        >
          지도로 돌아가기
        </Link>

        <section className="mt-5 grid gap-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
            <section className="altteulmap-accent-panel rounded-[1rem] p-5 sm:p-6">
              <p className="altteulmap-section-kicker">
                {category?.parentName ?? "장소"}
              </p>
              <h1 className="mt-2 break-keep text-[2rem] font-bold leading-tight text-[var(--altteul-text-strong)] sm:text-[2.6rem]">
                {place.name}
              </h1>
              {place.businessName && place.businessName !== place.name ? (
                <p className="mt-3 text-sm text-[var(--altteul-primary-text)]">
                  사업장 이름 {place.businessName}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {summaryItems.map((item) => (
                  <span
                    key={item}
                    className="altteulmap-badge bg-[var(--altteul-bg-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--altteul-primary-text)]"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <p className="mt-6 text-[11px] font-semibold text-[var(--altteul-primary-text)]">
                대표 가격
              </p>
              <p className="altteulmap-price-number mt-2 text-[2.4rem] sm:text-[2.8rem]">
                {formatKrw(place.representativePriceAmount)}원
              </p>
              <p className="mt-2 text-sm text-[var(--altteul-primary-text)]">
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
              <section className="rounded-[0.875rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-subtle)] p-4">
                <p className="text-xs font-medium text-[var(--altteul-text-tertiary)]">최근 갱신</p>
                <p className="mt-2 text-base font-semibold text-[var(--altteul-text-strong)]">
                  {place.lastPriceUpdatedAt}
                </p>
              </section>
              <section className="rounded-[0.875rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-subtle)] p-4">
                <p className="text-xs font-medium text-[var(--altteul-text-tertiary)]">주소</p>
                <p className="mt-2 text-sm leading-6 text-[var(--altteul-text-secondary)]">
                  {place.address}
                </p>
              </section>
              {(place.description || place.note) && (
                <section className="rounded-[0.875rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-subtle)] p-4">
                  <p className="text-xs font-medium text-[var(--altteul-text-tertiary)]">메모</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--altteul-text-secondary)]">
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
                  <p className="mt-3 text-sm leading-7 text-[var(--altteul-text-secondary)]">
                    {place.description}
                  </p>
                </section>
              ) : null}

              <section className="altteulmap-panel p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="altteulmap-section-kicker text-[11px]">가격</p>
                    <h2 className="mt-1 text-lg font-semibold text-[var(--altteul-text-strong)]">
                      가격 항목
                    </h2>
                  </div>
                  <span className="altteulmap-badge px-3 py-1 text-xs font-medium">
                    {place.priceItems.length}개
                  </span>
                </div>
                <div className="mt-4 divide-y divide-[var(--altteul-surface-border)]">
                  {place.priceItems.map((item) => (
                    <div key={item.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--altteul-text-strong)]">{item.label}</p>
                          <p className="mt-1 text-xs text-[var(--altteul-text-tertiary)]">
                            마지막 가격 확인 {item.reportedAt}
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
              <section className="overflow-hidden rounded-[0.875rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)]">
                <div className="px-4 py-3 text-left">
                  <p className="altteulmap-section-kicker text-[11px]">가격 정보 추가</p>
                  <h3 className="mt-1 text-base font-semibold text-[var(--altteul-text-strong)]">
                    가격 정보 추가하기
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--altteul-text-tertiary)]">
                    가격표가 달라졌다면 새로운 가격 정보를 알려주세요.
                  </p>
                </div>
                <div className="border-t border-[var(--altteul-surface-border)] p-4">
                  <PlacePriceReportForm
                    key={`${place.id}-price-form`}
                    placeId={place.id}
                    showHeader={false}
                    surface="plain"
                    suggestedItems={place.priceItems}
                  />
                </div>
              </section>

              <section className="overflow-hidden rounded-[0.875rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)]">
                <div className="px-4 py-3 text-left">
                  <p className="altteulmap-section-kicker text-[11px]">코멘트</p>
                  <h3 className="mt-1 text-base font-semibold text-[var(--altteul-text-strong)]">
                    이용 메모
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--altteul-text-tertiary)]">
                    현재 {place.comments.length}개가 등록돼 있습니다.
                  </p>
                </div>
                <div className="border-t border-[var(--altteul-surface-border)] p-4">
                  <PlaceCommentsSection
                    key={`${place.id}-comments`}
                    placeId={place.id}
                    initialComments={place.comments}
                    showHeader={false}
                    surface="plain"
                  />
                </div>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
