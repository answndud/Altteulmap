import {
  getViewportFromMap,
  type MapViewport,
  type NaverMapInstance,
} from "@/features/map/naver-map-sdk";
import { serializeViewport } from "@/features/map/naver-map-display-markers";

type EmitNaverMapViewportChangeOptions = {
  lastViewportKeyRef: { current: string | null };
  map: NaverMapInstance | null;
  onViewportChange?: (viewport: MapViewport) => void;
};

export function emitNaverMapViewportChange({
  lastViewportKeyRef,
  map,
  onViewportChange,
}: EmitNaverMapViewportChangeOptions) {
  const viewport = getViewportFromMap(map);

  if (!viewport) {
    return null;
  }

  const nextKey = serializeViewport(viewport);

  if (lastViewportKeyRef.current === nextKey) {
    return viewport;
  }

  lastViewportKeyRef.current = nextKey;
  onViewportChange?.(viewport);
  return viewport;
}
