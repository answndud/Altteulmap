import { type ReactNode } from "react";
import { type UseFormRegister } from "react-hook-form";

import { FieldError, ResultMessage } from "@/components/form-feedback";
import { type PlaceSubmissionFormInput } from "@/features/submission/schema";

export type SubmitResult = {
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

export function FormStepHeader({
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

export function PriceItemFields({
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

export function SubmitResultPanel({ submitResult }: { submitResult: SubmitResult }) {
  return (
    <aside data-testid="submit-result" className="xl:sticky xl:top-24 xl:self-start">
      <section className="altteulmap-panel p-5">
        <h2 className="text-lg font-semibold text-[var(--altteul-text-strong)]">접수 확인</h2>
        <div className="mt-4 grid gap-4">
          <ResultMessage testId="submit-result-message" isOk={submitResult.ok}>
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
  );
}
