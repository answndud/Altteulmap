import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb, isDatabaseEnabled } from "@/db/client";
import { moderationSuggestions } from "@/db/schema";
import type {
  ModerationSuggestionAction,
  ModerationSuggestionRecord,
  ModerationSuggestionSubjectType,
} from "@/features/admin/moderation-suggestion";
import type { ReportSubmissionInput } from "@/features/reports/schema";

type SuggestionPersistenceInput = Omit<ModerationSuggestionRecord, "generatedAt">;

type PlaceSuggestionInput = {
  subjectKey: string;
  name: string;
  address: string;
  district: string;
  note: string;
  representativePriceAmount: number;
  representativePriceLabel: string;
  priceItems: Array<{
    label: string;
    amount: number;
    unitLabel?: string;
  }>;
};

type PriceReportSuggestionInput = {
  subjectKey: string;
  placeName: string;
  label: string;
  amount: number;
  unitLabel?: string;
  comment?: string;
  existingPriceLabel?: string;
  existingPriceAmount?: number;
  existingPriceUnitLabel?: string;
};

type ContentReportSuggestionInput = {
  subjectKey: string;
  placeName: string;
  reasonType: ReportSubmissionInput["reasonType"];
  detail: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
};

const generatedAtFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatGeneratedAt(value: Date) {
  return generatedAtFormatter.format(value).replace(",", "");
}

function clampConfidence(value: number) {
  return Math.max(1, Math.min(99, Math.round(value)));
}

