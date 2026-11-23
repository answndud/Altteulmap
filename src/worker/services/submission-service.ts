import type { PlaceSubmissionInput } from "@/features/submission/schema";
import { withWorkerDatabaseConnection, type WorkerDatabaseBindings } from "@/worker/db";
import type { WorkerPublicWriteActor } from "@/worker/abuse/public-write-actor";
import { createDatabasePlaceSubmission } from "@/worker/places/places-write-submissions-repository";
import { selectBackend } from "@/worker/services/backend";

type SubmissionReceipt = {
  ok: boolean;
  message: string;
  mock: boolean;
  source: "database" | "mock";
  preview: {
    id: string;
    name: string;
    categorySlug: string;
    roadAddress: string;
    district: string;
    priceItems: PlaceSubmissionInput["priceItems"];
  };
};

type SubmissionService = {
  submit(
    input: PlaceSubmissionInput,
    actor: WorkerPublicWriteActor,
  ): Promise<SubmissionReceipt>;
};

export function getSubmissionService(env: WorkerDatabaseBindings) {
  return selectBackend<SubmissionService>(
    env,
    {
      database: () => ({
        submit: (input: PlaceSubmissionInput, actor: WorkerPublicWriteActor) =>
          withWorkerDatabaseConnection(env, () =>
            createDatabasePlaceSubmission(env, input, actor),
          ),
      }),
      mock: () => ({
        async submit(input) {
          return {
            ok: true as const,
            message: "장소 등록 요청이 접수되었습니다. 검토 후 공개 목록에 반영됩니다.",
            mock: true,
            source: "mock" as const,
            preview: {
              id: `vite-submission-${crypto.randomUUID()}`,
              name: input.name,
              categorySlug: input.categorySlug,
              roadAddress: input.roadAddress,
              district: input.district,
              priceItems: input.priceItems,
            },
          };
        },
      }),
    },
    "장소 등록 요청을 저장하지 못했습니다.",
  );
}
