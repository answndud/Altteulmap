import { getCategoryBySlug } from "@/features/categories/catalog";
import type { getLoadedNaverMapSdk } from "@/features/map/naver-map-sdk";

type PlaceMarkerGroupKey =
  | "food"
  | "life-services"
  | "shopping"
  | "health"
  | "study-work"
  | "fallback";

type PlaceMarkerTheme = {
  fill: string;
  activeFill: string;
  stroke: string;
  activeStroke: string;
  coreRing: string;
  coreDot: string;
};

const PLACE_MARKER_THEMES: Record<PlaceMarkerGroupKey, PlaceMarkerTheme> = {
  food: {
    fill: "#dc603e",
    activeFill: "#c44d2d",
    stroke: "rgba(126, 47, 25, 0.24)",
    activeStroke: "rgba(112, 38, 19, 0.32)",
    coreRing: "#8e3821",
    coreDot: "#dc603e",
  },
  "life-services": {
    fill: "#4f78bf",
    activeFill: "#3e61a6",
    stroke: "rgba(40, 65, 109, 0.22)",
    activeStroke: "rgba(31, 53, 92, 0.3)",
    coreRing: "#35558f",
    coreDot: "#4f78bf",
  },
  shopping: {
    fill: "#b25a72",
    activeFill: "#95445a",
    stroke: "rgba(106, 47, 64, 0.22)",
    activeStroke: "rgba(88, 35, 50, 0.3)",
    coreRing: "#7a3849",
    coreDot: "#b25a72",
  },
  health: {
    fill: "#2f8d69",
    activeFill: "#1f7454",
    stroke: "rgba(24, 87, 63, 0.22)",
    activeStroke: "rgba(17, 71, 50, 0.3)",
    coreRing: "#195a41",
    coreDot: "#2f8d69",
  },
  "study-work": {
    fill: "#4f647d",
    activeFill: "#3b5067",
    stroke: "rgba(43, 58, 74, 0.22)",
    activeStroke: "rgba(34, 46, 60, 0.3)",
    coreRing: "#314457",
    coreDot: "#4f647d",
  },
  fallback: {
    fill: "#9a613f",
    activeFill: "#7d4a2b",
    stroke: "rgba(95, 56, 34, 0.22)",
    activeStroke: "rgba(79, 44, 24, 0.3)",
    coreRing: "#693b21",
    coreDot: "#9a613f",
  },
};

export const CLUSTER_MARKER_THEME = {
  background:
    "linear-gradient(180deg, rgba(228, 236, 247, 0.97) 0%, rgba(212, 224, 240, 0.95) 100%)",
  border: "rgba(88, 110, 143, 0.24)",
  ring: "rgba(183, 198, 223, 0.94)",
  text: "#334155",
  shadow: "0 7px 16px rgba(71, 85, 105, 0.14)",
} as const;

export function formatMarkerCount(count: number) {
  return new Intl.NumberFormat("ko-KR").format(count);
}

function getPlaceMarkerGroupKey(
  categorySlug: string | null | undefined,
): PlaceMarkerGroupKey {
  const parentSlug = getCategoryBySlug(categorySlug)?.parentSlug;

  switch (parentSlug) {
    case "food":
    case "life-services":
    case "shopping":
    case "health":
    case "study-work":
      return parentSlug;
    default:
      return "fallback";
  }
}

export function getPlaceMarkerVisual(
  categorySlug: string | null | undefined,
  isActive: boolean,
) {
  const theme = PLACE_MARKER_THEMES[getPlaceMarkerGroupKey(categorySlug)];

  return {
    canvasWidth: isActive ? 48 : 44,
    canvasHeight: isActive ? 58 : 54,
    pinSize: isActive ? 34 : 30,
    coreSize: isActive ? 16 : 14,
    dotSize: isActive ? 6 : 5,
    fill: isActive ? theme.activeFill : theme.fill,
    stroke: isActive ? theme.activeStroke : theme.stroke,
    coreRing: theme.coreRing,
    coreDot: theme.coreDot,
    outline: "rgba(255, 255, 255, 0.98)",
    shadow: `0 0 0 3px rgba(255,255,255,0.94), 0 0 0 4.5px ${
      isActive ? theme.activeStroke : theme.stroke
    }, 0 ${isActive ? 18 : 14}px ${isActive ? 32 : 26}px rgba(15,23,42,${
      isActive ? "0.26" : "0.2"
    })`,
  };
}

