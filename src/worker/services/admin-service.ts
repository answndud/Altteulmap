import { getPlaceById } from "@/features/places/queries";
import type {
  AdminPriceItemUpdateInput,
  PriceReportModerationInput,
} from "@/features/places/write-schema";
import type { ReportModerationInput } from "@/features/reports/schema";
import type { PlaceModerationInput } from "@/features/submission/schema";
import {
  getWorkerAdminPlacePriceDetail,
  listWorkerMockReports,
  listWorkerPendingPlaces,
  listWorkerPendingPriceReports,
  listWorkerReports,
  moderateWorkerPlaceSubmission,
  moderateWorkerPriceReport,
  updateWorkerPriceItem,
  updateWorkerReportStatus,
} from "@/worker/admin/admin-repository";
import {
  withWorkerDatabaseConnection,
  type WorkerDatabaseBindings,
} from "@/worker/db";
import {
  createMockAdminStats,
  getWorkerAdminStats,
  type AdminStats,
} from "@/worker/admin/admin-stats-repository";
import { DomainError } from "@/worker/http/api-error";
import { selectBackend } from "@/worker/services/backend";

type AdminUser = { id: string };
type Pagination = { page: number; limit: number };
type Source = "database" | "mock";
type QueueResult<T> = {
  items: T[];
  count: number;
  page: number;
  limit: number;
  source: Source;
};
type PendingPlaces = Awaited<ReturnType<typeof listWorkerPendingPlaces>>;
type PendingPriceReports = Awaited<
  ReturnType<typeof listWorkerPendingPriceReports>
>;
type ReportList = { items: unknown[]; source: Source };
/** 검수·수정 결과는 route가 그대로 직렬화한다. 실패는 DomainError로 던져진다. */
type ActionResult = { ok: true; message: string; source: Source } & Record<
  string,
  unknown
>;

type AdminService = {
  listPlaces(pagination: Pagination): Promise<QueueResult<PendingPlaces["items"][number]>>;
  findPlace(id: string): Promise<{ item: PendingPlaces["items"][number] | null; source: Source }>;
  moderatePlace(id: string, input: PlaceModerationInput, admin: AdminUser): Promise<ActionResult>;
  listPriceReports(pagination: Pagination): Promise<QueueResult<PendingPriceReports["items"][number]>>;
  moderatePriceReport(id: string, input: PriceReportModerationInput, admin: AdminUser): Promise<ActionResult>;
  getPlacePriceDetail(id: string): Promise<{ item: unknown; source: Source }>;
  updatePriceItem(id: string, input: AdminPriceItemUpdateInput, admin: AdminUser): Promise<ActionResult>;
  listReports(): Promise<ReportList>;
  updateReport(id: string, input: ReportModerationInput, admin: AdminUser): Promise<ActionResult>;
  getStats(): Promise<AdminStats>;
};

/** DB 장애는 503 DomainError로, 의도된 도메인 실패(404·409)는 그대로 전달한다. */
async function inDatabase<T>(
  env: WorkerDatabaseBindings,
  label: string,
  load: () => Promise<T>,
) {
  try {
    return await withWorkerDatabaseConnection(env, load);
  } catch (error) {
    if (error instanceof DomainError) {
      throw error;
    }

    console.error(`Failed to ${label}.`, error);
    throw new DomainError("DATABASE_UNAVAILABLE", `${label}에 실패했습니다.`);
  }
}

const mockNotice = (what: string) =>
  `목업 모드에서는 ${what}가 실제 저장되지 않습니다.`;

