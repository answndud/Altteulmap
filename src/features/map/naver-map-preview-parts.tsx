import type {
  ClusterDisplayMarker,
  MapDisplayMarker,
} from "@/features/map/naver-map-display-markers";
import {
  formatMarkerCount,
  getClusterMarkerVisual,
  getPlaceMarkerVisual,
} from "@/features/map/naver-map-marker-visuals";
import {
  getLocalFallbackTiles,
  LOCAL_FALLBACK_TILE_SIZE,
} from "@/features/map/naver-map-local-tiles";
import type { PlacePreviewRecord } from "@/features/places/types";

export type PreviewMarkerDisplayItem = {
  marker: MapDisplayMarker;
  top: number;
  left: number;
  zIndex: number;
};

function getClusterMarkerSizeClass(placeCount: number) {
  if (placeCount >= 100) {
    return "altteulmap-cluster-marker--lg";
  }

  if (placeCount >= 20) {
    return "altteulmap-cluster-marker--md";
  }

  return "altteulmap-cluster-marker--sm";
}

function getPlaceMarkerToneClass(
  marker: Extract<MapDisplayMarker, { kind: "place" }>,
) {
  if (marker.isActive) {
    return "altteulmap-marker-icon--active";
  }

  return marker.place.verificationStatus === "verified"
    ? "altteulmap-marker-icon--verified"
    : "altteulmap-marker-icon--unverified";
}

export function LocalFallbackTileLayer({
  center,
  zoom,
  viewportSize,
}: {
  center: { latitude: number; longitude: number };
  zoom: number;
  viewportSize: { width: number; height: number };
}) {
  const tiles = getLocalFallbackTiles(center, zoom);
  const viewBoxWidth = Math.max(1, viewportSize.width);
  const viewBoxHeight = Math.max(1, viewportSize.height);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--altteul-bg-surface)]">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full select-none"
        preserveAspectRatio="none"
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      >
        {tiles.map((tile) => (
          <image
            key={tile.key}
            href={tile.url}
            height={LOCAL_FALLBACK_TILE_SIZE}
            preserveAspectRatio="none"
            width={LOCAL_FALLBACK_TILE_SIZE}
            x={tile.left}
            y={tile.top}
          />
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 bg-white/10" />
    </div>
  );
}

export function PreviewMarkerLayer({
  markerCanvasHeight,
  markerCanvasWidth,
  markerDisplayItems,
  onActivateCluster,
  onSelectPlace,
}: {
  markerCanvasHeight: number;
  markerCanvasWidth: number;
  markerDisplayItems: PreviewMarkerDisplayItem[];
  onActivateCluster?: (marker: ClusterDisplayMarker) => void;
  onSelectPlace: (place: PlacePreviewRecord) => void;
}) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      preserveAspectRatio="none"
      viewBox={`0 0 ${markerCanvasWidth} ${markerCanvasHeight}`}
    >
      {markerDisplayItems.map(({ left, marker, top }) => {
        if (marker.kind === "cluster") {
          const clusterSizeClass = getClusterMarkerSizeClass(marker.placeCount);
          const clusterVisual = getClusterMarkerVisual(marker.placeCount);

          return (
            <foreignObject
              key={marker.id}
              height={clusterVisual.hitSize}
              width={clusterVisual.hitSize}
              x={left - clusterVisual.hitSize / 2}
              y={top - clusterVisual.hitSize / 2}
            >
              <button
                type="button"
                data-testid={`map-preview-marker-${marker.id}`}
                data-marker-kind="cluster"
                onClick={() => onActivateCluster?.(marker)}
                className={`altteulmap-cluster-marker pointer-events-auto h-full w-full transition-transform hover:scale-[1.03] ${clusterSizeClass}`}
              >
                <span className="altteulmap-cluster-marker__badge">
                  {formatMarkerCount(marker.placeCount)}
                </span>
              </button>
            </foreignObject>
          );
        }

        const placeVisual = getPlaceMarkerVisual(marker.place, marker.isActive);
        const placeToneClass = getPlaceMarkerToneClass(marker);

        return (
          <foreignObject
            key={marker.id}
            height={placeVisual.canvasHeight}
            width={placeVisual.canvasWidth}
            x={left - placeVisual.canvasWidth / 2 + marker.offsetX}
            y={top - placeVisual.canvasHeight + marker.offsetY}
          >
            <button
              type="button"
              data-testid={`map-preview-marker-${marker.id}`}
              data-marker-kind="place"
              onClick={() => onSelectPlace(marker.place)}
              aria-label={`${marker.place.name} ${placeVisual.label}`}
              className="pointer-events-auto h-full w-full transition-transform hover:scale-[1.035]"
            >
              <span className={`altteulmap-marker-icon ${placeToneClass}`}>
                <span
                  aria-hidden="true"
                  className="altteulmap-marker-icon__tail"
                />
                <span className="altteulmap-marker-icon__label">
                  {placeVisual.label}
                </span>
              </span>
            </button>
          </foreignObject>
        );
      })}
    </svg>
  );
}
