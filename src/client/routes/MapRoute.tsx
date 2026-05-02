import type { ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";

import { ViteBookmarkToggleButton } from "@/client/components/ViteBookmarkToggleButton";
import { VitePlaceReactionButtons } from "@/client/components/VitePlaceReactionButtons";
import {
  categoryGroups,
  getCategoryBySlug,
} from "@/features/categories/catalog";
import { NaverMapPanel } from "@/features/map/naver-map-panel";
import type { MapViewport } from "@/features/map/naver-map-sdk";
import { RouteResetDetails } from "@/features/map/route-reset-details";
import { PlaceShareButton } from "@/features/places/place-share-button";
import { createPlaceSharePayload } from "@/features/places/share";
import type {
  PlaceBounds,
  PlaceMapMarkerMode,
  PlaceMapMarkerRecord,
  PlaceRecord,
  PlacePreviewRecord,
  PlaceSearchScope,
} from "@/features/places/types";

type MapPlacesResponse = {
  bounds: PlaceBounds | null;
  count: number;
  filters: {
    bounds: PlaceBounds | null;
    category: string | null;
    query: string | null;
    searchScope: PlaceSearchScope;
  };
  items: PlacePreviewRecord[];
  mapMarkers: PlaceMapMarkerRecord[];
  markerMode: PlaceMapMarkerMode;
  mapMarkerCount: number;
  returnedCount: number;
  source: "database" | "mock";
  mock: boolean;
};

type BookmarksResponse = {
  items?: Array<{ placeId: string }>;
};

type PlaceReactionUpdate = {
  dislikeCount: number;
  likeCount: number;
  placeId: string;
  viewerReaction: PlacePreviewRecord["viewerReaction"];
};

type PlaceDetailResponse = {
  item: PlaceRecord;
  source: "database" | "mock";
  mock: boolean;
};

type LoadState =
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: MapPlacesResponse; error: null }
  | { status: "error"; data: null; error: string };

type PlaceDetailLoadState =
  | { status: "idle"; data: null; error: null }
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: PlaceRecord; error: null }
  | { status: "error"; data: null; error: string };

type MobileSheetMode = "hidden" | "peek" | "expanded";

const SEOUL_BOOTSTRAP_BOUNDS: PlaceBounds = {
  minLat: 37.4133,
  maxLat: 37.7151,
  minLng: 126.7341,
  maxLng: 127.2693,
};
const SEOUL_BOOTSTRAP_ZOOM = 11;
const VIEWPORT_FETCH_DEBOUNCE_MS = 320;
const CLUSTER_FOCUS_VIEWPORT_LOCK_MS = 360;

const scopeChipClassName =
  "altteulmap-scope-chip inline-flex min-w-[6.75rem] items-center justify-center whitespace-nowrap rounded-[0.65rem] px-3 py-2 text-xs font-semibold transition sm:text-sm";

function useIsDesktopLayout() {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia("(min-width: 1280px)").matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1280px)");
    const updateDesktopState = () => setIsDesktop(mediaQuery.matches);

    updateDesktopState();
    mediaQuery.addEventListener("change", updateDesktopState);

    return () => {
      mediaQuery.removeEventListener("change", updateDesktopState);
    };
  }, []);

  return isDesktop;
}

