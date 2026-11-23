/**
 * 가격 제보의 순수 도메인 규칙. DB·HTTP에 의존하지 않아 단위 테스트로 경계값을 고정한다.
 */
type PriceReportStatus = "pending_review" | "accepted" | "rejected";
type VerificationStatus = "verified" | "unverified";

/** 서로 다른 제보자 N명이 같은 가격을 승인받으면 verified로 본다. */
export const VERIFICATION_REPORTER_THRESHOLD = 2;

const ALLOWED_TRANSITIONS: Record<PriceReportStatus, PriceReportStatus[]> = {
  pending_review: ["accepted", "rejected"],
  accepted: [],
  rejected: [],
};

export function canTransitionPriceReport(
  from: PriceReportStatus,
  to: PriceReportStatus,
) {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function decideVerificationStatus(
  distinctAcceptedReporters: number,
): VerificationStatus {
  return distinctAcceptedReporters >= VERIFICATION_REPORTER_THRESHOLD
    ? "verified"
    : "unverified";
}

/** 승인 시 SQL(admin-price-review-repository)의 count(distinct ...)가 같은 규칙을 따른다. 같은 사람이 여러 번 제보해도 1명으로 센다: 회원 > visitor > 제보 자체 순으로 식별한다. */
function getDistinctReporterKey(report: {
  id: string;
  reporterUserId: string | null;
  reporterVisitorId: string | null;
}) {
  return report.reporterUserId ?? report.reporterVisitorId ?? report.id;
}

export function countDistinctReporters(
  reports: Array<{
    id: string;
    reporterUserId: string | null;
    reporterVisitorId: string | null;
  }>,
) {
  return new Set(reports.map(getDistinctReporterKey)).size;
}
