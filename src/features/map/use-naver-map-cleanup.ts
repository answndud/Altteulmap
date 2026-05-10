"use client";

import { useEffect } from "react";

export function useNaverMapCleanup(cleanup: () => void) {
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);
}