function formatKrw(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

function getVerificationBadgeClassName(status: PlacePreviewRecord["verificationStatus"]) {
  return status === "verified"
    ? "altteulmap-badge altteulmap-badge-success"
    : "altteulmap-badge altteulmap-badge-warning";
}

function getVerificationLabel(status: PlacePreviewRecord["verificationStatus"]) {
  return status === "verified" ? "검증됨" : "확인 필요";
}

function buildMapApiPath(
  searchParams: URLSearchParams,
  viewport?: MapViewport | null,
) {
  const apiParams = new URLSearchParams();
  const category = searchParams.get("category");
  const query = searchParams.get("q")?.trim() || "";
  const scope = searchParams.get("scope") === "global" ? "global" : "viewport";

  if (category) {
    apiParams.set("category", category);
  }

  if (query) {
    apiParams.set("query", query);
    apiParams.set("scope", scope);
  }

  if (scope === "viewport" && viewport) {
    const snappedBounds = isBootstrapBounds(viewport.bounds)
      ? viewport.bounds
      : snapViewportBounds(viewport.bounds, viewport.zoom);

    apiParams.set("minLat", String(snappedBounds.minLat));
    apiParams.set("maxLat", String(snappedBounds.maxLat));
    apiParams.set("minLng", String(snappedBounds.minLng));
    apiParams.set("maxLng", String(snappedBounds.maxLng));
    apiParams.set("zoom", String(Math.round(viewport.zoom)));
  }

  const queryString = apiParams.toString();

  return queryString ? `/api/places/map?${queryString}` : "/api/places/map";
}

function isBootstrapBounds(bounds: PlaceBounds) {
  return (
    bounds.minLat === SEOUL_BOOTSTRAP_BOUNDS.minLat &&
    bounds.maxLat === SEOUL_BOOTSTRAP_BOUNDS.maxLat &&
    bounds.minLng === SEOUL_BOOTSTRAP_BOUNDS.minLng &&
    bounds.maxLng === SEOUL_BOOTSTRAP_BOUNDS.maxLng
  );
}

function getViewportBoundsSnapFactor(zoom: number) {
  if (zoom <= 12) {
    return 200;
  }

  if (zoom <= 14) {
    return 500;
  }

  return 1_000;
}

function snapViewportBounds(bounds: PlaceBounds, zoom: number): PlaceBounds {
  const snapFactor = getViewportBoundsSnapFactor(zoom);

  return {
    minLat: Math.floor(bounds.minLat * snapFactor) / snapFactor,
    maxLat: Math.ceil(bounds.maxLat * snapFactor) / snapFactor,
    minLng: Math.floor(bounds.minLng * snapFactor) / snapFactor,
    maxLng: Math.ceil(bounds.maxLng * snapFactor) / snapFactor,
  };
}

function createBootstrapViewport(): MapViewport {
  return {
    bounds: SEOUL_BOOTSTRAP_BOUNDS,
    center: {
      lat: (SEOUL_BOOTSTRAP_BOUNDS.minLat + SEOUL_BOOTSTRAP_BOUNDS.maxLat) / 2,
      lng: (SEOUL_BOOTSTRAP_BOUNDS.minLng + SEOUL_BOOTSTRAP_BOUNDS.maxLng) / 2,
    },
    zoom: SEOUL_BOOTSTRAP_ZOOM,
  };
}

function createMapHref(params: {
  category?: string | null;
  query?: string | null;
  scope?: PlaceSearchScope;
}) {
  const search = new URLSearchParams();
  const query = params.query?.trim();

  if (query) {
    search.set("q", query);
    search.set("scope", params.scope ?? "global");
  }

  if (params.category) {
    search.set("category", params.category);
  }

  const queryString = search.toString();

  return queryString ? `/?${queryString}` : "/";
}

function getLoginHref() {
  const callbackUrl =
    typeof window === "undefined"
      ? "/"
      : `${window.location.pathname}${window.location.search}`;

  return `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

function MapCategoryTray({
  activeCategory,
  activeQuery,
  activeSearchScope,
}: {
  activeCategory: string | null;
  activeQuery: string | null;
  activeSearchScope: PlaceSearchScope;
}) {
  const selectedCategory = getCategoryBySlug(activeCategory);
  const totalCategoryCount = categoryGroups.reduce(
    (count, group) => count + group.children.length,
    0,
  );
  const [activeGroupSlug, setActiveGroupSlug] = useState(
    selectedCategory?.parentSlug ?? categoryGroups[0]?.slug ?? null,
  );
  const resolvedGroupSlug = selectedCategory?.parentSlug ?? activeGroupSlug;
  const activeGroup = useMemo(
    () =>
      categoryGroups.find((group) => group.slug === resolvedGroupSlug) ??
      categoryGroups[0] ??
      null,
    [resolvedGroupSlug],
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[var(--altteul-text-tertiary)]">
            전체 {totalCategoryCount}개 업종
          </span>
          <Link
            to={createMapHref({
              category: null,
              query: activeQuery,
              scope: activeSearchScope,
            })}
            className={`altteulmap-chip inline-flex min-w-0 items-center justify-center border px-3 py-2 text-center text-xs font-medium leading-tight transition sm:text-sm ${
              activeCategory
                ? "border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)] text-[var(--altteul-text-primary)] hover:bg-[var(--altteul-surface-fill-hover)]"
                : "altteulmap-accent-chip"
            }`}
          >
            전체 보기
          </Link>
          <span className="altteulmap-badge whitespace-nowrap px-2.5 py-1 text-[11px] font-medium">
            {selectedCategory
              ? `현재 ${selectedCategory.parentName} · ${selectedCategory.name}`
              : "현재 전체 카테고리"}
          </span>
        </div>

        <div className="grid gap-2">
          <p className="text-xs font-medium text-[var(--altteul-text-tertiary)]">
            상위 묶음 먼저 고르기
          </p>
          <div className="altteulmap-scroll-row">
            {categoryGroups.map((group) => {
              const isGroupSelected = group.slug === activeGroup?.slug;
              const isGroupActive = group.children.some(
                (category) => category.slug === activeCategory,
              );

              return (
                <button
                  key={group.slug}
                  type="button"
                  onClick={() => setActiveGroupSlug(group.slug)}
                  className={`altteulmap-chip inline-flex shrink-0 items-center gap-2 border px-3 py-2 text-sm font-medium transition ${
                    isGroupSelected
                      ? "border-[var(--altteul-primary-border)] bg-[var(--altteul-primary-soft)] text-[var(--altteul-primary-text)]"
                      : "border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)] text-[var(--altteul-text-primary)] hover:bg-[var(--altteul-surface-fill-hover)]"
                  }`}
                >
                  <span>{group.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      isGroupSelected || isGroupActive
                        ? "bg-[var(--altteul-bg-surface)] text-[var(--altteul-primary-text)]"
                        : "bg-[var(--altteul-bg-subtle)] text-[var(--altteul-text-tertiary)]"
                    }`}
                  >
                    {group.children.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {activeGroup ? (
        <section className="grid gap-3 border-t border-[var(--altteul-surface-border)] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--altteul-text-strong)]">
                {activeGroup.name}
              </h3>
              <p className="mt-1 text-xs text-[var(--altteul-text-tertiary)]">
                세부 업종을 골라 결과를 바로 좁힙니다.
              </p>
            </div>
            <span className="altteulmap-badge whitespace-nowrap px-2.5 py-1 text-[11px] font-medium">
              {activeGroup.children.length}개 업종
            </span>
          </div>

          <div className="altteulmap-chip-grid">
            {activeGroup.children.map((category) => {
              const isActive = activeCategory === category.slug;

              return (
                <Link
                  key={category.slug}
                  to={createMapHref({
                    category: category.slug,
                    query: activeQuery,
                    scope: activeSearchScope,
                  })}
                  className={`altteulmap-chip inline-flex min-w-0 items-center justify-center border px-3 py-2 text-center text-xs font-medium leading-tight break-keep transition sm:text-sm ${
                    isActive
                      ? "altteulmap-accent-chip"
                      : "border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)] text-[var(--altteul-text-primary)] hover:bg-[var(--altteul-surface-fill-hover)]"
                  }`}
                >
                  {category.name}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PlaceCard({
  bookmarked,
  isSelected,
  loginHref,
  place,
  onBookmarkUpdate,
  onSelect,
}: {
  bookmarked: boolean;
  isSelected: boolean;
  loginHref: string;
  place: PlacePreviewRecord;
  onBookmarkUpdate: (placeId: string, bookmarked: boolean) => void;
  onSelect: (place: PlacePreviewRecord) => void;
}) {
  const category = getCategoryBySlug(place.categorySlug);
  const sharePayload = createPlaceSharePayload(place, "list");

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(place)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(place);
        }
      }}
      className={`rounded-[0.85rem] border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--altteul-primary)] ${
        isSelected
          ? "border-[var(--altteul-primary-border)] bg-[var(--altteul-primary-soft)]"
          : "border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)] hover:border-[var(--altteul-primary-border)] hover:bg-[var(--altteul-surface-fill-hover)]"
      }`}
      data-testid={`place-list-item-${place.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-[var(--altteul-primary-text)]">
            대표가 · {place.representativePriceLabel || "기준 가격"}
          </p>
          <p className="altteulmap-price-number mt-1 text-[1.75rem] leading-none">
            {formatKrw(place.representativePriceAmount)}원
          </p>
        </div>
        <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
          <ViteBookmarkToggleButton
            compact
            initialBookmarked={bookmarked}
            loginHref={loginHref}
            placeId={place.id}
            onUpdate={(nextBookmarked) =>
              onBookmarkUpdate(place.id, nextBookmarked)
            }
          />
        </div>
      </div>
      <h2 className="mt-3 truncate text-base font-bold text-[var(--altteul-text-strong)]">
        {place.name}
      </h2>
      <p className="mt-1 truncate text-xs text-[var(--altteul-text-secondary)]">
        {[category?.name ?? "기타", place.district].join(" · ")}
      </p>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--altteul-text-secondary)]">
        {place.description || place.note || place.address}
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <span className={`${getVerificationBadgeClassName(place.verificationStatus)} px-2.5 py-1 text-[11px] font-semibold`}>
            {getVerificationLabel(place.verificationStatus)}
          </span>
          <span className="altteulmap-badge altteulmap-badge-info px-2.5 py-1 text-[11px] font-medium">
            갱신 {place.lastPriceUpdatedAt}
          </span>
          <span
            className="altteulmap-badge px-2.5 py-1 text-[11px] font-medium"
            data-testid={`place-list-like-count-${place.id}`}
          >
            👍 {place.likeCount}
          </span>
        </div>
        <div
          className="flex items-center gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          <PlaceShareButton
            path={sharePayload.path}
            title={sharePayload.title}
            text={sharePayload.text}
            className="altteulmap-button inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs font-medium"
            messageClassName="mt-1 text-right text-[11px] text-[var(--altteul-text-tertiary)]"
            testId={`place-list-item-share-button-${place.id}`}
            messageTestId={`place-list-item-share-message-${place.id}`}
          />
          <button
            type="button"
            onClick={() => onSelect(place)}
            className="altteulmap-button inline-flex px-3 py-1.5 text-xs font-medium"
          >
            가격 보기
          </button>
        </div>
      </div>
    </article>
  );
}

function PlaceDetailSheet({
  bookmarked,
  closeTestId = "place-detail-close",
  loginHref,
  place,
  testId = "place-detail-sheet",
  onBookmarkUpdate,
  onClose,
  onReactionUpdate,
}: {
  bookmarked: boolean;
  closeTestId?: string;
  loginHref: string;
  place: PlacePreviewRecord;
  testId?: string;
  onBookmarkUpdate: (placeId: string, bookmarked: boolean) => void;
  onClose: () => void;
  onReactionUpdate: (update: PlaceReactionUpdate) => void;
}) {
  const category = getCategoryBySlug(place.categorySlug);
  const sharePayload = createPlaceSharePayload(place, "detail_sheet");
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [detailState, setDetailState] = useState<PlaceDetailLoadState>({
    status: "idle",
    data: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    setDetailState({ status: "loading", data: null, error: null });

    fetch(`/api/places/${encodeURIComponent(place.id)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("상세 정보를 불러오지 못했습니다.");
        }

        return (await response.json()) as PlaceDetailResponse;
      })
      .then((payload) => {
        setDetailState({ status: "success", data: payload.item, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setDetailState({
          status: "error",
          data: null,
          error:
            error instanceof Error
              ? error.message
              : "상세 정보를 불러오지 못했습니다.",
        });
      });

    return () => {
      controller.abort();
    };
  }, [place.id]);

  const detailPlace = detailState.status === "success" ? detailState.data : null;

  return (
    <aside
      data-testid={testId}
      className="altteulmap-panel fixed inset-x-3 bottom-3 z-30 max-h-[82dvh] overflow-auto p-4 shadow-[var(--altteul-shadow-overlay)] xl:static xl:max-h-none xl:shadow-none"
    >
      <button
        type="button"
        aria-label="상세 시트 닫기"
        data-testid="place-detail-drag-handle"
        className="mx-auto mb-3 block h-2 w-14 rounded-full bg-[var(--altteul-bg-muted)] xl:hidden"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragStartY(event.clientY);
        }}
        onPointerUp={(event) => {
          if (dragStartY !== null && event.clientY - dragStartY > 80) {
            onClose();
          }
          setDragStartY(null);
        }}
        onPointerCancel={() => setDragStartY(null)}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="altteulmap-section-kicker">선택한 장소</p>
          <h2 className="mt-1 text-xl font-bold text-[var(--altteul-text-strong)]">
            {place.name}
          </h2>
          <p className="mt-1 text-sm text-[var(--altteul-text-secondary)]">
            {[category?.name ?? "기타", place.district].join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          data-testid={closeTestId}
          aria-label="상세 닫기"
          className="altteulmap-button flex h-9 w-9 shrink-0 items-center justify-center px-0 text-lg font-semibold leading-none"
        >
          ×
        </button>
      </div>

      <div className="mt-4 rounded-[0.85rem] border border-[var(--altteul-primary-border)] bg-[var(--altteul-primary-soft)] px-4 py-3">
        <p className="text-[11px] font-semibold text-[var(--altteul-primary-text)]">
          대표가 · {place.representativePriceLabel || "기준 가격"}
        </p>
        <p className="altteulmap-price-number mt-1 text-3xl">
          {formatKrw(place.representativePriceAmount)}원
        </p>
        <p className="mt-2 text-xs text-[var(--altteul-primary-text)]">
          {place.verificationStatus === "verified" ? "검증된 가격" : "검증 대기 가격"} · 갱신 {place.lastPriceUpdatedAt}
        </p>
      </div>

      <p className="mt-4 text-sm leading-6 text-[var(--altteul-text-secondary)]">
        {place.description || place.note || place.address}
      </p>
      <p className="mt-2 text-xs leading-5 text-[var(--altteul-text-tertiary)]">{place.address}</p>

      <div className="mt-4 grid gap-3" data-testid="place-detail-inline-details">
        {detailState.status === "loading" ? (
          <div className="rounded-[0.85rem] border border-dashed border-[var(--altteul-surface-border-strong)] bg-[var(--altteul-bg-subtle)] px-4 py-3 text-sm text-[var(--altteul-text-tertiary)]">
            상세 정보를 불러오는 중입니다.
          </div>
        ) : null}

        {detailState.status === "error" ? (
          <div className="rounded-[0.85rem] border border-[var(--altteul-warning-border)] bg-[var(--altteul-warning-soft)] px-4 py-3 text-sm text-[var(--altteul-warning-text)]">
            {detailState.error}
          </div>
        ) : null}

        {detailPlace ? (
          <>
            <section className="rounded-[0.85rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-subtle)] p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="altteulmap-section-kicker text-[11px]">가격</p>
                  <h3 className="mt-1 text-sm font-semibold text-[var(--altteul-text-strong)]">
                    가격 항목
                  </h3>
                </div>
                <span className="altteulmap-badge px-2.5 py-1 text-[11px] font-medium">
                  {detailPlace.priceItems.length}개
                </span>
              </div>
              <div className="mt-3 divide-y divide-[var(--altteul-surface-border)]">
                {detailPlace.priceItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--altteul-text-strong)]">
                        {item.label}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--altteul-text-tertiary)]">
                        마지막 제보 {item.reportedAt}
                      </p>
                    </div>
                    <p className="altteulmap-price-number shrink-0 text-base">
                      {formatKrw(item.amount)}원
                      {item.unitLabel ? ` / ${item.unitLabel}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {detailPlace.history.length > 0 ? (
              <section className="rounded-[0.85rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-subtle)] p-3.5">
                <p className="altteulmap-section-kicker text-[11px]">이력</p>
                <h3 className="mt-1 text-sm font-semibold text-[var(--altteul-text-strong)]">
                  최근 가격 이력
                </h3>
                <div className="mt-3 grid gap-2">
                  {detailPlace.history.slice(0, 4).map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 truncate text-[var(--altteul-text-secondary)]">
                        {entry.label}
                      </span>
                      <span className="shrink-0 font-semibold text-[var(--altteul-text-strong)]">
                        {formatKrw(entry.amount)}원 · {entry.recordedAt}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {detailPlace.comments.length > 0 ? (
              <section className="rounded-[0.85rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-subtle)] p-3.5">
                <p className="altteulmap-section-kicker text-[11px]">코멘트</p>
                <h3 className="mt-1 text-sm font-semibold text-[var(--altteul-text-strong)]">
                  이용 메모
                </h3>
                <div className="mt-3 grid gap-2">
                  {detailPlace.comments.slice(0, 3).map((comment) => (
                    <div
                      key={comment.id}
                      className="rounded-[0.7rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)] px-3 py-2"
                    >
                      <p className="text-xs font-medium text-[var(--altteul-text-primary)]">
                        {comment.authorLabel} · {comment.createdAt}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--altteul-text-secondary)]">
                        {comment.body}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-start gap-2">
        <VitePlaceReactionButtons
          placeId={place.id}
          initialDislikeCount={place.dislikeCount}
          initialLikeCount={place.likeCount}
          initialViewerReaction={place.viewerReaction}
          onUpdate={onReactionUpdate}
        />
        <ViteBookmarkToggleButton
          initialBookmarked={bookmarked}
          loginHref={loginHref}
          placeId={place.id}
          onUpdate={(nextBookmarked) =>
            onBookmarkUpdate(place.id, nextBookmarked)
          }
        />
        <PlaceShareButton
          path={sharePayload.path}
          title={sharePayload.title}
          text={sharePayload.text}
          testId="place-detail-share-button"
          messageTestId="place-detail-share-message"
        />
      </div>

      <div className="mt-4 grid gap-2">
        <Link
          to={`/report?placeId=${encodeURIComponent(place.id)}&placeName=${encodeURIComponent(place.name)}`}
          className="altteulmap-button inline-flex items-center justify-center px-4 py-2 text-sm font-medium"
        >
          신고/수정 요청
        </Link>
      </div>
    </aside>
  );
}

function MobilePlaceListSheet({
  bookmarkedPlaceIds,
  loginHref,
  mode,
  onBookmarkUpdate,
  onModeChange,
  onSelectPlace,
  places,
  state,
  totalPlaceCount,
}: {
  bookmarkedPlaceIds: Set<string>;
  loginHref: string;
  mode: MobileSheetMode;
  onBookmarkUpdate: (placeId: string, bookmarked: boolean) => void;
  onModeChange: (mode: MobileSheetMode) => void;
  onSelectPlace: (place: PlacePreviewRecord) => void;
  places: PlacePreviewRecord[];
  state: LoadState;
  totalPlaceCount: number;
}) {
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const renderMobilePortal = (content: ReactNode) => {
    if (typeof document === "undefined") {
      return content;
    }

    return createPortal(content, document.body);
  };

  if (mode === "hidden") {
    return renderMobilePortal(
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 flex justify-center px-4 xl:hidden"
        style={{ zIndex: 2147483647 }}
      >
        <button
          type="button"
          data-testid="mobile-place-list-open"
          onClick={() => onModeChange("peek")}
          className="altteulmap-button altteulmap-accent-solid pointer-events-auto inline-flex min-h-11 items-center justify-center gap-2 px-5 py-3 text-sm font-semibold shadow-[var(--altteul-shadow-overlay)]"
        >
          목록 열기
          <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs text-[var(--altteul-primary-text)]">
            {state.status === "success" ? `${totalPlaceCount}곳` : "..."}
          </span>
        </button>
      </div>,
    );
  }

  const isExpanded = mode === "expanded";

  const sheet = (
    <section
      data-testid="mobile-place-list-sheet"
      data-sheet-mode={mode}
      className={`fixed inset-x-3 bottom-3 rounded-[1rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)] p-3 shadow-[var(--altteul-shadow-overlay)] transition-all xl:hidden ${
        isExpanded ? "max-h-[88dvh]" : "max-h-[58dvh]"
      }`}
      style={{ zIndex: 2147483647 }}
    >
      <button
        type="button"
        aria-label="목록 시트 크기 조절"
        data-testid="mobile-place-list-drag-handle"
        className="mx-auto mb-3 block h-2 w-14 rounded-full bg-[var(--altteul-bg-muted)]"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragStartY(event.clientY);
        }}
        onPointerUp={(event) => {
          if (dragStartY !== null) {
            const deltaY = event.clientY - dragStartY;
            if (deltaY > 120) {
              onModeChange(mode === "expanded" ? "peek" : "hidden");
            } else if (deltaY < -80) {
              onModeChange("expanded");
            }
          }
          setDragStartY(null);
        }}
        onPointerCancel={() => setDragStartY(null)}
      />
      <div className="flex items-center justify-between gap-3 border-b border-[var(--altteul-surface-border)] pb-3">
        <div>
          <p className="altteulmap-section-kicker text-[11px]">목록</p>
          <h2 className="mt-1 text-base font-semibold text-[var(--altteul-text-strong)]">
            지도 결과
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="altteulmap-badge px-3 py-1 text-xs font-medium">
            {state.status === "success" ? `${totalPlaceCount}곳` : "..."}
          </span>
          <button
            type="button"
            data-testid="mobile-place-list-toggle-size"
            style={{ pointerEvents: "auto" }}
            onClick={() => onModeChange(isExpanded ? "peek" : "expanded")}
            className="altteulmap-button min-h-9 px-3 py-1.5 text-xs font-medium"
          >
            {isExpanded ? "줄이기" : "크게"}
          </button>
        </div>
      </div>
      <div
        data-testid="mobile-place-list"
        className={`mt-3 grid gap-2 overflow-auto pr-1 ${
          isExpanded ? "max-h-[calc(88dvh-7.5rem)]" : "max-h-[calc(58dvh-7.5rem)]"
        }`}
      >
        {state.status === "loading" ? (
          <div className="rounded-[0.85rem] border border-dashed border-[var(--altteul-surface-border-strong)] bg-[var(--altteul-bg-surface)] p-5 text-center text-sm text-[var(--altteul-text-tertiary)]">
            지도 결과를 불러오는 중입니다.
          </div>
        ) : null}
        {state.status === "error" ? (
          <div className="rounded-[0.85rem] border border-[var(--altteul-warning-border)] bg-[var(--altteul-warning-soft)] px-4 py-3 text-sm text-[var(--altteul-warning-text)]">
            {state.error}
          </div>
        ) : null}
        {state.status === "success" && places.length === 0 ? (
          <div className="rounded-[0.85rem] border border-dashed border-[var(--altteul-surface-border-strong)] bg-[var(--altteul-bg-surface)] p-5 text-center text-sm text-[var(--altteul-text-tertiary)]">
            조건에 맞는 장소가 없습니다.
          </div>
        ) : null}
        {places.map((place) => {
          const category = getCategoryBySlug(place.categorySlug);

          return (
            <article
              key={place.id}
              role="button"
              tabIndex={0}
              data-testid={`mobile-place-list-item-${place.id}`}
              style={{ pointerEvents: "auto" }}
              onClick={() => onSelectPlace(place)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectPlace(place);
                }
              }}
              className="rounded-[0.85rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)] p-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--altteul-primary)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[var(--altteul-primary-text)]">
                    대표가 · {place.representativePriceLabel || "기준 가격"}
                  </p>
                  <p className="altteulmap-price-number mt-1 text-xl">
                    {formatKrw(place.representativePriceAmount)}원
                  </p>
                </div>
                <div
                  className="shrink-0"
                  onClick={(event) => event.stopPropagation()}
                >
                  <ViteBookmarkToggleButton
                    compact
                    initialBookmarked={bookmarkedPlaceIds.has(place.id)}
                    loginHref={loginHref}
                    placeId={place.id}
                    onUpdate={(nextBookmarked) =>
                      onBookmarkUpdate(place.id, nextBookmarked)
                    }
                  />
                </div>
              </div>
              <h3 className="mt-2 truncate text-base font-semibold text-[var(--altteul-text-strong)]">
                {place.name}
              </h3>
              <p className="mt-1 truncate text-xs text-[var(--altteul-text-secondary)]">
                {[category?.name ?? "기타", place.district].join(" · ")}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );

  return renderMobilePortal(sheet);
}

function getTrendingReason(place: PlacePreviewRecord) {
  if (place.likeCount > 0) {
    return `좋아요 ${place.likeCount}`;
  }

  return `최근 갱신 ${place.lastPriceUpdatedAt}`;
}

function TrendingPlacesSection({
  items,
  onSelectPlace,
  selectedCategoryLabel,
}: {
  items: PlacePreviewRecord[];
  onSelectPlace: (place: PlacePreviewRecord) => void;
  selectedCategoryLabel: string | null;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section
      className="border-t border-[var(--altteul-surface-border)] pt-4 sm:pt-5"
      data-testid="trending-places-section"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="altteulmap-section-kicker">빠른 비교</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--altteul-text-strong)] sm:text-xl">
            {selectedCategoryLabel
              ? `${selectedCategoryLabel} 빠른 비교`
              : "가격 비교가 쉬운 장소"}
          </h2>
          <p className="mt-1 text-sm text-[var(--altteul-text-tertiary)]">
            현재 결과에서 좋아요와 최근 갱신이 살아 있는 장소를 먼저 보여줍니다.
          </p>
        </div>
        <span className="altteulmap-badge whitespace-nowrap px-3 py-1.5 text-xs font-medium">
          상위 {items.length}곳
        </span>
      </div>

      <div className="altteulmap-scroll-row mt-4 lg:grid lg:grid-cols-3 lg:gap-3 lg:overflow-visible">
        {items.map((place, index) => {
          const category = getCategoryBySlug(place.categorySlug);
          const sharePayload = createPlaceSharePayload(place, "trending");

          return (
            <article
              key={place.id}
              data-testid={`trending-place-card-${place.id}`}
              className="min-w-[16rem] rounded-[0.85rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)] p-3.5 lg:min-w-0"
            >
              <button
                type="button"
                onClick={() => onSelectPlace(place)}
                data-testid={`trending-place-primary-link-${place.id}`}
                className="block w-full rounded-[0.75rem] text-left transition hover:bg-[var(--altteul-surface-fill-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--altteul-primary)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-[var(--altteul-primary-text)]">
                      대표가 · {place.representativePriceLabel}
                    </p>
                    <p className="altteulmap-price-number mt-1 text-[1.55rem]">
                      {formatKrw(place.representativePriceAmount)}원
                    </p>
                  </div>
                  <span className="altteulmap-badge altteulmap-badge-info shrink-0 whitespace-nowrap px-2.5 py-1 text-[11px] font-medium">
                    #{index + 1}
                  </span>
                </div>

                <div className="mt-2.5 min-w-0">
                  <h3 className="line-clamp-2 text-[0.98rem] font-semibold text-[var(--altteul-text-strong)]">
                    {place.name}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--altteul-text-tertiary)]">
                    {category?.name ?? "기타"} · {place.district}
                  </p>
                </div>

                <div className="mt-3 grid gap-2">
                  <span className={`${getVerificationBadgeClassName(place.verificationStatus)} px-2.5 py-1 text-[11px] font-semibold`}>
                    {getVerificationLabel(place.verificationStatus)}
                  </span>
                  <span className="altteulmap-badge px-2.5 py-1 text-[11px] font-medium">
                    {getTrendingReason(place)}
                  </span>
                </div>
              </button>
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectPlace(place)}
                  data-testid={`trending-place-detail-link-${place.id}`}
                  className="text-xs font-semibold text-[var(--altteul-primary-text)]"
                >
                  상세 보기
                </button>
                <PlaceShareButton
                  path={sharePayload.path}
                  title={sharePayload.title}
                  text={sharePayload.text}
                  className="altteulmap-button inline-flex items-center gap-2 whitespace-nowrap px-3 py-1.5 text-xs font-medium transition"
                  messageClassName="mt-1 text-right text-[11px] text-[var(--altteul-text-tertiary)]"
                  testId={`trending-place-share-button-${place.id}`}
                  messageTestId={`trending-place-share-message-${place.id}`}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function MapRoute() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<LoadState>({
    status: "loading",
    data: null,
    error: null,
  });
  const [selectedPlace, setSelectedPlace] = useState<PlacePreviewRecord | null>(
    null,
  );
  const [optimisticClusterPlaces, setOptimisticClusterPlaces] = useState<
    PlacePreviewRecord[] | null
  >(null);
  const isDesktopLayout = useIsDesktopLayout();
  const [mobileListMode, setMobileListMode] =
    useState<MobileSheetMode>("hidden");
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const mapSectionRef = useRef<HTMLElement | null>(null);
  const lastViewportRequestPathRef = useRef<string | null>(null);
  const shouldIgnoreFirstViewportSyncRef = useRef(false);
  const clusterFocusViewportLockUntilRef = useRef(0);
  const [bookmarkedPlaceIds, setBookmarkedPlaceIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isManualRefreshPending, setIsManualRefreshPending] = useState(false);
  const [, startViewportRefresh] = useTransition();
  const query = searchParams.get("q")?.trim() || "";
  const activeCategory = searchParams.get("category");
  const searchScope: PlaceSearchScope =
    query && searchParams.get("scope") === "global" ? "global" : "viewport";
  const selectedCategory = getCategoryBySlug(activeCategory);
  const selectedCategoryLabel = selectedCategory?.name ?? null;
  const loginHref = getLoginHref();

  const loadPlaces = useCallback(
    async (apiPath: string, signal?: AbortSignal) => {
      const response = await fetch(apiPath, {
        cache: "no-store",
        signal,
      });

      if (!response.ok) {
        throw new Error("지도 결과를 불러오지 못했습니다.");
      }

      return (await response.json()) as MapPlacesResponse;
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    const initialViewport =
      searchScope === "viewport" ? createBootstrapViewport() : null;
    const initialApiPath = buildMapApiPath(searchParams, initialViewport);

    shouldIgnoreFirstViewportSyncRef.current = searchScope === "viewport";
    lastViewportRequestPathRef.current = initialApiPath;
    setViewport(initialViewport);

    loadPlaces(initialApiPath, controller.signal)
      .then((data) => {
        setSelectedPlace(null);
        setOptimisticClusterPlaces(null);
        setState({ status: "success", data, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "error",
          data: null,
          error:
            error instanceof Error
              ? error.message
              : "지도 결과를 불러오지 못했습니다.",
        });
      });

    return () => {
      controller.abort();
    };
  }, [loadPlaces, searchParams, searchScope]);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/bookmarks", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return (await response.json()) as BookmarksResponse;
      })
      .then((payload) => {
        if (!payload?.items) {
          return;
        }

        setBookmarkedPlaceIds(
          new Set(payload.items.map((bookmark) => bookmark.placeId)),
        );
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.debug("Bookmarks are unavailable for this visitor.", error);
        }
      });

    return () => controller.abort();
  }, []);

  const refreshViewportPlaces = useCallback(() => {
    if (!viewport) {
      return;
    }

    setIsManualRefreshPending(true);
    startViewportRefresh(async () => {
      try {
        const data = await loadPlaces(buildMapApiPath(searchParams, viewport));
        setState({ status: "success", data, error: null });
        setSelectedPlace(null);
        setOptimisticClusterPlaces(null);
      } catch (error) {
        setState({
          status: "error",
          data: null,
          error:
            error instanceof Error
              ? error.message
              : "지도 결과를 불러오지 못했습니다.",
        });
      } finally {
        setIsManualRefreshPending(false);
      }
    });
  }, [loadPlaces, searchParams, viewport]);

  useEffect(() => {
    if (searchScope !== "viewport" || !viewport) {
      return;
    }

    const apiPath = buildMapApiPath(searchParams, viewport);

    if (lastViewportRequestPathRef.current === apiPath) {
      return;
    }

    const controller = new AbortController();
    const fetchTimeoutId = window.setTimeout(() => {
      lastViewportRequestPathRef.current = apiPath;

      startViewportRefresh(async () => {
        try {
          const data = await loadPlaces(apiPath, controller.signal);
          setState({ status: "success", data, error: null });
          setSelectedPlace(null);
          setOptimisticClusterPlaces(null);
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }

          lastViewportRequestPathRef.current = null;
          setState({
            status: "error",
            data: null,
            error:
              error instanceof Error
                ? error.message
                : "지도 결과를 불러오지 못했습니다.",
          });
        }
      });
    }, VIEWPORT_FETCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(fetchTimeoutId);
      controller.abort();
    };
  }, [loadPlaces, searchParams, searchScope, viewport]);

  const handleViewportChange = useCallback(
    (nextViewport: MapViewport) => {
      if (Date.now() < clusterFocusViewportLockUntilRef.current) {
        return;
      }

      if (
        searchScope === "viewport" &&
        shouldIgnoreFirstViewportSyncRef.current
      ) {
        shouldIgnoreFirstViewportSyncRef.current = false;
        setViewport(nextViewport);
        return;
      }

      setViewport(nextViewport);
    },
    [searchParams, searchScope],
  );

  const handleClusterFocusViewport = useCallback(
    (nextViewport: MapViewport, previewPlaces?: PlacePreviewRecord[]) => {
      const apiPath = buildMapApiPath(searchParams, nextViewport);

      clusterFocusViewportLockUntilRef.current =
        Date.now() + CLUSTER_FOCUS_VIEWPORT_LOCK_MS;
      shouldIgnoreFirstViewportSyncRef.current = false;
      lastViewportRequestPathRef.current = apiPath;
      setOptimisticClusterPlaces(
        previewPlaces && previewPlaces.length > 0 ? previewPlaces : null,
      );
      setViewport(nextViewport);

      startViewportRefresh(async () => {
        try {
          const data = await loadPlaces(apiPath);
          setState({ status: "success", data, error: null });
          setSelectedPlace(null);
          setOptimisticClusterPlaces(null);
        } catch (error) {
          lastViewportRequestPathRef.current = null;
          setOptimisticClusterPlaces(null);
          setState({
            status: "error",
            data: null,
            error:
              error instanceof Error
                ? error.message
                : "지도 결과를 불러오지 못했습니다.",
          });
        }
      });
    },
    [loadPlaces, searchParams],
  );

  const places = state.data?.items ?? [];
  const mapMarkers = useMemo<PlaceMapMarkerRecord[]>(() => {
    if (optimisticClusterPlaces?.length) {
      return optimisticClusterPlaces.map((place) => ({
        ...place,
        kind: "place",
      }));
    }

    return state.data?.mapMarkers ?? [];
  }, [optimisticClusterPlaces, state.data?.mapMarkers]);
  const displayedPlaces = useMemo(() => {
    if (!selectedPlace) {
      return places;
    }

    return places.map((place) =>
      place.id === selectedPlace.id ? selectedPlace : place,
    );
  }, [places, selectedPlace]);
  const trendingPlaces = useMemo(() => {
    if (query) {
      return [];
    }

    return [...displayedPlaces]
      .sort((left, right) => {
        if (right.likeCount !== left.likeCount) {
          return right.likeCount - left.likeCount;
        }

        return (
          new Date(right.lastPriceUpdatedAt).getTime() -
          new Date(left.lastPriceUpdatedAt).getTime()
        );
      })
      .slice(0, 6);
  }, [displayedPlaces, query]);
  const totalPlaceCount = state.status === "success" ? state.data.count : 0;
  const visiblePlaceCount =
    state.status === "success" ? state.data.returnedCount : 0;
  const isServerTrimmed =
    state.status === "success" && state.data.count > state.data.returnedCount;

  const updateBookmark = useCallback((placeId: string, bookmarked: boolean) => {
    setBookmarkedPlaceIds((current) => {
      const next = new Set(current);

      if (bookmarked) {
        next.add(placeId);
      } else {
        next.delete(placeId);
      }

      return next;
    });
  }, []);

  const updateReaction = useCallback((update: PlaceReactionUpdate) => {
    setSelectedPlace((current) =>
      current?.id === update.placeId
        ? {
            ...current,
            dislikeCount: update.dislikeCount,
            likeCount: update.likeCount,
            viewerReaction: update.viewerReaction,
          }
        : current,
    );
    setState((current) => {
      if (current.status !== "success") {
        return current;
      }

      return {
        ...current,
        data: {
          ...current.data,
          items: current.data.items.map((place) =>
            place.id === update.placeId
              ? {
                  ...place,
                  dislikeCount: update.dislikeCount,
                  likeCount: update.likeCount,
                  viewerReaction: update.viewerReaction,
                }
              : place,
          ),
        },
      };
    });
  }, []);
  const selectPlace = useCallback((place: PlacePreviewRecord) => {
    setSelectedPlace(place);
  }, []);
  const selectPlaceAndFocusMap = useCallback((place: PlacePreviewRecord) => {
    setSelectedPlace(place);
    window.requestAnimationFrame(() => {
      mapSectionRef.current?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    });
  }, []);
  const selectPlaceFromMobileList = useCallback((place: PlacePreviewRecord) => {
    setSelectedPlace(place);
    setMobileListMode("hidden");
  }, []);

  return (
    <main className="bg-[var(--altteul-bg-canvas)] px-3 pb-4 pt-3 sm:px-4 sm:py-4 lg:px-5 xl:px-6">
      <div className="mx-auto grid max-w-[112rem] gap-3">
        <section className="grid gap-3 border-b border-[var(--altteul-surface-border)] pb-3 sm:pb-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="altteulmap-section-kicker">탐색</p>
              <h1 className="mt-1 text-xl font-bold text-[var(--altteul-text-strong)] sm:text-[1.55rem]">
                가격이 보이는 동네 지도
              </h1>
              <p className="mt-1 hidden max-w-2xl text-sm leading-6 text-[var(--altteul-text-secondary)] sm:block">
                대표 가격, 검증 상태, 최근 갱신을 기준으로 지금 갈 곳을 빠르게 비교합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {query ? (
                <span className="altteulmap-badge px-3 py-1.5 text-xs font-medium">
                  검색: {query}
                </span>
              ) : null}
              {selectedCategory ? (
                <span className="altteulmap-badge px-3 py-1.5 text-xs font-medium">
                  업종: {selectedCategory.name}
                </span>
              ) : null}
              <span className="altteulmap-badge px-3 py-1.5 text-xs font-medium">
                {searchScope === "global" ? "전체 지역" : "현재 지도 범위"}
              </span>
            </div>
          </div>

          <form action="/" className="grid gap-2.5" data-testid="place-search-form">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <label className="grid min-w-0 gap-1.5">
                <span className="sr-only">장소나 서비스 검색</span>
                <input
                  type="search"
                  name="q"
                  defaultValue={query}
                  placeholder="무엇을 싸게 찾고 있나요? 예: 김밥, 세탁소, 프린트"
                  data-testid="place-search-input"
                  className="altteulmap-input h-11 px-4 text-sm"
                />
              </label>
              {activeCategory ? (
                <input type="hidden" name="category" value={activeCategory} />
              ) : null}
              <button
                type="submit"
                data-testid="place-search-submit"
                className="altteulmap-accent-solid altteulmap-button inline-flex h-11 items-center justify-center px-4 text-sm font-medium sm:px-5"
              >
                검색
              </button>
              {query ? (
                <Link
                  to={createMapHref({ category: activeCategory })}
                  className="altteulmap-button col-span-2 inline-flex h-11 items-center justify-center px-4 text-sm font-medium sm:col-auto"
                >
                  지우기
                </Link>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[var(--altteul-text-secondary)]">검색 범위</span>
                <div className="altteulmap-segmented w-fit">
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      value="viewport"
                      data-testid="search-scope-viewport"
                      defaultChecked={searchScope === "viewport"}
                      className="altteulmap-scope-input sr-only"
                    />
                    <span className={scopeChipClassName}>현재 지도 범위</span>
                  </label>
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      value="global"
                      data-testid="search-scope-global"
                      defaultChecked={searchScope === "global"}
                      className="altteulmap-scope-input sr-only"
                    />
                    <span className={scopeChipClassName}>전체 지역</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
              <RouteResetDetails
                key={`${activeCategory ?? "all"}:${query || "all"}:${searchScope}`}
                className="w-full overflow-hidden rounded-[0.85rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)]"
                summaryClassName="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-sm font-semibold text-[var(--altteul-text-primary)] [&::-webkit-details-marker]:hidden"
                summary={
                  <>
                    <div className="min-w-0">
                      <span>업종 필터</span>
                      <p className="mt-0.5 truncate text-xs font-normal text-[var(--altteul-text-tertiary)]">
                        {selectedCategory
                          ? `${selectedCategory.parentName} · ${selectedCategory.name}`
                          : "전체 업종"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-[var(--altteul-primary-text)]">
                      열기
                    </span>
                  </>
                }
                bodyClassName="border-t border-[var(--altteul-surface-border)] px-3.5 py-3.5"
              >
                <MapCategoryTray
                  activeCategory={activeCategory}
                  activeQuery={query || null}
                  activeSearchScope={searchScope}
                />
              </RouteResetDetails>

              <div className="hidden xl:flex xl:flex-wrap xl:justify-end xl:gap-2">
                <span className="altteulmap-badge whitespace-nowrap px-3 py-1.5 text-xs font-medium">
                  {searchScope === "global" ? "지도 밖 결과 포함" : "보이는 범위 중심"}
                </span>
                <span className="altteulmap-badge whitespace-nowrap px-3 py-1.5 text-xs font-medium">
                  가격 중심 카드
                </span>
              </div>
            </div>
          </form>
        </section>

        <section ref={mapSectionRef} className="relative">
          <NaverMapPanel
            initialBounds={state.data?.bounds ?? null}
            isLoading={state.status === "loading"}
            mapMarkers={mapMarkers}
            placeCount={state.data?.count ?? 0}
            refreshAction={
              searchScope === "viewport" && viewport
                ? {
                    isVisible: true,
                    isLoading: isManualRefreshPending,
                    onRefresh: refreshViewportPlaces,
                  }
                : null
            }
            selectedCategoryLabel={selectedCategoryLabel}
            activePlaceId={selectedPlace?.id ?? null}
            focusPlacesKey={
              query && searchScope === "global"
                ? `${query}:${activeCategory ?? "all"}`
                : null
            }
            onSelectPlace={selectPlace}
            onClusterFocusViewport={handleClusterFocusViewport}
            onViewportChange={handleViewportChange}
          />

          <aside className="hidden content-start gap-3 overflow-auto rounded-[0.875rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)] p-3 shadow-[var(--altteul-shadow-overlay)] xl:absolute xl:right-3 xl:top-3 xl:z-20 xl:grid xl:max-h-[calc(100%-1.5rem)] xl:w-[18rem] 2xl:w-[20rem]">
            {selectedPlace && isDesktopLayout ? (
              <PlaceDetailSheet
                bookmarked={bookmarkedPlaceIds.has(selectedPlace.id)}
                loginHref={loginHref}
                place={selectedPlace}
                onBookmarkUpdate={updateBookmark}
                onClose={() => setSelectedPlace(null)}
                onReactionUpdate={updateReaction}
              />
            ) : null}

            <div className="flex items-center justify-between border-b border-[var(--altteul-surface-border)] pb-3">
              <div>
                <p className="altteulmap-section-kicker text-[11px]">목록</p>
                <h2 className="mt-1 text-base font-semibold text-[var(--altteul-text-strong)]">
                  지도 결과
                </h2>
              </div>
              <span className="altteulmap-badge px-3 py-1 text-xs font-medium">
                {state.status === "success" ? state.data.count : "..."}곳
              </span>
            </div>

            {state.status === "success" && (isServerTrimmed || visiblePlaceCount > 0) ? (
              <div className="flex flex-wrap gap-2 text-xs text-[var(--altteul-text-secondary)]">
                {isServerTrimmed ? (
                  <span className="altteulmap-badge px-2.5 py-1 text-[11px] font-medium">
                    총 {totalPlaceCount}곳 중 {visiblePlaceCount}곳 먼저 표시
                  </span>
                ) : null}
                <span className="altteulmap-badge px-2.5 py-1 text-[11px] font-medium">
                  {searchScope === "global" ? "전체 지역 검색" : "지도 영역 검색"}
                </span>
              </div>
            ) : null}

            {state.status === "loading" ? (
              <div className="rounded-[0.85rem] border border-dashed border-[var(--altteul-surface-border-strong)] bg-[var(--altteul-bg-surface)] p-6 text-center text-sm text-[var(--altteul-text-tertiary)]">
                지도 결과를 불러오는 중입니다.
              </div>
            ) : null}
            {state.status === "error" ? (
              <div className="rounded-[0.85rem] border border-[var(--altteul-warning-border)] bg-[var(--altteul-warning-soft)] px-4 py-3 text-sm text-[var(--altteul-warning-text)]">
                {state.error}
              </div>
            ) : null}
            {state.status === "success" && places.length === 0 ? (
              <div className="rounded-[0.85rem] border border-dashed border-[var(--altteul-surface-border-strong)] bg-[var(--altteul-bg-surface)] p-6 text-center text-sm leading-7 text-[var(--altteul-text-tertiary)]">
                조건에 맞는 장소가 없습니다.
              </div>
            ) : null}
            {state.status === "success" && places.length > 0 ? (
              <div className="grid gap-3 pr-1" data-testid="place-list">
                {displayedPlaces.map((place) => (
                  <PlaceCard
                    key={place.id}
                    bookmarked={bookmarkedPlaceIds.has(place.id)}
                    isSelected={selectedPlace?.id === place.id}
                    loginHref={loginHref}
                    place={place}
                    onBookmarkUpdate={updateBookmark}
                onSelect={selectPlace}
                  />
                ))}
              </div>
            ) : null}
          </aside>
        </section>

        {!selectedPlace ? (
          <MobilePlaceListSheet
            bookmarkedPlaceIds={bookmarkedPlaceIds}
            loginHref={loginHref}
            mode={mobileListMode}
            onBookmarkUpdate={updateBookmark}
            onModeChange={setMobileListMode}
            onSelectPlace={selectPlaceFromMobileList}
            places={displayedPlaces}
            state={state}
            totalPlaceCount={state.status === "success" ? state.data.count : 0}
          />
        ) : null}

        {selectedPlace && !isDesktopLayout ? (
          <div className="xl:hidden">
            <PlaceDetailSheet
              bookmarked={bookmarkedPlaceIds.has(selectedPlace.id)}
              loginHref={loginHref}
              place={selectedPlace}
              onBookmarkUpdate={updateBookmark}
              onClose={() => setSelectedPlace(null)}
              onReactionUpdate={updateReaction}
            />
          </div>
        ) : null}

        <TrendingPlacesSection
          items={trendingPlaces}
          onSelectPlace={selectPlaceAndFocusMap}
          selectedCategoryLabel={selectedCategoryLabel}
        />
      </div>
    </main>
  );
}
