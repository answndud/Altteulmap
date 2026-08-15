import type { PlacePreviewRecord, PlaceSearchScope } from "@/features/places/types";

import { PlaceCard } from "./PlaceCard";
import {
  PlaceDetailSheet,
  type PlaceReactionUpdate,
} from "./PlaceDetailSheet";

type MapDesktopResultsState =
  | { status: "loading"; error: null }
  | { status: "success"; error: null }
  | { status: "error"; error: string };

export function MapDesktopResultsRail({
  bookmarkedPlaceIds,
  displayedPlaces,
  isDesktopLayout,
  isServerTrimmed,
  loginHref,
  onBookmarkUpdate,
  onCloseSelectedPlace,
  onReactionUpdate,
  onSelectPlace,
  placesLength,
  searchScope,
  selectedPlace,
  state,
  totalPlaceCount,
  visiblePlaceCount,
}: {
  bookmarkedPlaceIds: Set<string>;
  displayedPlaces: PlacePreviewRecord[];
  isDesktopLayout: boolean;
  isServerTrimmed: boolean;
  loginHref: string;
  onBookmarkUpdate: (placeId: string, bookmarked: boolean) => void;
  onCloseSelectedPlace: () => void;
  onReactionUpdate: (update: PlaceReactionUpdate) => void;
  onSelectPlace: (place: PlacePreviewRecord) => void;
  placesLength: number;
  searchScope: PlaceSearchScope;
  selectedPlace: PlacePreviewRecord | null;
  state: MapDesktopResultsState;
  totalPlaceCount: number;
  visiblePlaceCount: number;
}) {
  return (
    <aside className="hidden content-start gap-3 overflow-auto rounded-[0.875rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)] p-3 shadow-[var(--altteul-shadow-overlay)] xl:absolute xl:right-3 xl:top-3 xl:z-20 xl:grid xl:max-h-[calc(100%-1.5rem)] xl:w-[18rem] 2xl:w-[20rem]">
      {selectedPlace && isDesktopLayout ? (
        <PlaceDetailSheet
          bookmarked={bookmarkedPlaceIds.has(selectedPlace.id)}
          loginHref={loginHref}
          place={selectedPlace}
          onBookmarkUpdate={onBookmarkUpdate}
          onClose={onCloseSelectedPlace}
          onReactionUpdate={onReactionUpdate}
        />
      ) : null}

      <div className="flex items-center justify-between border-b border-[var(--altteul-surface-border)] pb-3">
        <div>
          <p className="altteulmap-section-kicker text-[11px]">목록</p>
          <h2 className="mt-1 text-base font-semibold text-[var(--altteul-text-strong)]">
            장소 목록
          </h2>
        </div>
        <span className="altteulmap-badge px-3 py-1 text-xs font-medium">
          {state.status === "success" ? totalPlaceCount : "..."}곳
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
          장소 목록을 불러오는 중입니다.
        </div>
      ) : null}
      {state.status === "error" && placesLength === 0 ? (
        <div className="rounded-[0.85rem] border border-[var(--altteul-warning-border)] bg-[var(--altteul-warning-soft)] px-4 py-3 text-sm text-[var(--altteul-warning-text)]">
          {state.error}
        </div>
      ) : null}
      {state.status === "error" && placesLength > 0 ? (
        <p className="px-1 text-xs text-[var(--altteul-text-tertiary)]">
          새 장소를 불러오지 못해 이전 목록을 표시하고 있습니다.
        </p>
      ) : null}
      {state.status === "success" && placesLength === 0 ? (
        <div className="rounded-[0.85rem] border border-dashed border-[var(--altteul-surface-border-strong)] bg-[var(--altteul-bg-surface)] p-6 text-center text-sm leading-7 text-[var(--altteul-text-tertiary)]">
          조건에 맞는 장소가 없습니다.
        </div>
      ) : null}
      {placesLength > 0 ? (
        <div className="grid gap-3 pr-1" data-testid="place-list">
          {displayedPlaces.map((place) => (
            <PlaceCard
              key={place.id}
              bookmarked={bookmarkedPlaceIds.has(place.id)}
              isSelected={selectedPlace?.id === place.id}
              loginHref={loginHref}
              place={place}
              onBookmarkUpdate={onBookmarkUpdate}
              onSelect={onSelectPlace}
            />
          ))}
        </div>
      ) : null}
    </aside>
  );
}
