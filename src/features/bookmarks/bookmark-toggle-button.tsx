"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type BookmarkToggleButtonProps = {
  placeId: string;
  initialBookmarked: boolean;
  disabled?: boolean;
  compact?: boolean;
  loginHref?: string;
};

export function BookmarkToggleButton({
  placeId,
  initialBookmarked,
  disabled = false,
  compact = false,
  loginHref,
}: BookmarkToggleButtonProps) {
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggleBookmark = () => {
    startTransition(async () => {
      const nextBookmarked = !bookmarked;
      const response = await fetch(`/api/bookmarks/${encodeURIComponent(placeId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookmarked: nextBookmarked,
        }),
      });

      const result = (await response.json()) as {
        ok: boolean;
        bookmarked: boolean;
        message: string;
        requiresAuth?: boolean;
      };

      if (response.status === 401 || result.requiresAuth) {
        if (loginHref) {
          router.push(loginHref);
          return;
        }

        setMessage(result.message);
        return;
      }

      if (result.ok) {
        setBookmarked(result.bookmarked);
        router.refresh();
      }

      setMessage(result.message);
    });
  };

  return (
    <div className={compact ? "flex items-center gap-2" : "space-y-2"}>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleBookmark();
        }}
        aria-label={bookmarked ? "북마크 해제" : "북마크 저장"}
        disabled={disabled || isPending}
        data-testid={`bookmark-toggle-${placeId}`}
        className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
          compact
            ? bookmarked
              ? "altteulmap-accent-solid px-3 py-1.5 text-xs font-medium"
              : "border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100"
            : bookmarked
              ? "altteulmap-accent-solid px-4 py-2 text-sm font-medium"
              : "border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
        }`}
      >
        {isPending
          ? "저장 중"
          : bookmarked
            ? "저장됨"
            : "저장"}
      </button>
      {message && !compact ? (
        <p
          data-testid={`bookmark-message-${placeId}`}
          className="text-xs text-stone-500"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
