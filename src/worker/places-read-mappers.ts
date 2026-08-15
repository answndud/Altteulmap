import type {
  PlaceComment,
  PlaceHistoryEntry,
  PlacePreviewRecord,
  PlacePriceItem,
  PlaceReactionType,
  PlaceRecord,
  PlaceSort,
} from "@/features/places/types";
import type { DatabasePlaceRow } from "@/worker/places-read-types";

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
});

export function sortPlacePreviewRecords(
  items: PlacePreviewRecord[],
  sort: PlaceSort,
) {
  return [...items].sort((left, right) => {
    if (sort === "recent") {
      return (
        new Date(right.lastPriceUpdatedAt).getTime() -
        new Date(left.lastPriceUpdatedAt).getTime()
      );
    }

    return left.representativePriceAmount - right.representativePriceAmount;
  });
}

export function formatDate(value: Date | string | null) {
  if (!value) {
    return "";
  }

  const normalized = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(normalized.getTime())) {
    return "";
  }

  return dateFormatter.format(normalized);
}

export function toAuthorLabel(
  nickname: string | null,
  email: string | null,
  fallback: string,
) {
  if (nickname) {
    return nickname;
  }

  if (email) {
    return email.split("@")[0];
  }

  return fallback;
}

export function toPlacePreviewRecord(
  row: DatabasePlaceRow,
  reactionSummary?: {
    likeCount: number;
    dislikeCount: number;
    viewerReaction: PlaceReactionType | null;
  },
): PlacePreviewRecord {
  const resolvedReactionSummary = reactionSummary ?? {
    likeCount: row.likeCount,
    dislikeCount: row.dislikeCount,
    viewerReaction: null,
  };

  return {
    id: row.slug,
    name: row.name,
    businessName: row.businessName ?? undefined,
    categorySlug: row.primaryCategorySlug ?? "other-service",
    address: row.roadAddress,
    district: row.district,
    latitude: row.latitude ?? 37.5665,
    longitude: row.longitude ?? 126.978,
    representativePriceAmount: row.representativePriceAmount ?? 0,
    representativePriceLabel: row.representativePriceLabel ?? "가격 정보 준비 중",
    verificationStatus:
      row.verifiedPriceItemCount > 0 ? "verified" : "unverified",
    lastPriceUpdatedAt: formatDate(row.lastPriceUpdatedAt),
    description:
      row.description ??
      "아직 장소 설명이 등록되지 않았습니다. 이후 정보가 쌓이면 내용을 보강할 수 있습니다.",
    note:
      row.note ??
      "운영 검토 전 단계이거나 추가 메모가 아직 등록되지 않았습니다.",
    likeCount: resolvedReactionSummary.likeCount,
    dislikeCount: resolvedReactionSummary.dislikeCount,
    viewerReaction: resolvedReactionSummary.viewerReaction,
  };
}

export function toPlaceRecord(
  row: DatabasePlaceRow,
  detail?: {
    comments?: PlaceComment[];
    history?: PlaceHistoryEntry[];
    priceItems?: PlacePriceItem[];
    reactionSummary?: {
      likeCount: number;
      dislikeCount: number;
      viewerReaction: PlaceReactionType | null;
    };
  },
): PlaceRecord {
  return {
    ...toPlacePreviewRecord(row, detail?.reactionSummary),
    priceItems: detail?.priceItems ?? [],
    history: detail?.history ?? [],
    comments: detail?.comments ?? [],
  };
}

export function toPlacePreviewRecords(rows: DatabasePlaceRow[]) {
  return rows
    .map((row) => toPlacePreviewRecord(row))
    .filter(
      (place) =>
        Number.isFinite(place.latitude) && Number.isFinite(place.longitude),
    );
}
