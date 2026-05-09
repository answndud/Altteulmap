import {
  createClusterMarkerIcon,
  createMapMarkerIcon,
  formatMarkerCount,
} from "@/features/map/naver-map-marker-visuals";
import type {
  MapDisplayMarker,
  ClusterDisplayMarker,
} from "@/features/map/naver-map-display-markers";
import type {
  NaverMapInstance,
  NaverMapsSdk,
  NaverMarkerInstance,
} from "@/features/map/naver-map-sdk";
import type { PlacePreviewRecord } from "@/features/places/types";

type RenderNaverMapMarkersOptions = {
  displayMarkers: MapDisplayMarker[];
  map: NaverMapInstance;
  maps: NaverMapsSdk["maps"];
  onClusterClick: (marker: ClusterDisplayMarker) => void;
  onPlaceClick: (place: PlacePreviewRecord) => void;
};

export function renderNaverMapMarkers({
  displayMarkers,
  map,
  maps,
  onClusterClick,
  onPlaceClick,
}: RenderNaverMapMarkersOptions): NaverMarkerInstance[] {
  return displayMarkers.map((markerItem) => {
    const title =
      markerItem.kind === "cluster"
        ? `${formatMarkerCount(markerItem.placeCount)}곳`
        : markerItem.place.name;
    const marker = new maps.Marker({
      map,
      position: new maps.LatLng(markerItem.latitude, markerItem.longitude),
      title,
      zIndex: markerItem.kind === "cluster" ? 10 : markerItem.zIndex,
      icon:
        markerItem.kind === "cluster"
          ? createClusterMarkerIcon(markerItem.placeCount, { maps })
          : createMapMarkerIcon(
              markerItem.place,
              markerItem.isActive,
              { maps },
              { x: markerItem.offsetX, y: markerItem.offsetY },
            ),
    });

    maps.Event.addListener(marker, "click", () => {
      if (markerItem.kind === "cluster") {
        onClusterClick(markerItem);
        return;
      }

      onPlaceClick(markerItem.place);
    });

    return marker;
  });
}
