import { Link } from "react-router-dom";

import { ViteBookmarkToggleButton } from "@/client/components/ViteBookmarkToggleButton";
import { useBookmarkedPlaces } from "@/client/routes/bookmarks/useBookmarkedPlaces";
import { getCategoryBySlug } from "@/features/categories/catalog";

function formatKrw(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

export function BookmarksRoute() {
  const { setState, state } = useBookmarkedPlaces();

  return (
    <main className="bg-[var(--altteul-bg-canvas)] px-4 py-6 sm:px-6 sm:py-8">
      <section className="mx-auto max-w-7xl">
        <div>
          <p className="altteulmap-section-kicker">저장한 장소</p>
          <h1 className="mt-2 text-[2rem] font-bold text-[var(--altteul-text-strong)] sm:text-[2.4rem]">
          저장한 장소
          </h1>
          {state.status === "success" ? (
            <p className="mt-2 text-sm text-[var(--altteul-text-secondary)]">
              현재 로그인한 계정 기준으로 저장한 장소입니다.
            </p>
          ) : null}
        </div>

        {state.status === "loading" ? (
          <div className="mt-6 rounded-[0.875rem] border border-dashed border-[var(--altteul-surface-border-strong)] bg-[var(--altteul-bg-surface)] p-6 text-sm text-[var(--altteul-text-tertiary)]">
            저장한 장소를 불러오는 중입니다.
          </div>
        ) : null}

        {state.status === "unauthorized" ? (
          <div className="mt-6 rounded-[0.875rem] border border-dashed border-[var(--altteul-surface-border-strong)] bg-[var(--altteul-bg-surface)] p-6 text-sm leading-7 text-[var(--altteul-text-secondary)] sm:p-8">
            <p className="text-base font-semibold text-[var(--altteul-text-strong)]">
              로그인이 필요합니다
            </p>
            <p className="mt-2 max-w-2xl">
              저장한 장소는 계정에 보관됩니다. 로그인 후 다시 확인할 수 있습니다.
            </p>
            <Link
              to="/login?callbackUrl=%2Fbookmarks"
              className="altteulmap-accent-solid altteulmap-button mt-5 inline-flex items-center justify-center px-5 py-3 text-sm font-medium"
            >
              로그인하기
            </Link>
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className="mt-6 rounded-[0.875rem] border border-[var(--altteul-warning-border)] bg-[var(--altteul-warning-soft)] p-6 text-sm text-[var(--altteul-warning-text)]">
            {state.error}
          </div>
        ) : null}

        {state.status === "success" && state.data.items.length > 0 ? (
          <div data-testid="bookmark-list" className="mt-6 grid gap-3">
            {state.data.items.map(({ bookmarkCreatedAt, place }) => {
              const category = getCategoryBySlug(place.categorySlug);

              return (
                <article
                  key={place.id}
                  data-testid={`bookmark-item-${place.id}`}
                  className="rounded-[0.875rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)] p-5 transition hover:border-[var(--altteul-primary-border)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-[var(--altteul-primary-text)]">
                        저장일 {bookmarkCreatedAt}
                      </p>
                      <h2 className="mt-2 text-xl font-bold text-[var(--altteul-text-strong)] sm:text-2xl">
                        {place.name}
                      </h2>
                      <p className="mt-2 text-sm text-[var(--altteul-text-secondary)]">
                        {category?.name ?? "기타"}
                      </p>
                      <p className="mt-1 text-sm text-[var(--altteul-text-tertiary)]">
                        {place.district}
                      </p>
                    </div>
                    <div className="rounded-[0.75rem] border border-[var(--altteul-primary-border)] bg-[var(--altteul-primary-soft)] px-4 py-3 text-right">
                      <p className="text-xs font-semibold text-[var(--altteul-primary-text)]">
                        대표 가격
                      </p>
                      <p className="altteulmap-price-number mt-2 text-xl">
                        {formatKrw(place.representativePriceAmount)}원
                      </p>
                      <p className="text-sm text-[var(--altteul-primary-text)]">
                        {place.representativePriceLabel}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <ViteBookmarkToggleButton
                      key={`${place.id}:on`}
                      placeId={place.id}
                      initialBookmarked
                      compact
                      onUpdate={(nextBookmarked) => {
                        if (nextBookmarked) {
                          return;
                        }

                        setState((current) =>
                          current.status === "success"
                            ? {
                                ...current,
                                data: {
                                  ...current.data,
                                  items: current.data.items.filter(
                                    (item) => item.place.id !== place.id,
                                  ),
                                },
                              }
                            : current,
                        );
                      }}
                    />
                    <Link
                      to={`/place/${place.id}`}
                      className="altteulmap-accent-solid altteulmap-button whitespace-nowrap px-4 py-2 text-sm font-medium transition"
                    >
                      상세 보기
                    </Link>
                    <Link
                      to={`/?q=${encodeURIComponent(place.name)}&scope=global`}
                      className="altteulmap-button whitespace-nowrap px-4 py-2 text-sm font-medium transition"
                    >
                      지도에서 찾기
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {state.status === "success" && state.data.items.length === 0 ? (
          <div className="mt-6 rounded-[0.875rem] border border-dashed border-[var(--altteul-surface-border-strong)] bg-[var(--altteul-bg-surface)] p-6 text-sm leading-7 text-[var(--altteul-text-secondary)] sm:p-8">
            <p className="text-base font-semibold text-[var(--altteul-text-strong)]">
              아직 저장한 장소가 없어요
            </p>
            <p className="mt-2 max-w-2xl">
              점심, 세탁, 프린트처럼 자주 확인하는 장소를 저장하면 다음에
              가격을 더 빨리 볼 수 있습니다.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link
                to="/"
                className="altteulmap-accent-solid altteulmap-button inline-flex items-center justify-center px-5 py-3 text-sm font-medium"
              >
                장소 찾기
              </Link>
              <Link
                to="/submit"
                className="altteulmap-button inline-flex items-center justify-center px-5 py-3 text-sm font-medium"
              >
                장소 등록하기
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
