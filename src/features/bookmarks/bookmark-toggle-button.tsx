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
        disabled={disabled || isPending}
        className={`rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
          compact
            ? bookmarked
              ? "bg-stone-900 px-3 py-1.5 text-xs font-medium text-white"
              : "border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100"
            : bookmarked
              ? "bg-stone-900 px-4 py-2 text-sm font-medium text-white"
              : "border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
        }`}
      >
        {isPending
          ? "처리 중..."
          : bookmarked
            ? "북마크 저장됨"
            : "북마크 저장"}
      </button>
      {message && !compact ? (
        <p className="text-xs text-stone-500">{message}</p>
      ) : null}
    </div>
  );
}
