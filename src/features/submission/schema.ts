import { z } from "zod";

export const placePriceItemInputSchema = z.object({
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
});

export const placeSubmissionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "상호명을 입력해주세요.")
    .max(120, "상호명은 120자 이하로 입력해주세요."),
  businessName: z
    .string()
    .trim()
    .max(120, "사업장 이름은 120자 이하로 입력해주세요.")
    .optional()
    .or(z.literal("")),
  categorySlug: z.string().min(1, "카테고리를 선택해주세요."),
  roadAddress: z
    .string()
    .trim()
    .min(1, "주소를 입력해주세요.")
    .max(255, "주소는 255자 이하로 입력해주세요."),
  district: z
    .string()
    .trim()
    .min(1, "지역 구분을 입력해주세요.")
    .max(80, "지역 구분은 80자 이하로 입력해주세요."),
  note: z
    .string()
    .trim()
    .max(500, "메모는 500자 이하로 입력해주세요.")
    .optional()
    .or(z.literal("")),
  priceItems: z
    .array(placePriceItemInputSchema)
    .min(1, "가격 항목을 최소 1개 이상 입력해주세요."),
});

export type PlaceSubmissionFormInput = z.input<typeof placeSubmissionSchema>;
export type PlaceSubmissionInput = z.output<typeof placeSubmissionSchema>;
