import type { PlacePreviewRecord } from "@/features/places/types";

export function formatKrw(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

export function getVerificationBadgeClassName(
  status: PlacePreviewRecord["verificationStatus"],
) {
  return status === "verified"
    ? "altteulmap-badge altteulmap-badge-success"
    : "altteulmap-badge altteulmap-badge-warning";
}

export function getVerificationLabel(
  status: PlacePreviewRecord["verificationStatus"],
) {
  return status === "verified" ? "확인됨" : "확인 전";
}
