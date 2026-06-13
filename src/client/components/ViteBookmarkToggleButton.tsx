import { useState, useTransition } from "react";
import { useNavigate } from "react-router-dom";

type ViteBookmarkToggleButtonProps = {
  placeId: string;
  initialBookmarked: boolean;
  compact?: boolean;
  iconOnly?: boolean;
  loginHref?: string;
  onUpdate?: (nextBookmarked: boolean) => void;
};

function BookmarkIcon({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 4.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V5.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

export function ViteBookmarkToggleButton({
  placeId,
  initialBookmarked,
  compact = false,
  iconOnly = false,
  loginHref,
  onUpdate,
}: ViteBookmarkToggleButtonProps) {
  const navigate = useNavigate();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error" | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggleBookmark = () => {
    startTransition(async () => {
      try {
        setMessage(null);
        setMessageTone(null);
        const nextBookmarked = !bookmarked;
        const response = await fetch(
          `/api/bookmarks/${encodeURIComponent(placeId)}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              bookmarked: nextBookmarked,
            }),
          },
        );
        const result = (await response.json()) as {
          ok: boolean;
          bookmarked: boolean;
          message: string;
          requiresAuth?: boolean;
        };

        if (response.status === 401 || result.requiresAuth) {
          if (loginHref) {
            navigate(loginHref);
            return;
          }

          setMessage(result.message);
          setMessageTone("error");
          return;
        }

        if (result.ok) {
          setBookmarked(result.bookmarked);
          setMessage(result.message);
          setMessageTone("success");
          onUpdate?.(result.bookmarked);
          return;
        }

        setMessage(result.message);
        setMessageTone("error");
      } catch (error) {
        console.error("Failed to toggle bookmark.", error);
        setMessage("북마크 업데이트에 실패했습니다.");
        setMessageTone("error");
      }
    });
  };

  return (
    <div
      className={
        compact ? "flex items-center gap-2" : "flex flex-col items-start gap-2"
      }
    >
      <button
        type="button"
        onClick={toggleBookmark}
        aria-label={bookmarked ? "북마크 해제" : "북마크 저장"}
        disabled={isPending}
        data-testid={`bookmark-toggle-${placeId}`}
        className={`altteulmap-button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-60 ${
          iconOnly
            ? bookmarked
              ? "altteulmap-accent-ghost h-11 w-11 px-0 text-[var(--altteul-accent-text)]"
              : "h-11 w-11 border border-stone-300 bg-white px-0 text-stone-700 hover:bg-white"
            : compact
            ? bookmarked
              ? "altteulmap-accent-ghost gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--altteul-accent-text)]"
              : "gap-1.5 border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-white"
            : bookmarked
              ? "altteulmap-accent-ghost gap-2 px-4 py-2 text-sm font-medium text-[var(--altteul-accent-text)]"
              : "gap-2 border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-white"
        }`}
      >
        <BookmarkIcon active={bookmarked} />
        {iconOnly ? null : isPending ? "저장 중" : bookmarked ? "저장됨" : "북마크"}
      </button>
      {message && !compact ? (
        <p
          data-testid={`bookmark-message-${placeId}`}
          className={`text-xs ${
            messageTone === "success" ? "text-[var(--altteul-primary-text)]" : "text-stone-500"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
