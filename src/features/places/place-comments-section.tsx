"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { PlaceComment } from "@/features/places/types";

type PlaceCommentsSectionProps = {
  placeId: string;
  initialComments: PlaceComment[];
  authenticated: boolean;
  loginHref: string;
};

type CommentActionResponse = {
  ok: boolean;
  message: string;
  item?: PlaceComment | null;
  deletedCommentId?: string | null;
};

export function PlaceCommentsSection({
  placeId,
  initialComments,
  authenticated,
  loginHref,
}: PlaceCommentsSectionProps) {
  const router = useRouter();
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!authenticated) {
      router.push(loginHref);
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/places/${encodeURIComponent(placeId)}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
      });

      const result = (await response.json()) as CommentActionResponse;
      if (response.status === 401) {
        router.push(loginHref);
        return;
      }
      setMessage(result.message);

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
      if (response.status === 401) {
        router.push(loginHref);
        return;
      }
      setMessage(result.message);

      if (!response.ok || !result.ok || !result.deletedCommentId) {
        return;
      }

      setComments((currentComments) =>
        currentComments.filter((comment) => comment.id !== result.deletedCommentId),
      );
    });
  };

  return (
    <section className="rounded-[1.5rem] border border-stone-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-sm font-semibold text-stone-900">사용자 코멘트</h4>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
          {comments.length}개
        </span>
      </div>

      <div className="mt-4 rounded-[1.15rem] bg-stone-50 p-4">
        {authenticated ? (
          <div className="space-y-3">
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={3}
              disabled={isPending}
              className="w-full rounded-[1rem] border border-stone-300 bg-white px-4 py-3 text-sm leading-6 text-stone-700 outline-none transition focus:border-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="예: 점심시간 전에는 금방 품절돼요. 현금 결제만 가능합니다."
            />
            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending || body.trim().length < 2}
                className="altteulmap-accent-solid whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "등록 중..." : "남기기"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end">
            <Link
              href={loginHref}
              className="whitespace-nowrap rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
            >
              로그인 후 코멘트
            </Link>
          </div>
        )}
      </div>

      {message ? <p className="mt-3 text-xs text-stone-500">{message}</p> : null}

      {comments.length > 0 ? (
        <div className="mt-4 space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-[1.15rem] bg-stone-50 px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-200 text-xs font-semibold text-stone-700">
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
                    className="whitespace-nowrap rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
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
        <p className="mt-4 text-sm text-stone-500">
          아직 등록된 코멘트가 없습니다.
        </p>
      )}
    </section>
  );
}