export function getClusterMarkerVisual(placeCount: number) {
  if (placeCount >= 100) {
    return {
      hitSize: 52,
      badgeSize: 38,
      fontSize: 12,
      ringInset: 2.5,
    };
  }

  if (placeCount >= 20) {
    return {
      hitSize: 46,
      badgeSize: 34,
      fontSize: 11,
      ringInset: 2.5,
    };
  }

  return {
    hitSize: 40,
    badgeSize: 30,
    fontSize: 10,
    ringInset: 2,
  };
}

function createPlaceMarkerIconHtml(
  categorySlug: string | null | undefined,
  isActive: boolean,
) {
  const visual = getPlaceMarkerVisual(categorySlug, isActive);

  return `
    <div style="width:${visual.canvasWidth}px;height:${visual.canvasHeight}px;display:flex;align-items:flex-end;justify-content:center;">
      <span style="position:relative;display:block;width:${visual.pinSize}px;height:${visual.pinSize}px;border-radius:${visual.pinSize}px ${visual.pinSize}px ${visual.pinSize}px 0;background:${visual.fill};border:2px solid ${visual.outline};box-shadow:${visual.shadow};transform:rotate(-45deg);">
        <span style="position:absolute;left:50%;top:50%;width:${visual.coreSize}px;height:${visual.coreSize}px;border-radius:999px;background:#ffffff;border:2px solid ${visual.coreRing};transform:translate(-50%,-50%) rotate(45deg);">
          <span style="position:absolute;left:50%;top:50%;width:${visual.dotSize}px;height:${visual.dotSize}px;border-radius:999px;background:${visual.coreDot};transform:translate(-50%,-50%);"></span>
        </span>
      </span>
    </div>
  `;
}

export function createMapMarkerIcon(
  categorySlug: string | null | undefined,
  isActive: boolean,
  naver: ReturnType<typeof getLoadedNaverMapSdk>,
) {
  const Point = naver?.maps.Point;
  const Size = naver?.maps.Size;

  if (!Point || !Size) {
    return undefined;
  }

  const visual = getPlaceMarkerVisual(categorySlug, isActive);

  return {
    content: createPlaceMarkerIconHtml(categorySlug, isActive),
    size: new Size(visual.canvasWidth, visual.canvasHeight),
    anchor: new Point(visual.canvasWidth / 2, visual.canvasHeight),
  };
}

function createClusterIconHtml(placeCount: number) {
  const visual = getClusterMarkerVisual(placeCount);

  return `
    <div style="width:${visual.hitSize}px;height:${visual.hitSize}px;display:flex;align-items:center;justify-content:center;">
      <span style="display:flex;align-items:center;justify-content:center;width:${visual.badgeSize}px;height:${visual.badgeSize}px;border-radius:999px;background:${CLUSTER_MARKER_THEME.background};border:1px solid ${CLUSTER_MARKER_THEME.border};box-shadow:${CLUSTER_MARKER_THEME.shadow}, inset 0 0 0 ${visual.ringInset}px ${CLUSTER_MARKER_THEME.ring};color:${CLUSTER_MARKER_THEME.text};font-size:${visual.fontSize}px;font-weight:600;line-height:1;letter-spacing:0;font-variant-numeric:tabular-nums;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);">
        ${formatMarkerCount(placeCount)}
      </span>
    </div>
  `;
}

export function createClusterMarkerIcon(
  placeCount: number,
  naver: ReturnType<typeof getLoadedNaverMapSdk>,
) {
  const Point = naver?.maps.Point;
  const Size = naver?.maps.Size;

  if (!Point || !Size) {
    return undefined;
  }

  const visual = getClusterMarkerVisual(placeCount);

  return {
    content: createClusterIconHtml(placeCount),
    size: new Size(visual.hitSize, visual.hitSize),
    anchor: new Point(visual.hitSize / 2, visual.hitSize / 2),
  };
}