function formatKrw(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

function toSuggestionRecord(
  row: SuggestionPersistenceInput & { generatedAt: Date },
): ModerationSuggestionRecord {
  return {
    subjectType: row.subjectType,
    subjectKey: row.subjectKey,
    provider: row.provider,
    suggestedAction: row.suggestedAction,
    confidence: row.confidence,
    summary: row.summary,
    checks: row.checks,
    flags: row.flags,
    generatedAt: formatGeneratedAt(row.generatedAt),
  };
}

function buildPlaceSuggestion(
  input: PlaceSuggestionInput,
): SuggestionPersistenceInput {
  const checks: string[] = [];
  const flags: string[] = [];
  let score = 52;
  const districtToken = input.district.trim().split(" ").at(-1) ?? "";

  if (input.address.trim().length >= 10) {
    checks.push("주소 정보가 충분해 운영자가 지도에서 재확인하기 쉽습니다.");
    score += 10;
  } else {
    flags.push("주소가 짧아 지도 검색 결과를 직접 대조해야 합니다.");
    score -= 24;
  }

  if (districtToken && input.address.includes(districtToken)) {
    checks.push("행정구역 표기가 주소와 크게 어긋나지 않습니다.");
    score += 8;
  } else {
    flags.push("행정구역과 주소 표기가 맞는지 한 번 더 확인하세요.");
    score -= 6;
  }

  if (input.priceItems.length > 0) {
    checks.push(`제출된 가격 항목 ${input.priceItems.length}개가 있어 기준 메뉴를 잡을 수 있습니다.`);
    score += 10;
  } else {
    flags.push("가격 항목이 없어 공개 반영 기준이 부족합니다.");
    score -= 34;
  }

  if (input.representativePriceAmount > 0 && input.representativePriceAmount < 100_000) {
    checks.push(
      `대표 가격이 ${formatKrw(input.representativePriceAmount)}원으로 비정상 범위는 아닙니다.`,
    );
    score += 12;
  } else {
    flags.push("대표 가격이 비어 있거나 비정상 범위라 추가 확인이 필요합니다.");
    score -= 30;
  }

  if (input.note.trim().length >= 12) {
    checks.push("제출 메모가 비교적 구체적이라 운영 확인 맥락이 있습니다.");
    score += 8;
  } else if (input.note.trim().length > 0) {
    flags.push("메모가 짧아 승인 근거는 구조화된 입력에 더 의존해야 합니다.");
    score -= 3;
  } else {
    flags.push("운영 확인용 메모가 거의 없어 추가 검색이 필요합니다.");
    score -= 8;
  }

  let suggestedAction: ModerationSuggestionAction = "review";

  if (
    input.address.trim().length < 6 ||
    input.representativePriceAmount <= 0 ||
    input.priceItems.length === 0
  ) {
    suggestedAction = "reject";
  } else if (score >= 76) {
    suggestedAction = "approve";
  } else {
    suggestedAction = "review";
  }

  const summary =
    suggestedAction === "approve"
      ? `${input.name} 제보는 주소와 가격 입력이 비교적 선명해 승인 후보로 볼 수 있습니다.`
      : suggestedAction === "reject"
        ? `${input.name} 제보는 공개 반영 전에 핵심 입력 누락 여부를 먼저 정리해야 합니다.`
        : `${input.name} 제보는 구조화된 입력은 있으나 지도 검색과 추가 확인이 더 필요합니다.`;

  return {
    subjectType: "place_submission",
    subjectKey: input.subjectKey,
    provider: "local_rule_agent",
    suggestedAction,
    confidence: clampConfidence(score),
    summary,
    checks,
    flags,
  };
}

function buildPriceReportSuggestion(
  input: PriceReportSuggestionInput,
): SuggestionPersistenceInput {
  const checks: string[] = [];
  const flags: string[] = [];
  let score = 54;

  if (input.amount > 0 && input.amount < 100_000) {
    checks.push(`제보 가격 ${formatKrw(input.amount)}원은 입력 범위상 비정상값은 아닙니다.`);
    score += 10;
  } else {
    flags.push("제보 가격이 비정상 범위라 바로 반영하기 어렵습니다.");
    score -= 36;
  }

  if (input.comment?.trim()) {
    if (input.comment.trim().length >= 10) {
      checks.push("가격 변동 메모가 있어 변경 이유를 추적하기 쉽습니다.");
      score += 10;
    } else {
      flags.push("메모가 짧아 실제 가격 변동 근거는 추가 확인이 필요합니다.");
      score -= 3;
    }
  } else {
    flags.push("메모가 없어 현장 가격표 또는 재제보 확인이 필요할 수 있습니다.");
    score -= 8;
  }

  if (typeof input.existingPriceAmount === "number" && input.existingPriceAmount > 0) {
    const diffRatio =
      Math.abs(input.amount - input.existingPriceAmount) / input.existingPriceAmount;

    if (diffRatio <= 0.15) {
      checks.push("기존 가격과 차이가 작아 즉시 승인 후보에 가깝습니다.");
      score += 18;
    } else if (diffRatio <= 0.35) {
      flags.push("기존 가격과 차이가 있어 최근 변동 여부를 한 번 더 보는 편이 안전합니다.");
      score += 4;
    } else {
      flags.push("기존 가격과 차이가 커 추가 검증 없이 바로 반영하기엔 위험합니다.");
      score -= 14;
    }
  } else {
    flags.push("같은 이름의 기존 가격 항목이 없어 새 항목 처리 여부를 확인해야 합니다.");
    score -= 4;
  }

  let suggestedAction: ModerationSuggestionAction = "review";

  if (input.amount <= 0 || input.amount >= 100_000) {
    suggestedAction = "reject";
  } else if (score >= 76) {
    suggestedAction = "approve";
  } else {
    suggestedAction = "review";
  }

  const summary =
    suggestedAction === "approve"
      ? `${input.placeName}의 ${input.label} 가격 제보는 기존 값과의 차이가 작아 승인 후보입니다.`
      : suggestedAction === "reject"
        ? `${input.placeName}의 ${input.label} 가격 제보는 입력값 이상 여부를 먼저 정리해야 합니다.`
        : `${input.placeName}의 ${input.label} 가격 제보는 기존 가격 또는 메모 기준으로 추가 확인이 필요합니다.`;

  return {
    subjectType: "price_report",
    subjectKey: input.subjectKey,
    provider: "local_rule_agent",
    suggestedAction,
    confidence: clampConfidence(score),
    summary,
    checks,
    flags,
  };
}

function buildContentReportSuggestion(
  input: ContentReportSuggestionInput,
): SuggestionPersistenceInput {
  const checks: string[] = [];
  const flags: string[] = [];
  let score = 48;
  const normalizedDetail = input.detail.trim();

  if (normalizedDetail.length >= 20) {
    checks.push("신고 상세가 비교적 구체적이라 재현 단서를 확보하기 쉽습니다.");
    score += 14;
  } else if (normalizedDetail.length >= 10) {
    checks.push("신고 상세가 짧지만 이유를 파악할 최소 정보는 있습니다.");
    score += 6;
  } else {
    flags.push("신고 상세가 짧아 재현보다 추가 확인이 먼저 필요합니다.");
    score -= 16;
  }

  switch (input.reasonType) {
    case "price_error":
      if (/\d|원|가격/.test(normalizedDetail)) {
        checks.push("가격 오류 사유와 맞는 단서가 상세 설명에 포함돼 있습니다.");
        score += 16;
      } else {
        flags.push("가격 오류 신고지만 실제 가격 단서가 부족합니다.");
        score -= 4;
      }
      break;
    case "duplicate_place":
      if (/중복|같은|두 번|중복된/.test(normalizedDetail)) {
        checks.push("중복 장소 신고 맥락이 설명에 드러납니다.");
        score += 12;
      } else {
        flags.push("중복 여부를 판단할 위치 설명이 더 있으면 좋습니다.");
        score -= 3;
      }
      break;
    case "closed_or_wrong_info":
      if (/폐업|영업|시간|주소|정보/.test(normalizedDetail)) {
        checks.push("폐업 또는 정보 오류와 연결되는 표현이 들어 있습니다.");
        score += 8;
      } else {
        flags.push("정보 오류 신고지만 어떤 정보가 틀렸는지 더 구체화가 필요합니다.");
        score -= 4;
      }
      break;
    case "promotional_content":
      if (/광고|홍보|도배|전화|링크/.test(normalizedDetail)) {
        checks.push("광고성 신고와 맞는 표현이 설명에 포함돼 있습니다.");
        score += 16;
      } else {
        checks.push("광고성 신고는 운영자가 상세 페이지 문맥과 함께 빠르게 확인할 수 있습니다.");
        score += 8;
      }
      break;
    case "other":
      flags.push("기타 신고는 운영자가 상세 문맥을 직접 읽고 판단해야 합니다.");
      score -= 2;
      break;
  }

  let suggestedAction: ModerationSuggestionAction = "review";

  if (normalizedDetail.length < 8) {
    suggestedAction = "reject";
  } else if (
    input.reasonType === "price_error" ||
    input.reasonType === "promotional_content"
  ) {
    suggestedAction = score >= 68 ? "approve" : "review";
  } else if (input.reasonType === "other") {
    suggestedAction = "review";
  } else {
    suggestedAction = score >= 72 ? "approve" : "review";
  }

  const summary =
    suggestedAction === "approve"
      ? `${input.placeName} 신고는 현재 설명 기준으로 바로 처리 방향을 정하기 쉬운 편입니다.`
      : suggestedAction === "reject"
        ? `${input.placeName} 신고는 상세 설명이 너무 짧아 기각 또는 보류 쪽 검토가 필요합니다.`
        : `${input.placeName} 신고는 상태를 바꾸기 전에 상세 페이지 재현과 추가 확인이 권장됩니다.`;

  return {
    subjectType: "content_report",
    subjectKey: input.subjectKey,
    provider: "local_rule_agent",
    suggestedAction,
    confidence: clampConfidence(score),
    summary,
    checks,
    flags,
  };
}

async function getExistingSuggestionMap(
  subjectType: ModerationSuggestionSubjectType,
  subjectKeys: string[],
) {
  if (!isDatabaseEnabled() || subjectKeys.length === 0) {
    return new Map<string, ModerationSuggestionRecord>();
  }

  const db = getDb();
  const rows = await db
    .select({
      subjectType: moderationSuggestions.subjectType,
      subjectKey: moderationSuggestions.subjectKey,
      provider: moderationSuggestions.provider,
      suggestedAction: moderationSuggestions.suggestedAction,
      confidence: moderationSuggestions.confidence,
      summary: moderationSuggestions.summary,
      checks: moderationSuggestions.checks,
      flags: moderationSuggestions.flags,
      generatedAt: moderationSuggestions.updatedAt,
    })
    .from(moderationSuggestions)
    .where(
      and(
        eq(moderationSuggestions.subjectType, subjectType),
        inArray(moderationSuggestions.subjectKey, subjectKeys),
      ),
    );

  return new Map(
    rows.map((row) => [
      row.subjectKey,
      toSuggestionRecord({
        ...row,
        checks: row.checks ?? [],
        flags: row.flags ?? [],
      }),
    ]),
  );
}

async function persistGeneratedSuggestions(
  suggestions: SuggestionPersistenceInput[],
  generatedAt: Date,
) {
  if (!isDatabaseEnabled() || suggestions.length === 0) {
    return;
  }

  const db = getDb();
  await db
    .insert(moderationSuggestions)
    .values(
      suggestions.map((suggestion) => ({
        subjectType: suggestion.subjectType,
        subjectKey: suggestion.subjectKey,
        provider: suggestion.provider,
        suggestedAction: suggestion.suggestedAction,
        confidence: suggestion.confidence,
        summary: suggestion.summary,
        checks: suggestion.checks,
        flags: suggestion.flags,
        createdAt: generatedAt,
        updatedAt: generatedAt,
      })),
    )
    .onConflictDoUpdate({
      target: [
        moderationSuggestions.subjectType,
        moderationSuggestions.subjectKey,
      ],
      set: {
        provider: sql`excluded.provider`,
        suggestedAction: sql`excluded.suggested_action`,
        confidence: sql`excluded.confidence`,
        summary: sql`excluded.summary`,
        checks: sql`excluded.checks`,
        flags: sql`excluded.flags`,
        updatedAt: generatedAt,
      },
    });
}

async function ensureSuggestions<T extends { subjectKey: string }>(
  subjectType: ModerationSuggestionSubjectType,
  items: T[],
  buildSuggestion: (item: T) => SuggestionPersistenceInput,
) {
  const subjectKeys = items.map((item) => item.subjectKey);
  const existingMap = await getExistingSuggestionMap(subjectType, subjectKeys);
  const generatedAt = new Date();
  const missingItems = items.filter((item) => !existingMap.has(item.subjectKey));
  const generatedSuggestions = missingItems.map(buildSuggestion);

  await persistGeneratedSuggestions(generatedSuggestions, generatedAt);

  for (const suggestion of generatedSuggestions) {
    existingMap.set(
      suggestion.subjectKey,
      toSuggestionRecord({
        ...suggestion,
        generatedAt,
      }),
    );
  }

  return existingMap;
}

export async function ensurePlaceModerationSuggestions(
  items: PlaceSuggestionInput[],
) {
  if (!isDatabaseEnabled()) {
    return new Map(
      items.map((item) => {
        const generatedAt = new Date();

        return [
          item.subjectKey,
          toSuggestionRecord({
            ...buildPlaceSuggestion(item),
            generatedAt,
          }),
        ];
      }),
    );
  }

  return ensureSuggestions("place_submission", items, buildPlaceSuggestion);
}

export async function ensurePriceReportModerationSuggestions(
  items: PriceReportSuggestionInput[],
) {
  if (!isDatabaseEnabled()) {
    return new Map(
      items.map((item) => {
        const generatedAt = new Date();

        return [
          item.subjectKey,
          toSuggestionRecord({
            ...buildPriceReportSuggestion(item),
            generatedAt,
          }),
        ];
      }),
    );
  }

  return ensureSuggestions("price_report", items, buildPriceReportSuggestion);
}

export async function ensureContentReportModerationSuggestions(
  items: ContentReportSuggestionInput[],
) {
  if (!isDatabaseEnabled()) {
    return new Map(
      items.map((item) => {
        const generatedAt = new Date();

        return [
          item.subjectKey,
          toSuggestionRecord({
            ...buildContentReportSuggestion(item),
            generatedAt,
          }),
        ];
      }),
    );
  }

  return ensureSuggestions("content_report", items, buildContentReportSuggestion);
}
