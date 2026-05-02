"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactNode, useState, useTransition } from "react";
import {
  type UseFormRegister,
  useFieldArray,
  useForm,
} from "react-hook-form";

import { FieldError, ResultMessage } from "@/components/form-feedback";
import { categoryGroups } from "@/features/categories/catalog";
import {
  type PlaceSubmissionFormInput,
  type PlaceSubmissionFormValues,
  placeSubmissionFormSchema,
} from "@/features/submission/schema";
import { getRateLimitFeedbackMessage } from "@/lib/rate-limit-feedback";

type SubmitResult = {
  ok: boolean;
  message: string;
  retryAfterMs?: number;
  source?: "mock" | "database";
  preview?: {
    id: string;
    name: string;
    categorySlug: string;
    roadAddress: string;
    district: string;
    priceItems: Array<{
      label: string;
      amount: number;
      unitLabel?: string;
    }>;
  };
  mock?: boolean;
};

const defaultValues: PlaceSubmissionFormInput = {
  name: "",
  categorySlug: "",
  roadAddress: "",
  district: "",
  note: "",
  priceItems: [
    {
      label: "",
      amount: undefined,
      unitLabel: "",
    },
  ],
};

type PriceItemFieldsProps = {
  amountError?: string;
  isPrimary?: boolean;
  isPending: boolean;
  labelError?: string;
  onRemove?: () => void;
  register: UseFormRegister<PlaceSubmissionFormInput>;
  unitError?: string;
  index: number;
};

type FormStepHeaderProps = {
  step: string;
  title: string;
  description?: string;
  action?: ReactNode;
};

