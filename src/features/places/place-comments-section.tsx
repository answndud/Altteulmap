"use client";

import { useState, useTransition } from "react";

import { PublicWriteTurnstile } from "@/client/components/PublicWriteTurnstile";
import { getRateLimitFeedbackMessage } from "@/lib/rate-limit-feedback";
import type { PlaceComment } from "@/features/places/types";

type PlaceCommentsSectionProps = {
  placeId: string;
  initialComments: PlaceComment[];
  showHeader?: boolean;
  surface?: "panel" | "plain";
};

type CommentActionResponse = {
  ok: boolean;
  message: string;
  retryAfterMs?: number;
  item?: PlaceComment | null;
  deletedCommentId?: string | null;
};

export function PlaceCommentsSection({
  placeId,
  initialComments,
  showHeader = true,
  surface = "panel",
}: PlaceCommentsSectionProps) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [isTurnstileRequired, setIsTurnstileRequired] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      const response = await fetch(`/api/places/${encodeURIComponent(placeId)}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body, turnstileToken }),
      });

      const result = (await response.json()) as CommentActionResponse;
      setTurnstileResetSignal((current) => current + 1);
      setMessage(
        getRateLimitFeedbackMessage({
          response,
          message: result.message,
          retryAfterMs: result.retryAfterMs,
          defaultMessage: "코멘트 등록 요청이 너무 빠릅니다.",
        }),
      );

      if (!response.ok || !result.ok || !result.item) {
        return;
      }

      setComments((currentComments) => [result.item!, ...currentComments]);
      setBody("");
    });
  };

  const handleDelete = (commentId: string) => {
    startTransition(async () => {
      const response = await fetch(
        `/api/places/${encodeURIComponent(placeId)}/comments/${encodeURIComponent(commentId)}`,
        {
          method: "DELETE",
        },
      );

      const result = (await response.json()) as CommentActionResponse;
      setMessage(result.message);

      if (!response.ok || !result.ok || !result.deletedCommentId) {
        return;
      }

      setComments((currentComments) =>
        currentComments.filter((comment) => comment.id !== result.deletedCommentId),
      );
    });
  };
  const rootClassName = surface === "plain" ? "grid gap-4" : "altteulmap-panel p-5";
  const formWrapperClassName = showHeader
    ? "mt-4 rounded-[1rem] border border-stone-200 bg-[var(--altteul-bg-subtle)]/65 p-4"
    : "rounded-[1rem] border border-stone-200 bg-[var(--altteul-bg-subtle)]/65 p-4";

  return (
    <section
      data-testid="place-comments-section"
      className={rootClassName}
    >
      {showHeader ? (
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="altteulmap-section-kicker text-[11px]">코멘트</p>
            <h4 className="mt-1 text-base font-semibold text-stone-900">사용자 메모</h4>
          </div>
          <span className="altteulmap-badge px-3 py-1 text-xs font-medium">
            {comments.length}개
          </span>
        </div>
      ) : null}

      <div className={formWrapperClassName}>
        <div className="grid gap-3">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            disabled={isPending}
            data-testid="comment-body"
            className="altteulmap-input min-h-28 resize-y px-4 py-3.5 text-sm leading-6 text-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
            placeholder="예: 점심시간 전에는 금방 품절돼요. 현금 결제만 가능합니다."
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-stone-500">
              짧고 구체적인 이용 팁만 남겨주세요.
            </p>
            <PublicWriteTurnstile
              disabled={isPending}
              onRequiredChange={setIsTurnstileRequired}
              onTokenChange={setTurnstileToken}
              resetSignal={turnstileResetSignal}
              testId="comment-turnstile"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || body.trim().length < 2 || (isTurnstileRequired && !turnstileToken)}
              data-testid="comment-submit"
              className="altteulmap-accent-solid altteulmap-button inline-flex w-full items-center justify-center whitespace-nowrap px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isPending ? "등록 중..." : "남기기"}
            </button>
          </div>
        </div>
      </div>

      {message ? <p className="mt-3 text-xs text-stone-500">{message}</p> : null}

      {comments.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              data-testid="comment-item"
              className="rounded-[1rem] border border-stone-200 bg-[var(--altteul-bg-subtle)]/55 px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xs font-semibold text-stone-700 ring-1 ring-stone-200">
                    {comment.authorLabel.slice(0, 2)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-stone-900">
                      {comment.authorLabel}
                    </p>
                    <p className="text-xs text-stone-500">{comment.createdAt}</p>
                  </div>
                </div>
                {comment.canDelete ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(comment.id)}
                    disabled={isPending}
                    data-testid={`comment-delete-${comment.id}`}
                    className="altteulmap-button whitespace-nowrap border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    삭제
                  </button>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-stone-700">
                {comment.body}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-[1rem] border border-dashed border-stone-300 bg-white px-4 py-5 text-sm text-stone-500">
          아직 등록된 코멘트가 없습니다.
        </div>
      )}
    </section>
  );
}
