import type { getLoadedNaverMapSdk } from "@/features/map/naver-map-sdk";
import type { PlacePreviewRecord } from "@/features/places/types";

type PlaceMarkerPriceInput = Pick<
  PlacePreviewRecord,
  "representativePriceAmount" | "verificationStatus"
>;

type PlaceMarkerTone = {
  background: string;
  border: string;
  text: string;
  tailBackground: string;
  tailBorder: string;
};

const VERIFIED_PRICE_TONE: PlaceMarkerTone = {
  background: "rgba(255, 253, 249, 0.98)",
  border: "rgba(37, 99, 235, 0.52)",
  text: "#162033",
  tailBackground: "rgba(255, 253, 249, 0.98)",
  tailBorder: "rgba(37, 99, 235, 0.52)",
};

const UNVERIFIED_PRICE_TONE: PlaceMarkerTone = {
  background: "rgba(255, 253, 249, 0.98)",
  border: "rgba(181, 90, 43, 0.5)",
  text: "#2a1d15",
  tailBackground: "rgba(255, 253, 249, 0.98)",
  tailBorder: "rgba(181, 90, 43, 0.5)",
};

const ACTIVE_PRICE_TONE: PlaceMarkerTone = {
  background: "#1f5fbf",
  border: "rgba(24, 70, 145, 0.72)",
  text: "#fffdf9",
  tailBackground: "#1f5fbf",
  tailBorder: "rgba(24, 70, 145, 0.72)",
};

export const CLUSTER_MARKER_THEME = {
  background:
    "linear-gradient(180deg, rgba(239, 246, 255, 0.98) 0%, rgba(219, 234, 254, 0.96) 100%)",
  border: "rgba(37, 99, 235, 0.22)",
  ring: "rgba(191, 219, 254, 0.94)",
  text: "#1e40af",
  shadow: "0 7px 16px rgba(15, 23, 42, 0.14)",
} as const;

export function formatMarkerCount(count: number) {
  return new Intl.NumberFormat("ko-KR").format(count);
}

export function formatMarkerPrice(amount: number) {
  return `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getPlaceMarkerVisual(
  place: PlaceMarkerPriceInput,
  isActive: boolean,
) {
  const label = formatMarkerPrice(place.representativePriceAmount);
  const tone = isActive
    ? ACTIVE_PRICE_TONE
    : place.verificationStatus === "verified"
      ? VERIFIED_PRICE_TONE
      : UNVERIFIED_PRICE_TONE;
  const labelWidth = label.length * (isActive ? 9.3 : 8.9) + 24;
  const width = Math.ceil(Math.max(isActive ? 78 : 72, labelWidth));
  const height = isActive ? 34 : 31;
  const tailSize = isActive ? 9 : 8;

  return {
    label,
    canvasWidth: width + 16,
    canvasHeight: height + tailSize + 11,
    width,
    height,
    tailSize,
    fontSize: isActive ? 14 : 13,
    fontWeight: isActive ? 800 : 750,
    background: tone.background,
    border: tone.border,
    text: tone.text,
    tailBackground: tone.tailBackground,
    tailBorder: tone.tailBorder,
    shadow: isActive
      ? "0 0 0 3px rgba(255, 253, 249, 0.94), 0 12px 26px rgba(15, 23, 42, 0.24)"
      : "0 0 0 2px rgba(255, 253, 249, 0.9), 0 8px 18px rgba(15, 23, 42, 0.17)",
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
  place: PlaceMarkerPriceInput,
  isActive: boolean,
) {
  const safeLabel = escapeHtml(formatMarkerPrice(place.representativePriceAmount));
  const toneClass = isActive
    ? "altteulmap-marker-icon--active"
    : place.verificationStatus === "verified"
      ? "altteulmap-marker-icon--verified"
      : "altteulmap-marker-icon--unverified";

  return `
    <div class="altteulmap-marker-icon ${toneClass}">
      <span class="altteulmap-marker-icon__tail"></span>
      <span class="altteulmap-marker-icon__label">
        ${safeLabel}
      </span>
    </div>
  `;
}

export function createMapMarkerIcon(
  place: PlaceMarkerPriceInput,
  isActive: boolean,
  naver: ReturnType<typeof getLoadedNaverMapSdk>,
  offset = { x: 0, y: 0 },
) {
  const Point = naver?.maps.Point;
  const Size = naver?.maps.Size;

  if (!Point || !Size) {
    return undefined;
  }

  const visual = getPlaceMarkerVisual(place, isActive);

  return {
    content: createPlaceMarkerIconHtml(place, isActive),
    size: new Size(visual.canvasWidth, visual.canvasHeight),
    anchor: new Point(
      visual.canvasWidth / 2 - offset.x,
      visual.canvasHeight - offset.y,
    ),
  };
}

function createClusterIconHtml(placeCount: number) {
  const sizeClass =
    placeCount >= 100
      ? "altteulmap-cluster-marker--lg"
      : placeCount >= 20
        ? "altteulmap-cluster-marker--md"
        : "altteulmap-cluster-marker--sm";

  return `
    <div class="altteulmap-cluster-marker ${sizeClass}">
      <span class="altteulmap-cluster-marker__badge">
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
