import { useEffect, useState } from "react";

const DESKTOP_LAYOUT_QUERY = "(min-width: 1280px)";

export function useMapDesktopLayout() {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia(DESKTOP_LAYOUT_QUERY).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_LAYOUT_QUERY);
    const updateDesktopState = () => setIsDesktop(mediaQuery.matches);

    updateDesktopState();
    mediaQuery.addEventListener("change", updateDesktopState);

    return () => {
      mediaQuery.removeEventListener("change", updateDesktopState);
    };
  }, []);

  return isDesktop;
}