function FormStepHeader({
  step,
  title,
  description,
  action,
}: FormStepHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.65rem] border border-[var(--altteul-primary-border)] bg-[var(--altteul-primary-soft)] text-sm font-semibold text-[var(--altteul-primary-text)]">
          {step}
        </span>
        <div className="grid gap-1">
          <h2 className="text-base font-semibold text-[var(--altteul-text-strong)]">{title}</h2>
          {description ? (
            <p className="text-sm leading-6 text-[var(--altteul-text-tertiary)]">{description}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

function PriceItemFields({
  amountError,
  isPrimary = false,
  isPending,
  labelError,
  onRemove,
  register,
  unitError,
  index,
}: PriceItemFieldsProps) {
  const gridClassName = isPrimary
    ? "md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.85fr)]"
    : "md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.8fr)_minmax(0,0.75fr)_auto]";

  return (
    <div className={`grid gap-3 ${gridClassName}`}>
      <label className="grid min-w-0 gap-2 text-sm text-[var(--altteul-text-primary)]">
        항목명
        <input
          {...register(`priceItems.${index}.label`)}
          data-testid={`submit-price-label-${index}`}
          className="altteulmap-input px-4 py-3.5 text-sm"
          placeholder={isPrimary ? "예: 김치찌개, 기본 세탁" : "추가 가격 항목"}
          disabled={isPending}
        />
        <FieldError>{labelError}</FieldError>
      </label>

      <label className="grid min-w-0 gap-2 text-sm text-[var(--altteul-text-primary)]">
        가격
        <input
          type="number"
          {...register(`priceItems.${index}.amount`)}
          data-testid={`submit-price-amount-${index}`}
          className="altteulmap-input px-4 py-3.5 text-sm"
          placeholder="7000"
          disabled={isPending}
        />
        <FieldError>{amountError}</FieldError>
      </label>

      <label className="grid min-w-0 gap-2 text-sm text-[var(--altteul-text-primary)]">
        단위
        <input
          {...register(`priceItems.${index}.unitLabel`)}
          data-testid={`submit-price-unit-${index}`}
          className="altteulmap-input px-4 py-3.5 text-sm"
          placeholder="예: 1인분, 1회"
          disabled={isPending}
        />
        <FieldError>{unitError}</FieldError>
      </label>

      {onRemove ? (
        <div className="flex items-end">
          <button
            type="button"
            onClick={onRemove}
            className="altteulmap-button inline-flex h-12 items-center justify-center whitespace-nowrap px-4 text-sm font-medium"
            disabled={isPending}
          >
            삭제
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function PlaceSubmitForm() {
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<
    PlaceSubmissionFormInput,
    undefined,
    PlaceSubmissionFormValues
  >({
    resolver: zodResolver(placeSubmissionFormSchema),
    defaultValues,
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "priceItems",
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      setSubmitResult(null);

      const response = await fetch("/api/places", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = (await response.json()) as SubmitResult;
      setSubmitResult({
        ...result,
        message: getRateLimitFeedbackMessage({
          response,
          message: result.message,
          retryAfterMs: result.retryAfterMs,
          defaultMessage: "장소 등록 요청이 너무 빠릅니다.",
        }),
      });
    });
  });

  const primaryPriceField = fields[0];
  const additionalPriceFields = fields.slice(1);

  return (
    <div className={submitResult ? "grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_22rem]" : "grid gap-6"}>
      <form
        onSubmit={onSubmit}
        data-testid="place-submit-form"
        className="altteulmap-panel p-5 sm:p-6"
      >
        <div className="grid gap-7">
          <section className="grid gap-4">
            <FormStepHeader
              step="1"
              title="장소 정보"
              description="이름, 카테고리, 주소를 먼저 적어주세요."
            />

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <label className="grid min-w-0 gap-2 text-sm text-[var(--altteul-text-primary)]">
                업장/장소 이름
                <input
                  {...register("name")}
                  data-testid="submit-name"
                  className="altteulmap-input px-4 py-3.5 text-sm"
                  placeholder="예: 학교앞김밥, 성북청년밥집"
                  disabled={isPending}
                />
                <FieldError>{errors.name?.message}</FieldError>
              </label>

              <label className="grid min-w-0 gap-2 text-sm text-[var(--altteul-text-primary)]">
                카테고리
                <select
                  {...register("categorySlug")}
                  data-testid="submit-category"
                  className="altteulmap-input px-4 py-3.5 text-sm"
                  disabled={isPending}
                >
                  <option value="">카테고리 선택</option>
                  {categoryGroups.map((group) => (
                    <optgroup key={group.slug} label={group.name}>
                      {group.children.map((category) => (
                        <option key={category.slug} value={category.slug}>
                          {category.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <FieldError>{errors.categorySlug?.message}</FieldError>
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <label className="grid min-w-0 gap-2 text-sm text-[var(--altteul-text-primary)]">
                지역 구분
                <input
                  {...register("district")}
                  data-testid="submit-district"
                  className="altteulmap-input px-4 py-3.5 text-sm"
                  placeholder="예: 서울 성북구"
                  disabled={isPending}
                />
                <FieldError>{errors.district?.message}</FieldError>
              </label>

              <label className="grid min-w-0 gap-2 text-sm text-[var(--altteul-text-primary)]">
                업장 주소
                <input
                  {...register("roadAddress")}
                  data-testid="submit-road-address"
                  className="altteulmap-input px-4 py-3.5 text-sm"
                  placeholder="예: 서울 성북구 동소문로22길 31"
                  disabled={isPending}
                />
                <span className="text-xs text-[var(--altteul-text-tertiary)]">
                  도로명 주소 기준으로 적어주세요.
                </span>
              </label>
            </div>
            <FieldError as="p">{errors.roadAddress?.message}</FieldError>
          </section>

          <section className="grid gap-4 border-t border-[var(--altteul-surface-border)] pt-6">
            <FormStepHeader
              step="2"
              title="대표 가격"
              description="가장 먼저 보여줄 가격 1개를 먼저 적어주세요."
            />

            {primaryPriceField ? (
              <PriceItemFields
                index={0}
                isPrimary
                isPending={isPending}
                register={register}
                labelError={errors.priceItems?.[0]?.label?.message}
                amountError={errors.priceItems?.[0]?.amount?.message}
                unitError={errors.priceItems?.[0]?.unitLabel?.message}
              />
            ) : null}

            <div className="flex justify-start">
              <button
                type="button"
                onClick={() =>
                  append({
                    label: "",
                    amount: undefined,
                    unitLabel: "",
                  })
                }
                className="altteulmap-button inline-flex h-10 items-center justify-center whitespace-nowrap px-4 text-sm font-medium"
              >
                다른 가격도 추가하기
              </button>
            </div>

            {additionalPriceFields.length > 0 ? (
              <div className="grid gap-4 border-t border-dashed border-[var(--altteul-surface-border)] pt-4">
                <div className="grid gap-1">
                  <h3 className="text-sm font-semibold text-[var(--altteul-text-strong)]">추가 가격</h3>
                  <p className="text-sm leading-6 text-[var(--altteul-text-tertiary)]">
                    같이 보여주고 싶은 가격이 있으면 이어서 적어주세요.
                  </p>
                </div>
                <div className="grid gap-4">
                  {additionalPriceFields.map((field, offset) => {
                    const index = offset + 1;

                    return (
                      <div
                        key={field.id}
                        className={`grid gap-3 ${offset > 0 ? "border-t border-[var(--altteul-surface-border)] pt-4" : ""}`}
                      >
                        <PriceItemFields
                          index={index}
                          isPending={isPending}
                          register={register}
                          labelError={errors.priceItems?.[index]?.label?.message}
                          amountError={errors.priceItems?.[index]?.amount?.message}
                          unitError={errors.priceItems?.[index]?.unitLabel?.message}
                          onRemove={() => remove(index)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>

          <section className="grid gap-3 border-t border-[var(--altteul-surface-border)] pt-6">
            <FormStepHeader
              step="3"
              title="추가 메모"
              description="확인 시점이나 참고할 내용이 있으면 짧게 남겨주세요."
            />
            <label className="grid gap-2 text-sm text-[var(--altteul-text-primary)]">
              메모
              <textarea
                {...register("note")}
                data-testid="submit-note"
                rows={5}
                className="altteulmap-input min-h-36 resize-y px-4 py-3.5 text-sm"
                placeholder="예: 점심 기준 가격표 확인, 현장 메뉴판 확인"
                disabled={isPending}
              />
              <FieldError>{errors.note?.message}</FieldError>
            </label>
          </section>

          <div className="flex flex-col gap-3 border-t border-[var(--altteul-surface-border)] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--altteul-text-tertiary)]">
              운영 검토 후 지도에 반영됩니다.
            </p>
            <button
              type="submit"
              disabled={isPending}
              data-testid="submit-place-button"
              className="altteulmap-accent-solid altteulmap-button inline-flex w-full items-center justify-center whitespace-nowrap px-5 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isPending ? "등록 접수 중..." : "장소 등록하기"}
            </button>
          </div>
        </div>
      </form>

      {submitResult ? (
        <aside data-testid="submit-result" className="xl:sticky xl:top-24 xl:self-start">
          <section className="altteulmap-panel p-5">
            <h2 className="text-lg font-semibold text-[var(--altteul-text-strong)]">접수 확인</h2>
            <div className="mt-4 grid gap-4">
              <ResultMessage
                testId="submit-result-message"
                isOk={submitResult.ok}
              >
                {submitResult.message}
              </ResultMessage>

              {submitResult.preview ? (
                <div className="rounded-[0.875rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-subtle)] p-4">
                  <p className="text-xs font-medium text-[var(--altteul-text-tertiary)]">
                    접수된 장소
                  </p>
                  <p
                    data-testid="submit-result-name"
                    className="mt-2 text-base font-semibold text-[var(--altteul-text-strong)]"
                  >
                    {submitResult.preview.name}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--altteul-text-secondary)]">
                    {submitResult.preview.roadAddress} · {submitResult.preview.district}
                  </p>
                  <div className="mt-4 grid gap-2">
                    {submitResult.preview.priceItems.map((item) => (
                      <div
                        key={`${item.label}-${item.amount}`}
                        className="rounded-[0.75rem] border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)] px-4 py-3 text-sm text-[var(--altteul-text-secondary)]"
                      >
                        {item.label} · {item.amount.toLocaleString("ko-KR")}원
                        {item.unitLabel ? ` / ${item.unitLabel}` : ""}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </aside>
      ) : null}
    </div>
  );
}
