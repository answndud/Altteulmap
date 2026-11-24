import type { PlaceReactionType } from "@/features/places/types";
import { getPlaceById } from "@/features/places/queries";
import {
  withExistingOrNewWorkerDatabaseConnection,
  type WorkerDatabaseBindings,
} from "@/worker/db";
import { DomainError } from "@/worker/http/api-error";
import { setDatabasePlaceReaction } from "@/worker/places/places-write-reactions-repository";
import type { WorkerPublicWriteActor } from "@/worker/abuse/public-write-actor";
import {
  getMockReactionSummary,
  getPlaceReactionMessage,
  getWorkerReactionActorKey,
  mockReactionStore,
} from "@/worker/routes/public-write-support";
import { selectBackend } from "@/worker/services/backend";

type ReactionResult = {
  ok: boolean;
  source: "database" | "mock";
  reaction: PlaceReactionType | null;
  likeCount: number;
  dislikeCount: number;
  message: string;
  placeId: string;
};

type ReactionService = {
  set(
    placeId: string,
    reaction: PlaceReactionType | null,
    actor: WorkerPublicWriteActor,
  ): Promise<ReactionResult>;
};

export function getReactionService(env: WorkerDatabaseBindings) {
  return selectBackend<ReactionService>(
    env,
    {
      database: () => ({
        set: (placeId, reaction, actor) =>
          withExistingOrNewWorkerDatabaseConnection(env, () =>
            setDatabasePlaceReaction(env, placeId, reaction, actor),
          ),
      }),
      mock: () => ({
        async set(placeId, reaction, actor) {
          const place = getPlaceById(placeId);

          if (!place) {
            throw new DomainError("NOT_FOUND", "장소를 찾지 못했습니다.");
          }

          const actorKey = getWorkerReactionActorKey(placeId, actor);

          if (reaction) {
            mockReactionStore.set(actorKey, reaction);
          } else {
            mockReactionStore.delete(actorKey);
          }

          const summary = getMockReactionSummary(placeId, actor);

          return {
            ok: true,
            source: "mock",
            reaction: summary.viewerReaction,
            likeCount: place.likeCount + summary.likeCount,
            dislikeCount: place.dislikeCount + summary.dislikeCount,
            message: getPlaceReactionMessage(summary.viewerReaction),
            placeId,
          };
        },
      }),
    },
    "장소 반응을 저장하지 못했습니다.",
  );
}
