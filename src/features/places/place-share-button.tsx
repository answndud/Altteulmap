"use client";

import { useState } from "react";

type PlaceShareButtonProps = {
  path: string;
  text?: string;
  title: string;
  className?: string;
  messageClassName?: string;
  messageTestId?: string;
  testId?: string;
};

function ShareIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4" />
      <path d="m15.4 6.5-6.8 4" />
    </svg>
  );
}

export function PlaceShareButton({
  path,
  text,
  title,
  className,
  messageClassName,
  messageTestId = "place-share-message",
  testId = "place-share-button",
}: PlaceShareButtonProps) {
  const [message, setMessage] = useState<string | null>(null);

  const handleShare = async () => {
    const url = new URL(path, window.location.origin).toString();
    const clipboardText = [title, text, url]
      .filter((item): item is string => Boolean(item))
      .join("\n");

    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text,
          url,
        });
        setMessage("공유 문구를 준비했습니다.");
        return;
      }

      await navigator.clipboard.writeText(clipboardText);
      setMessage("공유 문구를 복사했습니다.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      setMessage("공유 문구를 준비하지 못했습니다.");
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleShare}
        data-testid={testId}
        className={
          className ??
          "altteulmap-button inline-flex whitespace-nowrap border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
        }
      >
        <span className="inline-flex items-center gap-2">
          <ShareIcon />
          공유
        </span>
      </button>
      {message ? (
        <p
          className={messageClassName ?? "text-xs text-stone-500"}
          data-testid={messageTestId}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
