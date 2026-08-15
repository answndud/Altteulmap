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
  | { status: "loading"; data: MapPlacesResponse | null; error: null }
  | { status: "success"; data: MapPlacesResponse; error: null }
  | { status: "error"; data: MapPlacesResponse | null; error: string };

function toMapLoadError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "장소 목록을 불러오지 못했습니다.";
}

async function loadPlaces(apiPath: string, signal?: AbortSignal) {
  const response = await fetch(apiPath, {
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error("장소 목록을 불러오지 못했습니다.");
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
  const requestSequenceRef = useRef(0);
  const activeRequestControllerRef = useRef<AbortController | null>(null);
  const shouldIgnoreFirstViewportSyncRef = useRef(false);
  const clusterFocusViewportLockUntilRef = useRef(0);
  const [isManualRefreshPending, setIsManualRefreshPending] = useState(false);
  const [, startViewportRefresh] = useTransition();

  useEffect(() => {
    return () => {
      activeRequestControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    activeRequestControllerRef.current?.abort();

    const controller = new AbortController();
    const requestSequence = ++requestSequenceRef.current;
    setIsManualRefreshPending(false);
    const initialViewport =
      searchScope === "viewport" ? createBootstrapViewport() : null;
    const initialApiPath = buildMapApiPath(searchParams, initialViewport);

    shouldIgnoreFirstViewportSyncRef.current = searchScope === "viewport";
    lastViewportRequestPathRef.current = initialApiPath;
    setViewport(initialViewport);
    setState((current) => ({
      status: "loading",
      data: current.data,
      error: null,
    }));
    activeRequestControllerRef.current = controller;

    loadPlaces(initialApiPath, controller.signal)
      .then((data) => {
        if (requestSequenceRef.current !== requestSequence) {
          return;
        }

        activeRequestControllerRef.current = null;
        onResetSelectedPlace();
        setOptimisticClusterPlaces(null);
        setState({ status: "success", data, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (requestSequenceRef.current !== requestSequence) {
          return;
        }

        activeRequestControllerRef.current = null;
        setState((current) => ({
          status: "error",
          data: current.data,
          error: toMapLoadError(error),
        }));
      });

    return () => {
      controller.abort();
      if (activeRequestControllerRef.current === controller) {
        activeRequestControllerRef.current = null;
      }
    };
  }, [onResetSelectedPlace, searchParams, searchScope]);

  const refreshViewportPlaces = useCallback(() => {
    if (searchScope === "viewport" && !viewport) {
      return;
    }

    activeRequestControllerRef.current?.abort();
    setIsManualRefreshPending(true);
    const controller = new AbortController();
    const requestSequence = ++requestSequenceRef.current;
    const apiPath = buildMapApiPath(
      searchParams,
      searchScope === "viewport" ? viewport : null,
      {
        forceRefresh: true,
      },
    );
    lastViewportRequestPathRef.current = apiPath;
    activeRequestControllerRef.current = controller;
    setState((current) => ({
      status: "loading",
      data: current.data,
      error: null,
    }));

    startViewportRefresh(async () => {
      try {
        const data = await loadPlaces(apiPath, controller.signal);
        if (requestSequenceRef.current !== requestSequence) {
          return;
        }

        activeRequestControllerRef.current = null;
        setState({ status: "success", data, error: null });
        onResetSelectedPlace();
        setOptimisticClusterPlaces(null);
      } catch (error) {
        if (
          controller.signal.aborted ||
          requestSequenceRef.current !== requestSequence
        ) {
          return;
        }

        activeRequestControllerRef.current = null;
        lastViewportRequestPathRef.current = null;
        setState((current) => ({
          status: "error",
          data: current.data,
          error: toMapLoadError(error),
        }));
      } finally {
        if (requestSequenceRef.current === requestSequence) {
          setIsManualRefreshPending(false);
        }
      }
    });
  }, [onResetSelectedPlace, searchParams, searchScope, viewport]);

  useEffect(() => {
    if (searchScope !== "viewport" || !viewport) {
      return;
    }

    const apiPath = buildMapApiPath(searchParams, viewport);

    if (lastViewportRequestPathRef.current === apiPath) {
      return;
    }

    activeRequestControllerRef.current?.abort();
    const fetchTimeoutId = window.setTimeout(() => {
      const controller = new AbortController();
      const requestSequence = ++requestSequenceRef.current;
      lastViewportRequestPathRef.current = apiPath;
      activeRequestControllerRef.current = controller;
      setIsManualRefreshPending(false);
      setState((current) => ({
        status: "loading",
        data: current.data,
        error: null,
      }));

      startViewportRefresh(async () => {
        try {
          const data = await loadPlaces(apiPath, controller.signal);
          if (requestSequenceRef.current !== requestSequence) {
            return;
          }

          activeRequestControllerRef.current = null;
          setState({ status: "success", data, error: null });
          onResetSelectedPlace();
          setOptimisticClusterPlaces(null);
        } catch (error) {
          if (
            controller.signal.aborted ||
            requestSequenceRef.current !== requestSequence
          ) {
            return;
          }

          lastViewportRequestPathRef.current = null;
          activeRequestControllerRef.current = null;
          setState((current) => ({
            status: "error",
            data: current.data,
            error: toMapLoadError(error),
          }));
        }
      });
    }, VIEWPORT_FETCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(fetchTimeoutId);
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
      activeRequestControllerRef.current?.abort();
      const requestSequence = ++requestSequenceRef.current;
      const apiPath = buildMapApiPath(searchParams, nextViewport, {
        forceViewportScope: true,
      });
      const controller = new AbortController();

      clusterFocusViewportLockUntilRef.current =
        Date.now() + CLUSTER_FOCUS_VIEWPORT_LOCK_MS;
      shouldIgnoreFirstViewportSyncRef.current = false;
      lastViewportRequestPathRef.current = apiPath;
      activeRequestControllerRef.current = controller;
      setIsManualRefreshPending(false);
      setOptimisticClusterPlaces(
        previewPlaces && previewPlaces.length > 0 ? previewPlaces : null,
      );
      setViewport(nextViewport);
      setState((current) => ({
        status: "loading",
        data: current.data,
        error: null,
      }));

      startViewportRefresh(async () => {
        try {
          const data = await loadPlaces(apiPath, controller.signal);
          if (requestSequenceRef.current !== requestSequence) {
            return;
          }

          activeRequestControllerRef.current = null;
          setState({ status: "success", data, error: null });
          onResetSelectedPlace();
          setOptimisticClusterPlaces(null);
        } catch (error) {
          if (
            controller.signal.aborted ||
            requestSequenceRef.current !== requestSequence
          ) {
            return;
          }

          lastViewportRequestPathRef.current = null;
          activeRequestControllerRef.current = null;
          setOptimisticClusterPlaces(null);
          setState((current) => ({
            status: "error",
            data: current.data,
            error: toMapLoadError(error),
          }));
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
