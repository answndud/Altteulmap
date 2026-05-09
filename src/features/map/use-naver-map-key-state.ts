"use client";

import { useEffect, useState } from "react";

import {
  getNaverMapKeyId,
  type MapStatus,
} from "@/features/map/naver-map-sdk";
import { isLocalMapFallbackHost } from "@/features/map/naver-map-panel-helpers";

export function useNaverMapKeyState() {
  const buildTimeNaverMapKeyId = getNaverMapKeyId();
  const shouldUseLocalTileFallback = isLocalMapFallbackHost();
  const [runtimeNaverMapKeyId, setRuntimeNaverMapKeyId] = useState(
    buildTimeNaverMapKeyId,
  );
  const [shouldBootMap, setShouldBootMap] = useState(false);
  const [status, setStatus] = useState<MapStatus>("loading");
  const naverMapKeyId = shouldUseLocalTileFallback ? "" : runtimeNaverMapKeyId;

  useEffect(() => {
    if (shouldUseLocalTileFallback) {
      setRuntimeNaverMapKeyId("");
      setStatus("missing-key");
      setShouldBootMap(false);
      return;
    }

    if (buildTimeNaverMapKeyId) {
      setRuntimeNaverMapKeyId(buildTimeNaverMapKeyId);
      setStatus("loading");
      setShouldBootMap(true);
      return;
    }

    let isDisposed = false;

    fetch("/api/config/public", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          return "";
        }

        const payload = (await response.json()) as { naverMapKeyId?: string };

        return payload.naverMapKeyId?.trim() ?? "";
      })
      .then((keyId) => {
        if (isDisposed) {
          return;
        }

        setRuntimeNaverMapKeyId(keyId);
        setStatus(keyId ? "loading" : "missing-key");
        setShouldBootMap(Boolean(keyId));
      })
      .catch(() => {
        if (!isDisposed) {
          setRuntimeNaverMapKeyId("");
          setStatus("missing-key");
        }
      });

    return () => {
      isDisposed = true;
    };
  }, [buildTimeNaverMapKeyId, shouldUseLocalTileFallback]);

  return {
    naverMapKeyId,
    shouldBootMap,
    shouldUseLocalTileFallback,
    setShouldBootMap,
    setStatus,
    status,
  };
}
