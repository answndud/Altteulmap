"use client";

import { useEffect, useRef, useState } from "react";

type PublicConfigResponse = {
  turnstileSiteKey?: string;
};

type TurnstileWidgetId = string;

type TurnstileApi = {
  render(
    container: HTMLElement,
    options: {
      callback(token: string): void;
      "error-callback"(): void;
      "expired-callback"(): void;
      sitekey: string;
      theme?: "auto";
    },
  ): TurnstileWidgetId;
  remove(widgetId: TurnstileWidgetId): void;
  reset(widgetId: TurnstileWidgetId): void;
};

type TurnstileWindow = Window & {
  turnstile?: TurnstileApi;
};

type PublicWriteTurnstileProps = {
  disabled?: boolean;
  onRequiredChange(required: boolean): void;
  onTokenChange(token: string): void;
  resetSignal?: number;
  testId?: string;
};

let publicConfigPromise: Promise<PublicConfigResponse> | null = null;
let turnstileScriptPromise: Promise<void> | null = null;

function loadPublicConfig() {
  publicConfigPromise ??= fetch("/api/config/public", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) {
        return {};
      }

      return (await response.json()) as PublicConfigResponse;
    })
    .catch(() => ({}));

  return publicConfigPromise;
}

function loadTurnstileScript() {
  const turnstileWindow = window as TurnstileWindow;

  if (turnstileWindow.turnstile) {
    return Promise.resolve();
  }

  turnstileScriptPromise ??= new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]',
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Turnstile script failed.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Turnstile script failed.")), {
      once: true,
    });
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

export function PublicWriteTurnstile({
  disabled = false,
  onRequiredChange,
  onTokenChange,
  resetSignal = 0,
  testId = "public-write-turnstile",
}: PublicWriteTurnstileProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<TurnstileWidgetId | null>(null);
  const [siteKey, setSiteKey] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("loading");

  useEffect(() => {
    let isMounted = true;

    loadPublicConfig().then((config) => {
      if (!isMounted) {
        return;
      }

      const nextSiteKey = config.turnstileSiteKey?.trim() ?? "";
      setSiteKey(nextSiteKey);
      onRequiredChange(Boolean(nextSiteKey));
      setStatus(nextSiteKey ? "loading" : "idle");
    });

    return () => {
      isMounted = false;
    };
  }, [onRequiredChange]);

  useEffect(() => {
    if (!siteKey || !containerRef.current || disabled) {
      return;
    }

    let isMounted = true;

    loadTurnstileScript()
      .then(() => {
        const turnstile = (window as TurnstileWindow).turnstile;

        if (!isMounted || !turnstile || !containerRef.current || widgetIdRef.current) {
          return;
        }

        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "auto",
          callback: (token) => {
            onTokenChange(token);
            setStatus("ready");
          },
          "expired-callback": () => {
            onTokenChange("");
            setStatus("idle");
          },
          "error-callback": () => {
            onTokenChange("");
            setStatus("error");
          },
        });
      })
      .catch(() => {
        if (isMounted) {
          onTokenChange("");
          setStatus("error");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [disabled, onTokenChange, siteKey]);

  useEffect(() => {
    const widgetId = widgetIdRef.current;
    const turnstile = (window as TurnstileWindow).turnstile;

    if (!widgetId || !turnstile) {
      return;
    }

    turnstile.reset(widgetId);
    onTokenChange("");
    setStatus("idle");
  }, [onTokenChange, resetSignal]);

  useEffect(() => {
    return () => {
      const widgetId = widgetIdRef.current;
      const turnstile = (window as TurnstileWindow).turnstile;

      if (widgetId && turnstile) {
        turnstile.remove(widgetId);
        widgetIdRef.current = null;
      }
    };
  }, []);

  if (!siteKey) {
    return null;
  }

  return (
    <div className="grid gap-2" data-testid={testId}>
      <div ref={containerRef} className={disabled ? "pointer-events-none opacity-60" : ""} />
      {status === "error" ? (
        <p className="text-xs text-rose-700">
          보안 확인을 불러오지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.
        </p>
      ) : (
        <p className="text-xs text-[var(--altteul-text-tertiary)]">
          자동 제출 방지를 위해 보안 확인을 완료해주세요.
        </p>
      )}
    </div>
  );
}
