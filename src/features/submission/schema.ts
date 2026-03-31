import { z } from "zod";

import { normalizePriceLabel } from "@/features/places/normalization";

const optionalLatitudeSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce
    .number()
    .min(-90, "위도 범위가 올바르지 않습니다.")
    .max(90, "위도 범위가 올바르지 않습니다.")
    .optional(),
);

const optionalLongitudeSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce
    .number()
    .min(-180, "경도 범위가 올바르지 않습니다.")
    .max(180, "경도 범위가 올바르지 않습니다.")
    .optional(),
);

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
  latitude: optionalLatitudeSchema,
  longitude: optionalLongitudeSchema,
  note: z
    .string()
    .trim()
    .max(500, "메모는 500자 이하로 입력해주세요.")
    .optional()
    .or(z.literal("")),
  priceItems: z
    .array(placePriceItemInputSchema)
    .min(1, "가격 항목을 최소 1개 이상 입력해주세요."),
}).superRefine((value, context) => {
  const seenLabels = new Set<string>();

  value.priceItems.forEach((item, index) => {
    const normalizedLabel = normalizePriceLabel(item.label);

    if (seenLabels.has(normalizedLabel)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "같은 가격 항목명은 한 번만 입력해주세요.",
        path: ["priceItems", index, "label"],
      });
      return;
    }

    seenLabels.add(normalizedLabel);
  });

  const hasLatitude = typeof value.latitude === "number";
  const hasLongitude = typeof value.longitude === "number";

  if (hasLatitude !== hasLongitude) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "위도와 경도는 함께 입력해주세요.",
      path: [hasLatitude ? "longitude" : "latitude"],
    });
  }
});

export const placeModerationSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
  })
  .superRefine((value, context) => {
    if (value.decision === "approve") {
      if (typeof value.latitude !== "number") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "승인하려면 위도를 입력해주세요.",
          path: ["latitude"],
        });
      }

      if (typeof value.longitude !== "number") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "승인하려면 경도를 입력해주세요.",
          path: ["longitude"],
        });
      }
    }
  });

export type PlaceSubmissionFormInput = z.input<typeof placeSubmissionSchema>;
export type PlaceSubmissionInput = z.output<typeof placeSubmissionSchema>;
export type PlaceModerationInput = z.output<typeof placeModerationSchema>;
