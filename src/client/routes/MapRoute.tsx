import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Link, useSearchParams } from "react-router-dom";

import { ViteBookmarkToggleButton } from "@/client/components/ViteBookmarkToggleButton";
import { VitePlaceReactionButtons } from "@/client/components/VitePlaceReactionButtons";
import { formatKrw } from "@/client/features/map/map-format";
import { getCategoryBySlug } from "@/features/categories/catalog";
import {
  buildMapApiPath,
  CLUSTER_FOCUS_VIEWPORT_LOCK_MS,
  createBootstrapViewport,
  createMapHref,
  VIEWPORT_FETCH_DEBOUNCE_MS,
} from "@/client/features/map/map-query";
import { MapCategoryTray } from "@/client/features/map/MapCategoryTray";
import {
  MobilePlaceListSheet,
  type MobileSheetMode,
} from "@/client/features/map/MobilePlaceListSheet";
import { PlaceCard } from "@/client/features/map/PlaceCard";
import { TrendingPlacesSection } from "@/client/features/map/TrendingPlacesSection";
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

function getLoginHref() {
  const callbackUrl =
    typeof window === "undefined"
      ? "/"
      : `${window.location.pathname}${window.location.search}`;

  return `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
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
        if (lastViewportRequestPathRef.current !== initialApiPath) {
          return;
        }

        setSelectedPlace(null);
        setOptimisticClusterPlaces(null);
        setState({ status: "success", data, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (lastViewportRequestPathRef.current !== initialApiPath) {
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