export function getAdminService(env: WorkerDatabaseBindings) {
  return selectBackend<AdminService>(
    env,
    {
      database: () => ({
        async listPlaces(pagination) {
          return inDatabase(env, "장소 검토 목록 조회", () =>
            listWorkerPendingPlaces(env, pagination),
          );
        },
        async findPlace(id) {
          const result = await inDatabase(env, "장소 검토 대상 조회", () =>
            listWorkerPendingPlaces(env),
          );

          return {
            item: result.items.find((place) => place.id === id) ?? null,
            source: result.source,
          };
        },
        moderatePlace: (id, input, admin) =>
          inDatabase(env, "장소 검토 처리", () =>
            moderateWorkerPlaceSubmission(env, id, input, admin),
          ) as Promise<ActionResult>,
        listPriceReports: (pagination) =>
          inDatabase(env, "가격 정보 검토 목록 조회", () =>
            listWorkerPendingPriceReports(env, pagination),
          ),
        moderatePriceReport: (id, input, admin) =>
          inDatabase(env, "가격 정보 검토 처리", () =>
            moderateWorkerPriceReport(env, id, input, admin),
          ) as Promise<ActionResult>,
        getPlacePriceDetail: (id) =>
          inDatabase(env, "장소 가격 정보 조회", () =>
            getWorkerAdminPlacePriceDetail(env, id),
          ),
        updatePriceItem: (id, input, admin) =>
          inDatabase(env, "가격 항목 업데이트", () =>
            updateWorkerPriceItem(env, id, input, admin),
          ) as Promise<ActionResult>,
        listReports: () =>
          inDatabase(env, "신고 목록 조회", () => listWorkerReports(env)),
        updateReport: (id, input, admin) =>
          inDatabase(env, "신고 상태 업데이트", () =>
            updateWorkerReportStatus(env, id, input, admin),
          ) as Promise<ActionResult>,
        getStats: () =>
          inDatabase(env, "운영 지표 조회", () => getWorkerAdminStats(env)),
      }),
      mock: () => ({
        async listPlaces(pagination) {
          return { items: [], count: 0, ...pagination, source: "mock" };
        },
        async findPlace() {
          return { item: null, source: "mock" };
        },
        async moderatePlace() {
          return { ok: true, message: mockNotice("장소 검토 결과"), source: "mock", item: null };
        },
        async listPriceReports(pagination) {
          return { items: [], count: 0, ...pagination, source: "mock" };
        },
        async moderatePriceReport() {
          return { ok: true, message: mockNotice("가격 정보 검토 결과"), source: "mock", item: null };
        },
        async getPlacePriceDetail(id) {
          const place = getPlaceById(id);

          return {
            source: "mock",
            item: place
              ? {
                  id: place.id,
                  name: place.name,
                  district: place.district,
                  representativePriceAmount: place.representativePriceAmount,
                  representativePriceLabel: place.representativePriceLabel,
                  verificationStatus: place.verificationStatus,
                  priceItems: place.priceItems.map((item) => ({
                    ...item,
                    verifiedReportCount:
                      item.verificationStatus === "verified" ? 2 : 0,
                    isRepresentative: item.label === place.representativePriceLabel,
                    isActive: true,
                  })),
                }
              : null,
          };
        },
        async updatePriceItem(id, input) {
          return {
            ok: true,
            message: input.isActive
              ? "목업 가격 항목을 업데이트했습니다."
              : "목업 가격 항목을 숨겼습니다.",
            source: "mock",
            item: {
              id,
              label: input.label,
              amount: input.amount,
              unitLabel: input.unitLabel || undefined,
              verificationStatus: input.verificationStatus,
              verifiedReportCount: input.verificationStatus === "verified" ? 2 : 0,
              reportedAt: new Date().toISOString().slice(0, 10),
              isRepresentative: input.isRepresentative,
              isActive: input.isActive,
            },
            placeId: null,
          };
        },
        async listReports() {
          return listWorkerMockReports();
        },
        async updateReport() {
          return { ok: true, message: mockNotice("신고 상태"), source: "mock", item: null };
        },
        async getStats() {
          return createMockAdminStats();
        },
      }),
    },
    "관리자 데이터를 불러오지 못했습니다.",
  );
}
