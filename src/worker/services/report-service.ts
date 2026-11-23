import type { ReportSubmissionInput } from "@/features/reports/schema";
import { withWorkerDatabaseConnection, type WorkerDatabaseBindings } from "@/worker/db";
import type { WorkerPublicWriteActor } from "@/worker/public-write-actor";
import { createDatabaseReportSubmission } from "@/worker/reports-write-repository";
import { selectBackend } from "@/worker/services/backend";

type ReportReceipt = {
  ok: boolean;
  message: string;
  mock: boolean;
  source: "database" | "mock";
  preview: {
    id: string;
    placeId: string;
    placeName: string;
    reasonType: ReportSubmissionInput["reasonType"];
    detail: string;
  };
};

type ReportService = {
  submit(
    input: ReportSubmissionInput,
    actor: WorkerPublicWriteActor,
  ): Promise<ReportReceipt>;
};

export function getReportService(env: WorkerDatabaseBindings) {
  return selectBackend<ReportService>(
    env,
    {
      database: () => ({
        submit: (input: ReportSubmissionInput, actor: WorkerPublicWriteActor) =>
          withWorkerDatabaseConnection(env, () =>
            createDatabaseReportSubmission(env, input, actor),
          ),
      }),
      mock: () => ({
        async submit(input) {
          return {
            ok: true as const,
            message: "신고가 접수되었습니다. 운영 검토 큐에서 바로 확인할 수 있습니다.",
            mock: true,
            source: "mock" as const,
            preview: {
              id: `vite-report-${crypto.randomUUID()}`,
              placeId: input.placeId,
              placeName: input.placeName,
              reasonType: input.reasonType,
              detail: input.detail,
            },
          };
        },
      }),
    },
    "신고를 저장하지 못했습니다.",
  );
}
