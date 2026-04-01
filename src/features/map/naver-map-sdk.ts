export type MapStatus = "missing-key" | "loading" | "ready" | "error";

export type MapPoint = {
  lat: number;
  lng: number;
};

export type MapViewport = {
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  center: MapPoint;
  zoom: number;
};

export type NaverMapsSdk = {
  maps: {
    Map: new (container: HTMLElement, options: Record<string, unknown>) => {
      getBounds?: () => {
        getMin?: () => {
          lat?: () => number;
          lng?: () => number;
        };
        getMax?: () => {
          lat?: () => number;
          lng?: () => number;
        };
      };
      getCenter?: () => {
        lat?: () => number;
        lng?: () => number;
      };
      getZoom?: () => number;
      setCenter?: (latLng: unknown) => void;
      setZoom?: (zoom: number) => void;
      panTo?: (latLng: unknown) => void;
      fitBounds?: (bounds: unknown) => void;
      destroy?: () => void;
      autoResize?: () => void;
    };
    Marker: new (options: Record<string, unknown>) => {
      setMap?: (map: unknown) => void;
    };
    LatLng: new (lat: number, lng: number) => unknown;
    LatLngBounds: new (southWest: unknown, northEast: unknown) => unknown;
    Point: new (x: number, y: number) => unknown;
    Size: new (width: number, height: number) => unknown;
    Event: {
      addListener: <TArgs extends unknown[]>(
        target: unknown,
        eventName: string,
        listener: (...args: TArgs) => void,
      ) => void;
    };
    Service?: {
      Status: {
        OK: number;
      };
      geocode: (
        options: {
          query: string;
          coordinate?: string;
          filter?: string;
          page?: number;
          count?: number;
        },
        callback: (
          status: number,
          response?: {
            v2?: {
              addresses?: Array<{
                roadAddress?: string;
                jibunAddress?: string;
                x?: string;
                y?: string;
              }>;
            };
          },
        ) => void,
      ) => void;
    };
  };
};

export type NaverMapInstance = InstanceType<NaverMapsSdk["maps"]["Map"]>;
export type NaverMarkerInstance = InstanceType<NaverMapsSdk["maps"]["Marker"]>;

type WindowWithNaver = Window &
  typeof globalThis & {
    naver?: NaverMapsSdk;
    __altteulmapNaverMapReady__?: () => void;
    navermap_authFailure?: () => void;
  };

export const DEFAULT_MAP_CENTER: MapPoint = {
  lat: 37.5665,
  lng: 126.978,
};

const NAVER_MAP_SCRIPT_ID = "altteulmap-naver-map-sdk";
let naverMapSdkPromise: Promise<NaverMapsSdk> | null = null;

export function getNaverMapKeyId() {
  return (
    process.env.NEXT_PUBLIC_NAVER_MAP_KEY_ID ||
    process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ||
    ""
  );
}

export function loadNaverMapSdk(keyId: string) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("NAVER Maps SDK can only load in the browser."));
  }

  const sdkWindow = window as WindowWithNaver;

  if (sdkWindow.naver?.maps) {
    return Promise.resolve(sdkWindow.naver);
  }

  if (naverMapSdkPromise) {
    return naverMapSdkPromise;
  }

  naverMapSdkPromise = new Promise<NaverMapsSdk>((resolve, reject) => {
    const callbackName = "__altteulmapNaverMapReady__";

    const cleanup = () => {
      delete sdkWindow[callbackName];
      delete sdkWindow.navermap_authFailure;
    };

    sdkWindow[callbackName] = () => {
      if (sdkWindow.naver?.maps) {
        cleanup();
        resolve(sdkWindow.naver);
        return;
      }

      cleanup();
      reject(new Error("NAVER Maps SDK loaded without a maps namespace."));
    };

    sdkWindow.navermap_authFailure = () => {
      cleanup();
      reject(new Error("NAVER Maps authentication failed."));
    };

    const existingScript = document.getElementById(
      NAVER_MAP_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener(
        "error",
        () => {
          cleanup();
          reject(new Error("Failed to load the NAVER Maps SDK script."));
        },
        { once: true },
      );

      return;
    }

    const script = document.createElement("script");
    script.id = NAVER_MAP_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(keyId)}&submodules=geocoder&callback=${callbackName}`;
    script.onerror = () => {
      cleanup();
      reject(new Error("Failed to load the NAVER Maps SDK script."));
    };

    document.head.appendChild(script);
  });

  return naverMapSdkPromise;
}

export function getLoadedNaverMapSdk() {
  if (typeof window === "undefined") {
    return null;
  }

  return (window as WindowWithNaver).naver ?? null;
}

export function getViewportFromMap(
  map: NaverMapInstance | null,
): MapViewport | null {
  if (!map) {
    return null;
  }

  const bounds = map.getBounds?.();
  const min = bounds?.getMin?.();
  const max = bounds?.getMax?.();
  const center = map.getCenter?.();
  const zoom = map.getZoom?.();

  const minLat = min?.lat?.();
  const maxLat = max?.lat?.();
  const minLng = min?.lng?.();
  const maxLng = max?.lng?.();
  const centerLat = center?.lat?.();
  const centerLng = center?.lng?.();
  const zoomValue = zoom;

  if (
    typeof minLat !== "number" ||
    !Number.isFinite(minLat) ||
    typeof maxLat !== "number" ||
    !Number.isFinite(maxLat) ||
    typeof minLng !== "number" ||
    !Number.isFinite(minLng) ||
    typeof maxLng !== "number" ||
    !Number.isFinite(maxLng) ||
    typeof centerLat !== "number" ||
    !Number.isFinite(centerLat) ||
    typeof centerLng !== "number" ||
    !Number.isFinite(centerLng) ||
    typeof zoomValue !== "number" ||
    !Number.isFinite(zoomValue)
  ) {
    return null;
  }

  return {
    bounds: {
      minLat,
      maxLat,
      minLng,
      maxLng,
    },
    center: {
      lat: centerLat,
      lng: centerLng,
    },
    zoom: zoomValue,
  };
}

export async function geocodeAddress(query: string) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return null;
  }

  const naver = getLoadedNaverMapSdk();
  const service = naver?.maps.Service;

  if (!service) {
    throw new Error("NAVER Geocoder is not loaded.");
  }

  return new Promise<
    | {
        point: MapPoint;
        roadAddress?: string;
        jibunAddress?: string;
      }
    | null
  >((resolve) => {
    service.geocode(
      {
        query: trimmedQuery,
        count: 1,
      },
      (status, response) => {
        if (status !== service.Status.OK) {
          resolve(null);
          return;
        }

        const firstAddress = response?.v2?.addresses?.[0];
        const latitude = Number(firstAddress?.y ?? "");
        const longitude = Number(firstAddress?.x ?? "");

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          resolve(null);
          return;
        }

        resolve({
          point: {
            lat: latitude,
            lng: longitude,
          },
          roadAddress: firstAddress?.roadAddress,
          jibunAddress: firstAddress?.jibunAddress,
        });
      },
    );
  });
}
