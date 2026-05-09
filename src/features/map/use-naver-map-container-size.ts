"use client";

import { useEffect, useState, type RefObject } from "react";

export type NaverMapContainerSize = {
  height: number;
  width: number;
};

export function useNaverMapContainerSize(
  mapContainerRef: RefObject<HTMLElement | null>,
) {
  const [containerSize, setContainerSize] = useState<NaverMapContainerSize>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const container = mapContainerRef.current;

    if (!container) {
      return;
    }

    const updateSize = () => {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [mapContainerRef]);

  return containerSize;
}
