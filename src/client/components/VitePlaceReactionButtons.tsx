import { useRef, useState, useTransition } from "react";

import { getRateLimitFeedbackMessage } from "@/lib/rate-limit-feedback";
import type { PlaceReactionType } from "@/features/places/types";

type PlaceReactionUpdate = {
  placeId: string;
  likeCount: number;
  dislikeCount: number;
  viewerReaction: PlaceReactionType | null;
};

type VitePlaceReactionButtonsProps = {
  placeId: string;
  initialDislikeCount: number;
  initialLikeCount: number;
  initialViewerReaction: PlaceReactionType | null;
  onUpdate?: (nextState: PlaceReactionUpdate) => void;
};

type ReactionState = {
  dislikeCount: number;
  likeCount: number;
  viewerReaction: PlaceReactionType | null;
};

function getNextReaction(
  currentReaction: PlaceReactionType | null,
  targetReaction: PlaceReactionType,
) {
  return currentReaction === targetReaction ? null : targetReaction;
}

function ThumbUpIcon({ active }: { active: boolean }) {
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
      <path d="M7 11v9" />
      <path d="M10 11 13.5 4.5c.4-.8 1.5-1 2.2-.5.5.4.8 1 .7 1.6L15.8 11H20a2 2 0 0 1 2 2l-1 5.5A2.5 2.5 0 0 1 18.5 21H9.5A2.5 2.5 0 0 1 7 18.5V11Z" />
      <path d="M3 11h4v10H3z" />
    </svg>
  );
}

function ThumbDownIcon({ active }: { active: boolean }) {
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
      <path d="M17 13V4" />
      <path d="m14 13-3.5 6.5c-.4.8-1.5 1-2.2.5-.5-.4-.8-1-.7-1.6L8.2 13H4a2 2 0 0 1-2-2l1-5.5A2.5 2.5 0 0 1 5.5 3h9A2.5 2.5 0 0 1 17 5.5V13Z" />
      <path d="M17 3h4v10h-4z" />
    </svg>
  );
}

export function VitePlaceReactionButtons({
  placeId,
  initialDislikeCount,
  initialLikeCount,
  initialViewerReaction,
  onUpdate,
}: VitePlaceReactionButtonsProps) {
  const [reactionState, setReactionState] = useState<ReactionState>({
    dislikeCount: initialDislikeCount,
    likeCount: initialLikeCount,
    viewerReaction: initialViewerReaction,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const reactionRequestInFlightRef = useRef(false);

  const submitReaction = (targetReaction: PlaceReactionType) => {
    if (reactionRequestInFlightRef.current) {
      return;
    }

    reactionRequestInFlightRef.current = true;
    startTransition(async () => {
      try {
        const nextReaction = getNextReaction(
          reactionState.viewerReaction,
          targetReaction,
        );
        const response = await fetch(
          `/api/places/${encodeURIComponent(placeId)}/reaction`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              reaction: nextReaction,
            }),
          },
        );
        const result = (await response.json()) as {
          ok: boolean;
          message: string;
          retryAfterMs?: number;
          likeCount: number;
          dislikeCount: number;
          reaction: PlaceReactionType | null;
        };

        if (result.ok) {
          const nextState = {
            placeId,
            likeCount: result.likeCount,
            dislikeCount: result.dislikeCount,
            viewerReaction: result.reaction,
          };

          setReactionState(nextState);
          onUpdate?.(nextState);
        }

        setMessage(
          getRateLimitFeedbackMessage({
            response,
            message: result.message,
            retryAfterMs: result.retryAfterMs,
            defaultMessage: "반응 요청이 너무 빠릅니다.",
          }),
        );
      } catch {
        setMessage("반응을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
      } finally {
        reactionRequestInFlightRef.current = false;
      }
    });
  };

  const isLiked = reactionState.viewerReaction === "like";
  const isDisliked = reactionState.viewerReaction === "dislike";

  return (
    <div className="grid gap-2">
      <div className="inline-flex w-fit flex-wrap gap-1 rounded-[1rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)]/88 p-1 shadow-sm">
        <button
          type="button"
          onClick={() => submitReaction("like")}
          disabled={isPending}
          aria-label="좋아요"
          data-testid="reaction-like-button"
          className={`inline-flex min-w-[6.5rem] items-center justify-center gap-2 whitespace-nowrap rounded-[0.82rem] px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
            isLiked
              ? "bg-[var(--altteul-accent-soft)] text-[var(--altteul-accent-text)] shadow-sm"
              : "text-[var(--altteul-text-secondary)] hover:bg-[var(--altteul-bg-subtle)]/85"
          }`}
        >
          <span
            className={isLiked ? "text-[var(--altteul-accent-text)]" : "text-[var(--altteul-text-tertiary)]"}
          >
            <ThumbUpIcon active={isLiked} />
          </span>
          <span>좋아요</span>
          <span
            className="min-w-5 text-center text-sm"
            data-testid="reaction-like-count"
          >
            {reactionState.likeCount}
          </span>
        </button>
        <button
          type="button"
          onClick={() => submitReaction("dislike")}
          disabled={isPending}
          aria-label="아쉬워요"
          data-testid="reaction-dislike-button"
          className={`inline-flex min-w-[6.5rem] items-center justify-center gap-2 whitespace-nowrap rounded-[0.82rem] px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
            isDisliked
              ? "bg-[var(--altteul-text-strong)] text-white shadow-sm"
              : "text-[var(--altteul-text-secondary)] hover:bg-[var(--altteul-bg-subtle)]/85"
          }`}
        >
          <span className={isDisliked ? "text-white" : "text-[var(--altteul-text-tertiary)]"}>
            <ThumbDownIcon active={isDisliked} />
          </span>
          <span>아쉬워요</span>
          <span className="min-w-5 text-center text-sm">
            {reactionState.dislikeCount}
          </span>
        </button>
      </div>
      {message ? <p className="pl-1 text-[11px] text-[var(--altteul-text-tertiary)]">{message}</p> : null}
    </div>
  );
}
