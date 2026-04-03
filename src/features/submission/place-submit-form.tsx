"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { useState, useTransition } from "react";

import { categoryGroups } from "@/features/categories/catalog";
import {
  type PlaceSubmissionFormInput,
  type PlaceSubmissionFormValues,
  placeSubmissionFormSchema,
} from "@/features/submission/schema";

type SubmitResult = {
  ok: boolean;
  message: string;
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
      amount: 0,
      unitLabel: "",
    },
  ],
};

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
      setSubmitResult(result);
    });
  });

  return (
    <div
      className={
        submitResult
          ? "grid gap-5 lg:grid-cols-[1.15fr_0.85fr]"
          : "grid gap-6"
      }
    >
      <form
        onSubmit={onSubmit}
        data-testid="place-submit-form"
        className="rounded-[1.8rem] border border-stone-200 bg-white p-5 shadow-sm sm:p-7"
      >
        <div className="grid gap-5">
          <section>
            <h2 className="text-base font-semibold text-stone-900">기본 정보</h2>
            <div className="mt-4 grid gap-4">
              <label className="grid min-w-0 gap-2 text-sm text-stone-700">
                업장/장소 이름
                <input
                  {...register("name")}
                  data-testid="submit-name"
                  className="altteulmap-input px-4 py-3.5 text-stone-900"
                  placeholder="예: 학교앞김밥, 성북청년밥집"
                />
                {errors.name ? (
                  <span className="text-xs text-rose-600">
                    {errors.name.message}
                  </span>
                ) : null}
              </label>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid min-w-0 gap-2 text-sm text-stone-700">
                카테고리
                <select
                  {...register("categorySlug")}
                  data-testid="submit-category"
                  className="altteulmap-input px-4 py-3.5 text-stone-900"
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
                {errors.categorySlug ? (
                  <span className="text-xs text-rose-600">
                    {errors.categorySlug.message}
                  </span>
                ) : null}
              </label>
              <label className="grid min-w-0 gap-2 text-sm text-stone-700">
                지역 구분
                <input
                  {...register("district")}
                  data-testid="submit-district"
                  className="altteulmap-input px-4 py-3.5 text-stone-900"
                  placeholder="예: 서울 성북구"
                />
                {errors.district ? (
                  <span className="text-xs text-rose-600">
                    {errors.district.message}
                  </span>
                ) : null}
              </label>
            </div>
            <div className="mt-4 grid gap-2">
              <label className="grid gap-2 text-sm text-stone-700">
                업장 주소
                <input
                  {...register("roadAddress")}
                  data-testid="submit-road-address"
                  className="altteulmap-input px-4 py-3.5 text-stone-900"
                  placeholder="예: 서울 성북구 동소문로22길 31"
                />
              </label>
              {errors.roadAddress ? (
                <p className="text-xs text-rose-600">
                  {errors.roadAddress.message}
                </p>
              ) : null}
            </div>
          </section>

          <section className="border-t border-stone-200 pt-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-stone-900">가격 항목</h2>
              <button
                type="button"
                onClick={() =>
                  append({
                    label: "",
                    amount: 0,
                    unitLabel: "",
                  })
                }
                className="altteulmap-button whitespace-nowrap border border-stone-300 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
              >
                항목 추가
              </button>
            </div>
            <div className="mt-4 grid gap-4">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="rounded-[1.35rem] border border-stone-200 bg-white p-3.5"
                >
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.85fr)_minmax(0,0.75fr)_auto] lg:items-end">
                    <label className="grid min-w-0 gap-2 text-sm text-stone-700">
                      항목명
                      <input
                        {...register(`priceItems.${index}.label`)}
                        data-testid={`submit-price-label-${index}`}
                        className="altteulmap-input px-4 py-3.5 text-stone-900"
                        placeholder="예: 김치찌개"
                      />
                    </label>
                    <label className="grid min-w-0 gap-2 text-sm text-stone-700">
                      가격
                      <input
                        type="number"
                        {...register(`priceItems.${index}.amount`)}
                        data-testid={`submit-price-amount-${index}`}
                        className="altteulmap-input px-4 py-3.5 text-stone-900"
                        placeholder="7000"
                      />
                    </label>
                    <label className="grid min-w-0 gap-2 text-sm text-stone-700">
                      단위
                      <input
                        {...register(`priceItems.${index}.unitLabel`)}
                        data-testid={`submit-price-unit-${index}`}
                        className="altteulmap-input px-4 py-3.5 text-stone-900"
                        placeholder="1인분"
                      />
                    </label>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                        className="altteulmap-button w-full whitespace-nowrap border border-stone-300 px-4 py-3 text-sm text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                  {errors.priceItems?.[index] ? (
                    <div className="mt-3 grid gap-1 text-xs text-rose-600">
                      {errors.priceItems[index]?.label ? (
                        <span>{errors.priceItems[index]?.label?.message}</span>
                      ) : null}
                      {errors.priceItems[index]?.amount ? (
                        <span>{errors.priceItems[index]?.amount?.message}</span>
                      ) : null}
                      {errors.priceItems[index]?.unitLabel ? (
                        <span>
                          {errors.priceItems[index]?.unitLabel?.message}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="border-t border-stone-200 pt-5">
            <h2 className="text-base font-semibold text-stone-900">메모</h2>
            <label className="mt-4 grid gap-2 text-sm text-stone-700">
              추가 메모
              <textarea
                {...register("note")}
                data-testid="submit-note"
                rows={5}
                className="altteulmap-input min-h-40 resize-y px-4 py-3.5 text-stone-900"
                placeholder="예: 점심시간 줄이 짧고 현금 결제 손님이 많습니다."
              />
              {errors.note ? (
                <span className="text-xs text-rose-600">
                  {errors.note.message}
                </span>
              ) : null}
            </label>
          </section>

          <button
            type="submit"
            disabled={isPending}
            data-testid="submit-place-button"
            className="altteulmap-accent-solid altteulmap-button inline-flex w-full items-center justify-center whitespace-nowrap px-5 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isPending ? "등록 접수 중..." : "장소 등록하기"}
          </button>
        </div>
      </form>

      {submitResult ? (
        <aside data-testid="submit-result">
          <section className="rounded-[1.8rem] border border-stone-200 bg-stone-50/80 p-5">
            <h2 className="text-lg font-semibold text-stone-900">접수 내용</h2>
            <div className="mt-4 space-y-4">
              <div
                data-testid="submit-result-message"
                className={`rounded-2xl px-4 py-3 text-sm ${
                  submitResult.ok
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {submitResult.message}
              </div>
              {submitResult.preview ? (
                <div className="rounded-[1.35rem] border border-stone-200 bg-white p-4">
                  <p className="text-sm text-stone-500">장소 이름</p>
                  <p
                    data-testid="submit-result-name"
                    className="mt-1 font-medium text-stone-900"
                  >
                    {submitResult.preview.name}
                  </p>
                  <p className="mt-4 text-sm text-stone-500">주소</p>
                  <p className="mt-1 text-sm leading-6 text-stone-700">
                    {submitResult.preview.roadAddress} ·{" "}
                    {submitResult.preview.district}
                  </p>
                  <div className="mt-4 grid gap-2">
                    {submitResult.preview.priceItems.map((item) => (
                      <div
                        key={`${item.label}-${item.amount}`}
                        className="rounded-[1rem] border border-stone-200 bg-stone-50/70 px-4 py-3 text-sm text-stone-700"
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
