import { normalizePriceLabel } from "@/features/places/normalization";
import type { PlacePriceReportInput } from "@/features/places/write-schema";
import { DomainError } from "@/worker/http/api-error";
import type { WorkerPublicWriteActor } from "@/worker/abuse/public-write-actor";
import { getPriceReportSubmissionKey } from "@/worker/places/price-report-identity";

export type PriceReportPlace = {
  id: string;
  slug: string;
  name: string;
};

export type NewPriceReport = {
  placeId: string;
  submissionKey: string;
  label: string;
  normalizedLabel: string;
  amount: number;
  unitLabel: string | null;
  comment: string | null;
  actor: WorkerPublicWriteActor;
};

/** 저장소 경계. DB 구현과 mock 구현, 테스트용 in-memory fake가 같은 계약을 따른다. */
export type PriceReportStore = {
  readonly source: "database" | "mock";
  findActivePlace(slug: string): Promise<PriceReportPlace | null>;
  /** submissionKey가 이미 있으면 새로 만들지 않고 기존 제보의 id를 돌려준다(멱등). */
  createIfAbsent(report: NewPriceReport): Promise<{ id: string }>;
};

type SubmitPriceReportResult = {
  ok: true;
  message: string;
  source: "database" | "mock";
  mock: boolean;
  item: {
    id: string;
    placeId: string;
    placeName: string;
    label: string;
    amount: number;
    unitLabel?: string;
    comment?: string;
  };
};

export function createPriceReportService(store: PriceReportStore) {
  return {
    async submit(
      placeSlug: string,
      input: PlacePriceReportInput,
      actor: WorkerPublicWriteActor,
    ): Promise<SubmitPriceReportResult> {
      const place = await store.findActivePlace(placeSlug);

      if (!place) {
        throw new DomainError("NOT_FOUND", "장소를 찾지 못했습니다.");
      }

      const normalizedLabel = normalizePriceLabel(input.label);
      const unitLabel = input.unitLabel || null;
      // 같은 사람이 같은 장소·메뉴·가격·단위를 다시 보내도 한 건만 남도록 키를 만든다.
      const submissionKey = getPriceReportSubmissionKey(
        place.id,
        actor,
        normalizedLabel,
        input.amount,
        unitLabel,
      );
      const report = await store.createIfAbsent({
        placeId: place.id,
        submissionKey,
        label: input.label,
        normalizedLabel,
        amount: input.amount,
        unitLabel,
        comment: input.comment || null,
        actor,
      });

      return {
        ok: true,
        message: "가격 정보가 등록되었습니다. 확인 후 상세 화면에 반영됩니다.",
        source: store.source,
        mock: store.source === "mock",
        item: {
          id: report.id,
          placeId: place.slug,
          placeName: place.name,
          label: input.label,
          amount: input.amount,
          unitLabel: unitLabel ?? undefined,
          comment: input.comment || undefined,
        },
      };
    },
  };
}
