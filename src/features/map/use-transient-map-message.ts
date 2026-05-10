"use client";

import { useEffect } from "react";

type UseTransientMapMessageOptions = {
  clearMessage: () => void;
  message: string | null;
  timeoutMs?: number;
};

export function useTransientMapMessage({
  clearMessage,
  message,
  timeoutMs = 2800,
}: UseTransientMapMessageOptions) {
  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      clearMessage();
    }, timeoutMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [clearMessage, message, timeoutMs]);
}
