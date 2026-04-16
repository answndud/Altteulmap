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
    const payload = JSON.stringify({
      path: pathname,
      ref: ref === "share" ? "share" : undefined,
      scope,
      source: ref === "share" ? source : undefined,
    });
    let timeoutId: number | null = null;
    let idleId: number | null = null;
    let cancelled = false;

    const sendVisit = () => {
      if (cancelled) {
        return;
      }

      if (navigator.sendBeacon) {
        const accepted = navigator.sendBeacon(
          "/api/telemetry/visit",
          new Blob([payload], { type: "application/json" }),
        );

        if (accepted) {
          return;
        }
      }

      void fetch("/api/telemetry/visit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: payload,
        keepalive: true,
        credentials: "same-origin",
        cache: "no-store",
      }).catch(() => {
        // Ignore telemetry delivery failures. Admin metrics are best-effort.
      });
    };

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(() => {
        sendVisit();
      }, { timeout: 1500 });
    } else {
      timeoutId = window.setTimeout(() => {
        sendVisit();
      }, 900);
    }

    return () => {
      cancelled = true;

      if (idleId !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [pathname, scope]);

  return null;
}
