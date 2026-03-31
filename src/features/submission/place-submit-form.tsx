"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useState, useTransition } from "react";

import { categoryGroups } from "@/features/categories/catalog";
import { PlaceCoordinatePicker } from "@/features/submission/place-coordinate-picker";
import {
  type PlaceSubmissionFormInput,
  type PlaceSubmissionInput,
  placeSubmissionSchema,
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
    latitude?: number;
    longitude?: number;
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
  businessName: "",
  categorySlug: "",
  roadAddress: "",
  district: "",
  latitude: "",
  longitude: "",
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

  const form = useForm<PlaceSubmissionFormInput, undefined, PlaceSubmissionInput>(
    {
      resolver: zodResolver(placeSubmissionSchema),
      defaultValues,
    },
  );

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "priceItems",
  });
  const watchedName = useWatch({
    control,
    name: "name",
    defaultValue: "",
  });
  const watchedAddress = useWatch({
    control,
    name: "roadAddress",
    defaultValue: "",
  });
  const watchedDistrict = useWatch({
    control,
    name: "district",
    defaultValue: "",
  });
  const watchedLatitude = useWatch({
    control,
    name: "latitude",
    defaultValue: "",
  });
  const watchedLongitude = useWatch({
    control,
    name: "longitude",
    defaultValue: "",
  });
  const latitudeValue =
    typeof watchedLatitude === "string"
      ? watchedLatitude
      : watchedLatitude == null
        ? ""
        : String(watchedLatitude);
  const longitudeValue =
    typeof watchedLongitude === "string"
      ? watchedLongitude
      : watchedLongitude == null
        ? ""
        : String(watchedLongitude);

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
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
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <form
        onSubmit={onSubmit}
        className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="grid gap-6">
          <section>
            <h2 className="text-lg font-semibold text-stone-900">기본 정보</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-stone-700">
                상호명
                <input
                  {...register("name")}
                  className="rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
                  placeholder="예: 학교앞김밥"
                />
                {errors.name ? (
                  <span className="text-xs text-rose-600">
                    {errors.name.message}
                  </span>
                ) : null}
              </label>
              <label className="grid gap-2 text-sm text-stone-700">
                사업장 이름
                <input
                  {...register("businessName")}
                  className="rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
                  placeholder="예: 학교앞김밥 성신점"
                />
              </label>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-stone-700">
                카테고리
                <select
                  {...register("categorySlug")}
                  className="rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
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
              <label className="grid gap-2 text-sm text-stone-700">
                지역 구분
                <input
                  {...register("district")}
                  className="rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
                  placeholder="예: 서울 성북구"
                />
                {errors.district ? (
                  <span className="text-xs text-rose-600">
                    {errors.district.message}
                  </span>
                ) : null}
              </label>
            </div>
            <label className="mt-4 grid gap-2 text-sm text-stone-700">
              주소
              <input
                {...register("roadAddress")}
                className="rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
                placeholder="예: 서울 성북구 동소문로22길 31"
              />
              {errors.roadAddress ? (
                <span className="text-xs text-rose-600">
                  {errors.roadAddress.message}
                </span>
              ) : null}
            </label>
          </section>

          <section>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-stone-900">가격 항목</h2>
              <button
                type="button"
                onClick={() =>
                  append({
                    label: "",
                    amount: 0,
                    unitLabel: "",
                  })
                }
                className="rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
              >
                항목 추가
              </button>
            </div>
            <div className="mt-4 grid gap-4">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="rounded-3xl border border-stone-200 bg-stone-50 p-4"
                >
                  <div className="grid gap-4 sm:grid-cols-[1.2fr_0.8fr_0.6fr_auto]">
                    <label className="grid gap-2 text-sm text-stone-700">
                      항목명
                      <input
                        {...register(`priceItems.${index}.label`)}
                        className="rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
                        placeholder="예: 김치찌개"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-stone-700">
                      가격
                      <input
                        type="number"
                        {...register(`priceItems.${index}.amount`)}
                        className="rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
                        placeholder="7000"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-stone-700">
                      단위
                      <input
                        {...register(`priceItems.${index}.unitLabel`)}
                        className="rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
                        placeholder="1인분"
                      />
                    </label>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                        className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
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

          <section>
            <h2 className="text-lg font-semibold text-stone-900">메모</h2>
            <label className="mt-4 grid gap-2 text-sm text-stone-700">
              추가 메모
              <textarea
                {...register("note")}
                rows={5}
                className="rounded-3xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
                placeholder="예: 점심시간 줄이 짧고 현금 결제 손님이 많습니다."
              />
              {errors.note ? (
                <span className="text-xs text-rose-600">
                  {errors.note.message}
                </span>
              ) : null}
            </label>
          </section>

          <section className="grid gap-4">
            <PlaceCoordinatePicker
              placeName={watchedName}
              address={watchedAddress}
              district={watchedDistrict}
              latitude={latitudeValue}
              longitude={longitudeValue}
              onChange={({ latitude, longitude }) => {
                setValue("latitude", latitude, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
                setValue("longitude", longitude, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
              disabled={isPending}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-stone-700">
                위도
                <input
                  type="number"
                  step="0.000001"
                  {...register("latitude")}
                  className="rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
                  placeholder="37.566500"
                />
                {errors.latitude ? (
                  <span className="text-xs text-rose-600">
                    {errors.latitude.message}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm text-stone-700">
                경도
                <input
                  type="number"
                  step="0.000001"
                  {...register("longitude")}
                  className="rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
                  placeholder="126.978000"
                />
                {errors.longitude ? (
                  <span className="text-xs text-rose-600">
                    {errors.longitude.message}
                  </span>
                ) : null}
              </label>
            </div>
          </section>

          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "제출 확인 중..." : "제보 제출하기"}
          </button>
        </div>
      </form>

      <aside className="space-y-6">
        <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">
            Submission flow
          </p>
          <h2 className="mt-3 text-xl font-semibold text-stone-900">
            현재 단계에서 가능한 것
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-stone-600">
            <li>카테고리 선택과 가격 항목 다중 입력</li>
            <li>대략적인 좌표 선택 또는 수동 입력</li>
            <li>Zod 기반 입력 검증</li>
            <li>서버 API로 제출 payload 검증</li>
            <li>목업 fallback 또는 DB 저장 결과 확인</li>
          </ul>
        </section>

        <section className="rounded-[2rem] border border-stone-200 bg-stone-50 p-6">
          <h2 className="text-xl font-semibold text-stone-900">제출 결과</h2>
          {submitResult ? (
            <div className="mt-4 space-y-4">
              <div
                className={`rounded-2xl px-4 py-3 text-sm ${
                  submitResult.ok
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {submitResult.message}
              </div>
              {submitResult.preview ? (
                <div className="rounded-3xl border border-stone-200 bg-white p-5">
                  <p className="text-sm text-stone-500">생성 ID</p>
                  <p className="mt-1 font-medium text-stone-900">
                    {submitResult.preview.id}
                  </p>
                  {submitResult.source ? (
                    <>
                      <p className="mt-4 text-sm text-stone-500">처리 경로</p>
                      <p className="mt-1 font-medium text-stone-900">
                        {submitResult.source === "database" ? "DB" : "목업"}
                      </p>
                    </>
                  ) : null}
                  <p className="mt-4 text-sm text-stone-500">상호명</p>
                  <p className="mt-1 font-medium text-stone-900">
                    {submitResult.preview.name}
                  </p>
                  <p className="mt-4 text-sm text-stone-500">주소</p>
                  <p className="mt-1 text-sm leading-6 text-stone-700">
                    {submitResult.preview.roadAddress} ·{" "}
                    {submitResult.preview.district}
                  </p>
                  {typeof submitResult.preview.latitude === "number" &&
                  typeof submitResult.preview.longitude === "number" ? (
                    <>
                      <p className="mt-4 text-sm text-stone-500">제출 좌표</p>
                      <p className="mt-1 text-sm leading-6 text-stone-700">
                        {submitResult.preview.latitude.toFixed(6)},{" "}
                        {submitResult.preview.longitude.toFixed(6)}
                      </p>
                    </>
                  ) : null}
                  <div className="mt-4 grid gap-2">
                    {submitResult.preview.priceItems.map((item) => (
                      <div
                        key={`${item.label}-${item.amount}`}
                        className="rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-700"
                      >
                        {item.label} · {item.amount.toLocaleString("ko-KR")}원
                        {item.unitLabel ? ` / ${item.unitLabel}` : ""}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-stone-600">
              아직 제출하지 않았습니다. 폼을 입력하고 제출하면 서버 검증 결과와
              정리된 payload를 여기에서 확인할 수 있습니다.
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}
