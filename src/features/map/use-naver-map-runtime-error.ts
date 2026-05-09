"use client";

import { useEffect } from "react";

type UseNaverMapRuntimeErrorOptions = {
  failMap: (message: string, error?: unknown) => void;
  naverMapKeyId: string;
};

function isNaverMapsRuntimeError(filename: string) {
  return (
    filename.includes("oapi.map.naver.com/openapi/v3/maps.js") ||
    filename.includes("map.naver.com/openapi/v3/maps.js")
  );
}

export function useNaverMapRuntimeError({
  failMap,
  naverMapKeyId,
}: UseNaverMapRuntimeErrorOptions) {
  useEffect(() => {
    if (!naverMapKeyId) {
      return;
    }

    const handleSdkRuntimeError = (event: ErrorEvent) => {
      const filename = event.filename ?? "";

      if (!isNaverMapsRuntimeError(filename)) {
        return;
      }

      event.preventDefault();
      failMap(
        "NAVER Maps SDK runtime error.",
        event.error ?? new Error(event.message),
      );
    };

    window.addEventListener("error", handleSdkRuntimeError);

    return () => {
      window.removeEventListener("error", handleSdkRuntimeError);
    };
  }, [failMap, naverMapKeyId]);
}
