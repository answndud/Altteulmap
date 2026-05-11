import { z } from "zod";

export const reportReasonOptions = [
  { value: "price_error", label: "가격 오류" },
  { value: "duplicate_place", label: "중복 장소" },
  { value: "closed_or_wrong_info", label: "폐업/정보 오류" },
  { value: "promotional_content", label: "광고성/부적절 정보" },
  { value: "other", label: "기타" },
] as const;

export const reportReasonMap = Object.fromEntries(
  reportReasonOptions.map((option) => [option.value, option.label]),
) as Record<(typeof reportReasonOptions)[number]["value"], string>;

export const reportModerationSchema = z.object({
  status: z.enum(["open", "reviewing", "resolved", "dismissed"]),
});

export const reportSubmissionSchema = z.object({
  placeId: z.string().trim().min(1, "신고 대상 장소가 필요합니다."),
  placeName: z.string().trim().min(1, "장소 이름이 필요합니다."),
  reasonType: z.enum([
    "price_error",
    "duplicate_place",
    "closed_or_wrong_info",
    "promotional_content",
    "other",
  ]),
  detail: z
    .string()
    .trim()
    .min(5, "상세 설명을 5자 이상 입력해주세요.")
    .max(500, "상세 설명은 500자 이하로 입력해주세요."),
});

export type ReportSubmissionFormInput = z.input<typeof reportSubmissionSchema>;
export type ReportSubmissionInput = z.output<typeof reportSubmissionSchema>;
export type ReportModerationInput = z.output<typeof reportModerationSchema>;
