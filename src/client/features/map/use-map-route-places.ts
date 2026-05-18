import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import type { MapViewport } from "@/features/map/naver-map-sdk";
import type {
  PlaceBounds,
  PlaceMapMarkerMode,
  PlaceMapMarkerRecord,
  PlacePreviewRecord,
  PlaceSearchScope,
} from "@/features/places/types";

import {
  buildMapApiPath,
  CLUSTER_FOCUS_VIEWPORT_LOCK_MS,
  createBootstrapViewport,
  VIEWPORT_FETCH_DEBOUNCE_MS,
} from "./map-query";

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

type MapPlacesLoadState =
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: MapPlacesResponse; error: null }
  | { status: "error"; data: null; error: string };

function toMapLoadError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "지도 결과를 불러오지 못했습니다.";
}

async function loadPlaces(apiPath: string, signal?: AbortSignal) {
  const response = await fetch(apiPath, {
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error("지도 결과를 불러오지 못했습니다.");
  }

  return (await response.json()) as MapPlacesResponse;
}

export function useMapRoutePlaces({
  onResetSelectedPlace,
  searchParams,
  searchScope,
}: {
  onResetSelectedPlace: () => void;
  searchParams: URLSearchParams;
  searchScope: PlaceSearchScope;
}) {
  const [state, setState] = useState<MapPlacesLoadState>({
    status: "loading",
    data: null,
    error: null,
  });
  const [optimisticClusterPlaces, setOptimisticClusterPlaces] = useState<
    PlacePreviewRecord[] | null
  >(null);
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const lastViewportRequestPathRef = useRef<string | null>(null);
  const shouldIgnoreFirstViewportSyncRef = useRef(false);
  const clusterFocusViewportLockUntilRef = useRef(0);
  const [isManualRefreshPending, setIsManualRefreshPending] = useState(false);
  const [, startViewportRefresh] = useTransition();

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

        onResetSelectedPlace();
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
          error: toMapLoadError(error),
        });
      });

    return () => {
      controller.abort();
    };
  }, [onResetSelectedPlace, searchParams, searchScope]);

  const refreshViewportPlaces = useCallback(() => {
    if (!viewport) {
      return;
    }

    setIsManualRefreshPending(true);
    startViewportRefresh(async () => {
      try {
        const data = await loadPlaces(buildMapApiPath(searchParams, viewport));
        setState({ status: "success", data, error: null });
        onResetSelectedPlace();
        setOptimisticClusterPlaces(null);
      } catch (error) {
        setState({
          status: "error",
          data: null,
          error: toMapLoadError(error),
        });
      } finally {
        setIsManualRefreshPending(false);
      }
    });
  }, [onResetSelectedPlace, searchParams, viewport]);

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
          onResetSelectedPlace();
          setOptimisticClusterPlaces(null);
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }

          lastViewportRequestPathRef.current = null;
          setState({
            status: "error",
            data: null,
            error: toMapLoadError(error),
          });
        }
      });
    }, VIEWPORT_FETCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(fetchTimeoutId);
      controller.abort();
    };
  }, [onResetSelectedPlace, searchParams, searchScope, viewport]);

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
    [searchScope],
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
          onResetSelectedPlace();
          setOptimisticClusterPlaces(null);
        } catch (error) {
          lastViewportRequestPathRef.current = null;
          setOptimisticClusterPlaces(null);
          setState({
            status: "error",
            data: null,
            error: toMapLoadError(error),
          });
        }
      });
    },
    [onResetSelectedPlace, searchParams],
  );

  const updatePlaceInResults = useCallback(
    (
      placeId: string,
      updatePlace: (place: PlacePreviewRecord) => PlacePreviewRecord,
    ) => {
      setState((current) => {
        if (current.status !== "success") {
          return current;
        }

        return {
          ...current,
          data: {
            ...current.data,
            items: current.data.items.map((place) =>
              place.id === placeId ? updatePlace(place) : place,
            ),
          },
        };
      });
    },
    [],
  );

  return {
    handleClusterFocusViewport,
    handleViewportChange,
    isManualRefreshPending,
    optimisticClusterPlaces,
    refreshViewportPlaces,
    state,
    updatePlaceInResults,
    viewport,
  };
}
