import { useCallback, useEffect, useState, useTransition } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { getCategoryBySlug, categoryOptions } from "@/features/categories/catalog";
import { NaverMapPanel } from "@/features/map/naver-map-panel";
import type { MapViewport } from "@/features/map/naver-map-sdk";
import type {
  PlaceMapMarkerMode,
  PlaceMapMarkerRecord,
  PlaceBounds,
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

type LoadState =
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: MapPlacesResponse; error: null }
  | { status: "error"; data: null; error: string };

function formatKrw(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
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
    apiParams.set("minLat", String(viewport.bounds.minLat));
    apiParams.set("maxLat", String(viewport.bounds.maxLat));
    apiParams.set("minLng", String(viewport.bounds.minLng));
    apiParams.set("maxLng", String(viewport.bounds.maxLng));
    apiParams.set("zoom", String(viewport.zoom));
  }

  const queryString = apiParams.toString();

  return queryString ? `/api/places/map?${queryString}` : "/api/places/map";
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

function PlaceCard({
  place,
  isSelected,
  onSelect,
}: {
  place: PlacePreviewRecord;
  isSelected: boolean;
  onSelect: (place: PlacePreviewRecord) => void;
}) {
  const category = getCategoryBySlug(place.categorySlug);
  const verificationLabel =
    place.verificationStatus === "verified" ? "검증됨" : "미검증";

  return (
    <article
      className={`rounded-[1rem] border p-4 text-left shadow-sm transition ${
        isSelected
          ? "border-[var(--altteul-accent-border)] bg-[var(--altteul-accent-soft)]"
          : "border-stone-200 bg-white hover:border-[var(--altteul-accent-border)] hover:bg-[var(--altteul-surface-fill-hover)]"
      }`}
      data-testid={`vite-place-list-item-${place.id}`}
    >
      <button
        type="button"
        onClick={() => onSelect(place)}
        className="block w-full text-left"
        aria-pressed={isSelected}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase text-stone-500">
              {place.representativePriceLabel || "대표 가격"}
            </p>
            <p className="altteulmap-price-number mt-1 text-2xl">
              {formatKrw(place.representativePriceAmount)}원
            </p>
          </div>
          <span className="altteulmap-badge shrink-0 px-2.5 py-1 text-[11px] font-medium">
            {verificationLabel}
          </span>
        </div>
        <h2 className="mt-3 truncate text-base font-semibold text-stone-950">
          {place.name}
        </h2>
        <p className="mt-1 truncate text-xs text-stone-600">
          {[category?.name ?? "기타", place.district].join(" · ")}
        </p>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-stone-600">
          {place.description || place.note || place.address}
        </p>
      </button>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <span className="altteulmap-badge px-2.5 py-1 text-[11px] font-medium">
            갱신 {place.lastPriceUpdatedAt}
          </span>
          <span className="altteulmap-badge px-2.5 py-1 text-[11px] font-medium">
            좋아요 {place.likeCount}
          </span>
        </div>
        <Link
          to={`/place/${encodeURIComponent(place.id)}`}
          className="altteulmap-button inline-flex px-3 py-1.5 text-xs font-medium text-stone-700"
        >
          상세
        </Link>
      </div>
    </article>
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
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [isRefreshingViewport, startViewportRefresh] = useTransition();
  const query = searchParams.get("q")?.trim() || "";
  const activeCategory = searchParams.get("category");
  const searchScope: PlaceSearchScope =
    query && searchParams.get("scope") === "global" ? "global" : "viewport";
  const selectedCategory = getCategoryBySlug(activeCategory);
  const selectedCategoryLabel = selectedCategory?.name ?? null;

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

    loadPlaces(buildMapApiPath(searchParams), controller.signal)
      .then((data) => {
        setSelectedPlace(null);
        setViewport(null);
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
  }, [loadPlaces, searchParams]);

  const refreshViewportPlaces = useCallback(() => {
    if (!viewport) {
      return;
    }

    startViewportRefresh(async () => {
      try {
        const data = await loadPlaces(buildMapApiPath(searchParams, viewport));
        setState({ status: "success", data, error: null });
        setSelectedPlace(null);
      } catch (error) {
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
  }, [loadPlaces, searchParams, viewport]);

  const places = state.data?.items ?? [];
  const mapMarkers = state.data?.mapMarkers ?? [];

  return (
    <main className="bg-[var(--altteul-bg-canvas)] px-3 pb-4 pt-3 sm:px-4 sm:py-4 lg:px-5 xl:px-6">
      <div className="mx-auto grid max-w-[96rem] gap-3">
        <section className="grid gap-3 border-b border-stone-200/70 pb-3 sm:pb-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="altteulmap-section-kicker">탐색</p>
              <h1 className="mt-1 text-xl font-semibold text-stone-950 sm:text-[1.55rem]">
                가격이 보이는 동네 지도
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-600">
                Vite SPA 이관 경로에서 기존 `/api/places/map` contract로 결과를 불러옵니다.
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
            </div>
          </div>

          <form action="/" className="grid gap-2.5" data-testid="vite-place-search-form">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="김밥, 세탁소, 프린트, 약국"
                data-testid="vite-place-search-input"
                className="altteulmap-input h-11 px-4 text-sm"
              />
              <input type="hidden" name="scope" value="global" />
              {activeCategory ? (
                <input type="hidden" name="category" value={activeCategory} />
              ) : null}
              <button
                type="submit"
                className="altteulmap-accent-solid altteulmap-button inline-flex h-11 items-center justify-center px-4 text-sm font-medium sm:px-5"
              >
                검색
              </button>
              {query ? (
                <Link
                  to={createMapHref({ category: activeCategory })}
                  className="altteulmap-button col-span-2 inline-flex h-11 items-center justify-center px-4 text-sm font-medium text-stone-700 sm:col-auto"
                >
                  지우기
                </Link>
              ) : null}
            </div>

            <div className="altteulmap-scroll-row">
              <Link
                to={createMapHref({ query, scope: "global" })}
                className={`altteulmap-chip whitespace-nowrap border px-3 py-2 text-xs font-medium ${
                  activeCategory ? "border-stone-200 text-stone-600" : "altteulmap-accent-chip"
                }`}
              >
                전체
              </Link>
              {categoryOptions.map((category) => (
                <Link
                  key={category.slug}
                  to={createMapHref({
                    category: category.slug,
                    query,
                    scope: "global",
                  })}
                  className={`altteulmap-chip whitespace-nowrap border px-3 py-2 text-xs font-medium ${
                    activeCategory === category.slug
                      ? "altteulmap-accent-chip"
                      : "border-stone-200 text-stone-600"
                  }`}
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </form>
        </section>

        <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <NaverMapPanel
            initialBounds={state.data?.bounds ?? null}
            isLoading={
              state.status === "loading" ||
              (isRefreshingViewport && places.length === 0)
            }
            mapMarkers={mapMarkers}
            placeCount={state.data?.count ?? 0}
            refreshAction={
              searchScope === "viewport" && viewport
                ? {
                    isVisible: true,
                    isLoading: isRefreshingViewport,
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
            onSelectPlace={setSelectedPlace}
            onViewportChange={setViewport}
          />

          <aside className="grid content-start gap-3">
            {selectedPlace ? (
              <div className="rounded-[1rem] border border-[var(--altteul-accent-border)] bg-[var(--altteul-accent-soft)] px-4 py-3 text-sm text-[var(--altteul-accent-text)]">
                <p className="font-medium text-[var(--altteul-accent-ink)]">
                  선택한 장소: {selectedPlace.name}
                </p>
                <Link
                  to={`/place/${encodeURIComponent(selectedPlace.id)}`}
                  className="mt-2 inline-flex text-xs font-medium underline underline-offset-4"
                >
                  상세 정보 보기
                </Link>
              </div>
            ) : null}

            <div className="flex items-center justify-between border-b border-stone-200/80 pb-3">
              <div>
                <p className="altteulmap-section-kicker text-[11px]">목록</p>
                <h2 className="mt-1 text-base font-semibold text-stone-900">
                  지도 결과
                </h2>
              </div>
              <span className="altteulmap-badge px-3 py-1 text-xs font-medium">
                {state.status === "success" ? state.data.count : "..."}곳
              </span>
            </div>

            {state.status === "loading" ? (
              <div className="rounded-[1rem] border border-dashed border-stone-300 bg-white p-6 text-center text-sm text-stone-500">
                지도 결과를 불러오는 중입니다.
              </div>
            ) : null}
            {state.status === "error" ? (
              <div className="rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {state.error}
              </div>
            ) : null}
            {state.status === "success" && places.length === 0 ? (
              <div className="rounded-[1rem] border border-dashed border-stone-300 bg-white p-6 text-center text-sm leading-7 text-stone-500">
                조건에 맞는 장소가 없습니다.
              </div>
            ) : null}
            {state.status === "success" && places.length > 0 ? (
              <div className="grid max-h-[40rem] gap-3 overflow-auto pr-1" data-testid="vite-place-list">
                {places.map((place) => (
                  <PlaceCard
                    key={place.id}
                    place={place}
                    isSelected={selectedPlace?.id === place.id}
                    onSelect={setSelectedPlace}
                  />
                ))}
              </div>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
