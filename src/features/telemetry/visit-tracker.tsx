"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import {
  isPlaceShareSource,
} from "@/features/places/share";
import type { VisitActivityScope } from "@/features/telemetry/repository";

type VisitTrackerProps = {
  scope: VisitActivityScope;
};

export function VisitTracker({ scope }: VisitTrackerProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const ref = searchParams.get("ref");
    const sourceValue = searchParams.get("source");
    const source = isPlaceShareSource(sourceValue) ? sourceValue : undefined;

    void fetch("/api/telemetry/visit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: pathname,
        ref: ref === "share" ? "share" : undefined,
        scope,
        source: ref === "share" ? source : undefined,
      }),
      keepalive: true,
      credentials: "same-origin",
      cache: "no-store",
    }).catch(() => {
      // Ignore telemetry delivery failures. Admin metrics are best-effort.
    });
  }, [pathname, scope]);

  return null;
}
