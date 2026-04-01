import { z } from "zod";

export const placeCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(2, "코멘트는 2자 이상 입력해주세요.")
    .max(500, "코멘트는 500자 이하로 입력해주세요."),
});

export const placePriceReportSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "가격 항목명을 입력해주세요.")
    .max(120, "가격 항목명은 120자 이하로 입력해주세요."),
  amount: z.coerce
    .number()
    .int("가격은 정수로 입력해주세요.")
    .positive("가격은 0원보다 커야 합니다.")
    .max(1_000_000, "가격이 너무 큽니다."),
  unitLabel: z
    .string()
    .trim()
    .max(50, "단위는 50자 이하로 입력해주세요.")
    .optional()
    .or(z.literal("")),
  comment: z
    .string()
    .trim()
    .max(500, "메모는 500자 이하로 입력해주세요.")
    .optional()
    .or(z.literal("")),
});

export const priceReportModerationSchema = z.object({
  decision: z.enum(["approve", "reject"]),
});

export const adminPriceItemUpdateSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "가격 항목명을 입력해주세요.")
    .max(120, "가격 항목명은 120자 이하로 입력해주세요."),
  amount: z.coerce
    .number()
    .int("가격은 정수로 입력해주세요.")
    .positive("가격은 0원보다 커야 합니다.")
    .max(1_000_000, "가격이 너무 큽니다."),
  unitLabel: z
    .string()
    .trim()
    .max(50, "단위는 50자 이하로 입력해주세요.")
    .optional()
    .or(z.literal("")),
  verificationStatus: z.enum(["verified", "unverified"]),
  isRepresentative: z.boolean(),
  isActive: z.boolean(),
});

export type PlaceCommentInput = z.output<typeof placeCommentSchema>;
export type PlacePriceReportInput = z.output<typeof placePriceReportSchema>;
export type PriceReportModerationInput = z.output<
  typeof priceReportModerationSchema
>;
export type AdminPriceItemUpdateInput = z.output<
  typeof adminPriceItemUpdateSchema
>;
