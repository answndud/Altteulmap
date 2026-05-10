import type { AdminReport, ModerationSuggestion } from "@/client/routes/admin/types";

export const reportReasonMap: Record<AdminReport["reasonType"], string> = {
  price_error: "가격 오류",
  duplicate_place: "중복 장소",
  closed_or_wrong_info: "폐업/정보 오류",
  promotional_content: "광고성/부적절 정보",
  other: "기타",
};

export const reportStatusMap: Record<AdminReport["status"], string> = {
  open: "열림",
  reviewing: "검토 중",
  resolved: "처리 완료",
  dismissed: "기각",
};

export const moderationActionMap: Record<
  ModerationSuggestion["suggestedAction"],
  string
> = {
  approve: "승인 권장",
  review: "수동 검토",
  reject: "반려 권장",
};

export function formatKrw(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}
