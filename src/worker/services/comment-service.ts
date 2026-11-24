import { getPlaceById } from "@/features/places/queries";
import type { PlaceCommentInput } from "@/features/places/write-schema";
import {
  withExistingOrNewWorkerDatabaseConnection,
  type WorkerDatabaseBindings,
} from "@/worker/db";
import { DomainError } from "@/worker/http/api-error";
import {
  createDatabasePlaceComment,
  deleteDatabasePlaceComment,
} from "@/worker/places/places-write-comments-repository";
import type { WorkerPublicWriteActor } from "@/worker/abuse/public-write-actor";
import { mockCommentStore } from "@/worker/routes/public-write-support";
import { selectBackend } from "@/worker/services/backend";
import { canDeleteComment } from "@/worker/services/comment-rules";

type CommentCreated = {
  ok: boolean;
  message: string;
  source: "database" | "mock";
  mock: boolean;
  item: {
    id: string;
    authorLabel: string;
    body: string;
    createdAt: string;
    canDelete: boolean;
  };
};

type CommentDeleted = {
  ok: boolean;
  message: string;
  source: "database" | "mock";
  mock: boolean;
  deletedCommentId: string;
};

type CommentService = {
  create(
    placeId: string,
    input: PlaceCommentInput,
    actor: WorkerPublicWriteActor,
  ): Promise<CommentCreated>;
  delete(
    placeId: string,
    commentId: string,
    actor: WorkerPublicWriteActor,
  ): Promise<CommentDeleted>;
};

function assertHasIdentity(actor: WorkerPublicWriteActor) {
  // 로그인도 visitor 쿠키도 없는 요청은 어떤 코멘트의 작성자도 될 수 없다.
  if (!actor.user && !actor.visitorId) {
    throw new DomainError("FORBIDDEN", "삭제 권한이 없습니다.");
  }
}

export function getCommentService(env: WorkerDatabaseBindings) {
  return selectBackend<CommentService>(
    env,
    {
      database: () => ({
        create: (placeId, input, actor) =>
          withExistingOrNewWorkerDatabaseConnection(env, () =>
            createDatabasePlaceComment(env, placeId, input, actor),
          ),
        async delete(placeId, commentId, actor) {
          assertHasIdentity(actor);

          return withExistingOrNewWorkerDatabaseConnection(env, () =>
            deleteDatabasePlaceComment(env, placeId, commentId, actor),
          );
        },
      }),
      mock: () => ({
        async create(placeId, input, actor) {
          if (!getPlaceById(placeId)) {
            throw new DomainError("NOT_FOUND", "장소를 찾지 못했습니다.");
          }

          const item = {
            id: `vite-comment-${crypto.randomUUID()}`,
            authorLabel: "익명",
            body: input.body,
            createdAt: new Date().toISOString().slice(0, 10),
            canDelete: true,
            ownerVisitorId:
              actor.visitorId ?? `user:${actor.user?.id ?? actor.key}`,
          };

          mockCommentStore.set(placeId, [
            item,
            ...(mockCommentStore.get(placeId) ?? []),
          ]);

          return {
            ok: true,
            message: "코멘트를 등록했습니다.",
            source: "mock",
            mock: true,
            item: {
              id: item.id,
              authorLabel: item.authorLabel,
              body: item.body,
              createdAt: item.createdAt,
              canDelete: item.canDelete,
            },
          };
        },
        async delete(placeId, commentId, actor) {
          assertHasIdentity(actor);

          const comments = mockCommentStore.get(placeId) ?? [];
          const target = comments.find((comment) => comment.id === commentId);

          if (
            !target ||
            !canDeleteComment(
              {
                userId: null,
                role: null,
                visitorId: actor.visitorId,
              },
              { userId: null, visitorId: target.ownerVisitorId },
            )
          ) {
            throw new DomainError("FORBIDDEN", "삭제 권한이 없습니다.");
          }

          mockCommentStore.set(
            placeId,
            comments.filter((comment) => comment.id !== commentId),
          );

          return {
            ok: true,
            message: "코멘트를 삭제했습니다.",
            source: "mock",
            mock: true,
            deletedCommentId: commentId,
          };
        },
      }),
    },
    "코멘트를 저장하지 못했습니다.",
  );
}
