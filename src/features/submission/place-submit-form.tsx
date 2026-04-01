"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useEffect, useRef, useState, useTransition } from "react";

import { categoryGroups } from "@/features/categories/catalog";
import {
  geocodeAddress,
  getNaverMapKeyId,
  loadNaverMapSdk,
} from "@/features/map/naver-map-sdk";
import {
  type PlaceSubmissionFormInput,
  type PlaceSubmissionFormValues,
  type PlaceSubmissionInput,
  placeSubmissionCoordinateRequirementMessage,
  placeSubmissionFormSchema,
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
  const [isResolvingLocation, startLocationResolveTransition] = useTransition();
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const previousLocationInputRef = useRef<{
    address: string;
    district: string;
  } | null>(null);

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
    clearErrors,
    getValues,
    setError,
    setValue,
    trigger,
    formState: { errors },
  } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "priceItems",
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
  const isLocationConfirmed = Boolean(latitudeValue && longitudeValue);

  const setCoordinateFields = (latitude: string, longitude: string) => {
    setValue("latitude", latitude, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("longitude", longitude, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  useEffect(() => {
    const previous = previousLocationInputRef.current;
    previousLocationInputRef.current = {
      address: watchedAddress,
      district: watchedDistrict,
    };

    if (!previous) {
      return;
    }

    const addressChanged =
      previous.address !== watchedAddress || previous.district !== watchedDistrict;

    if (!addressChanged || !latitudeValue || !longitudeValue) {
      return;
    }

    setValue("latitude", "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("longitude", "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    setError("latitude", {
      type: "manual",
      message: "주소가 바뀌어 위치를 다시 확인해주세요.",
    });
    setError("longitude", {
      type: "manual",
      message: "주소가 바뀌어 위치를 다시 확인해주세요.",
    });
  }, [
    latitudeValue,
    longitudeValue,
    setError,
    setValue,
    watchedAddress,
    watchedDistrict,
  ]);

  const resolveCoordinatesFromAddress = async (
    values: PlaceSubmissionFormValues,
  ): Promise<PlaceSubmissionInput | null> => {
    if (
      typeof values.latitude === "number" &&
      typeof values.longitude === "number"
    ) {
      clearErrors(["latitude", "longitude"]);
      return placeSubmissionSchema.parse(getValues());
    }

    if (
      typeof values.latitude === "number" ||
      typeof values.longitude === "number"
    ) {
      setError("latitude", {
        type: "manual",
        message: "위도와 경도는 함께 입력해주세요.",
      });
      setError("longitude", {
        type: "manual",
        message: "위도와 경도는 함께 입력해주세요.",
      });
      return null;
    }

    if (!values.roadAddress.trim()) {
      setError("latitude", {
        type: "manual",
        message: placeSubmissionCoordinateRequirementMessage,
      });
      setError("longitude", {
        type: "manual",
        message: placeSubmissionCoordinateRequirementMessage,
      });
      return null;
    }

    const naverMapKeyId = getNaverMapKeyId();

    if (!naverMapKeyId) {
      setError("latitude", {
        type: "manual",
        message:
          "주소 위치를 자동으로 확인할 수 없습니다. 잠시 후 다시 시도해주세요.",
      });
      setError("longitude", {
        type: "manual",
        message:
          "주소 위치를 자동으로 확인할 수 없습니다. 잠시 후 다시 시도해주세요.",
      });
      return null;
    }

    try {
      const query = [values.district.trim(), values.roadAddress.trim()]
        .filter(Boolean)
        .join(" ");
      const result = await loadNaverMapSdk(naverMapKeyId).then(() =>
        geocodeAddress(query),
      );

      if (!result) {
        setLocationMessage(null);
        setError("latitude", {
          type: "manual",
          message:
            "입력한 주소로 위치를 찾지 못했습니다. 주소를 다시 확인해주세요.",
        });
        setError("longitude", {
          type: "manual",
          message:
            "입력한 주소로 위치를 찾지 못했습니다. 주소를 다시 확인해주세요.",
        });
        return null;
      }

      const nextLatitude = result.point.lat.toFixed(6);
      const nextLongitude = result.point.lng.toFixed(6);

      setCoordinateFields(nextLatitude, nextLongitude);
      clearErrors(["latitude", "longitude"]);
      setLocationMessage("주소 확인이 완료되었습니다.");

      const parsed = placeSubmissionSchema.safeParse({
        ...getValues(),
        latitude: nextLatitude,
        longitude: nextLongitude,
      });

      if (!parsed.success) {
        setLocationMessage(null);
        setError("latitude", {
          type: "manual",
          message: placeSubmissionCoordinateRequirementMessage,
        });
        setError("longitude", {
          type: "manual",
          message: placeSubmissionCoordinateRequirementMessage,
        });
        return null;
      }

      return parsed.data;
    } catch {
      setLocationMessage(null);
      setError("latitude", {
        type: "manual",
        message:
          "주소 기준 위치 확인에 실패했습니다. 잠시 후 다시 시도해주세요.",
      });
      setError("longitude", {
        type: "manual",
        message:
          "주소 기준 위치 확인에 실패했습니다. 잠시 후 다시 시도해주세요.",
      });
      return null;
    }
  };

  const handleAddressLookup = () => {
    startLocationResolveTransition(async () => {
      const values = getValues();
      const query = [values.district?.trim(), values.roadAddress?.trim()]
        .filter(Boolean)
        .join(" ");

      if (!query) {
        setLocationMessage(null);
        setError("roadAddress", {
          type: "manual",
          message: "업장 주소를 먼저 입력해주세요.",
        });
        setLocationMessage(null);
        return;
      }

      clearErrors(["roadAddress", "latitude", "longitude"]);
      await resolveCoordinatesFromAddress(values as PlaceSubmissionFormValues);
    });
  };

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      setSubmitResult(null);

      const payload = await resolveCoordinatesFromAddress(values);

      if (!payload) {
        return;
      }

      const isValid = await trigger();

      if (!isValid) {
        return;
      }

      const response = await fetch("/api/places", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as SubmitResult;
      setSubmitResult(result);
    });
  });

  return (
    <div
      className={
        submitResult
          ? "grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"
          : "grid gap-6"
      }
    >
      <form
        onSubmit={onSubmit}
        data-testid="place-submit-form"
        className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="grid gap-6">
          <section>
            <h2 className="text-lg font-semibold text-stone-900">기본 정보</h2>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-2 text-sm text-stone-700">
                업장/장소 이름
                <input
                  {...register("name")}
                  data-testid="submit-name"
                  className="rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
                  placeholder="예: 학교앞김밥, 성북청년밥집"
                />
                <p className="text-xs text-stone-500">
                  간판명이나 사용자가 바로 알아볼 수 있는 이름 하나만 입력하면 됩니다.
                </p>
                {errors.name ? (
                  <span className="text-xs text-rose-600">
                    {errors.name.message}
                  </span>
                ) : null}
              </label>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-stone-700">
                카테고리
                <select
                  {...register("categorySlug")}
                  data-testid="submit-category"
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
                  data-testid="submit-district"
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
            <div className="mt-4 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-stone-700">업장 주소</p>
                  <p className="mt-1 text-xs text-stone-500">
                    도로명 주소를 입력하고 위치 확인까지 끝내야 지도에 표시됩니다.
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    isLocationConfirmed
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-stone-200 text-stone-600"
                  }`}
                >
                  {isLocationConfirmed ? "위치 확인됨" : "위치 미확인"}
                </span>
              </div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  {...register("roadAddress")}
                  data-testid="submit-road-address"
                  className="min-w-0 flex-1 rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
                  placeholder="예: 서울 성북구 동소문로22길 31"
                />
                <button
                  type="button"
                  onClick={handleAddressLookup}
                  data-testid="submit-address-lookup-button"
                  disabled={isPending || isResolvingLocation}
                  className="altteulmap-button shrink-0 whitespace-nowrap border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isResolvingLocation ? "위치 확인 중..." : "주소로 위치 확인"}
                </button>
              </div>
              {errors.roadAddress ? (
                <p className="mt-2 text-xs text-rose-600">
                  {errors.roadAddress.message}
                </p>
              ) : null}
              {isLocationConfirmed && locationMessage ? (
                <p
                  className="mt-2 text-xs text-emerald-700"
                >
                  {locationMessage}
                </p>
              ) : null}
            </div>
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
                className="altteulmap-button whitespace-nowrap border border-stone-300 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
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
                        data-testid={`submit-price-label-${index}`}
                        className="rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
                        placeholder="예: 김치찌개"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-stone-700">
                      가격
                      <input
                        type="number"
                        {...register(`priceItems.${index}.amount`)}
                        data-testid={`submit-price-amount-${index}`}
                        className="rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
                        placeholder="7000"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-stone-700">
                      단위
                      <input
                        {...register(`priceItems.${index}.unitLabel`)}
                        data-testid={`submit-price-unit-${index}`}
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
                data-testid="submit-note"
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
            <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600">
              주소 텍스트를 기준으로 내부 위치 확인을 진행합니다. 정확한 도로명 주소를 입력해주세요.
            </div>
            <input
              type="hidden"
              {...register("latitude")}
              data-testid="submit-latitude"
            />
            <input
              type="hidden"
              {...register("longitude")}
              data-testid="submit-longitude"
            />
            {errors.latitude || errors.longitude ? (
              <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errors.latitude?.message ?? errors.longitude?.message}
              </div>
            ) : null}
            <div className="rounded-[1.5rem] border border-stone-200 bg-white px-4 py-3 text-sm leading-6 text-stone-600">
              {isLocationConfirmed
                ? "업장 위치 확인이 완료되었습니다. 제출 시 이 주소 기준으로 저장됩니다."
                : "아직 업장 위치가 확인되지 않았습니다. 주소로 위치 확인이 필요합니다."}
            </div>
          </section>

          <button
            type="submit"
            disabled={isPending}
            data-testid="submit-place-button"
            className="altteulmap-accent-solid altteulmap-button whitespace-nowrap px-5 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "등록 확인 중..." : "장소 등록하기"}
          </button>
        </div>
      </form>

      {submitResult ? (
        <aside data-testid="submit-result">
          <section className="rounded-[2rem] border border-stone-200 bg-stone-50 p-6">
            <h2 className="text-xl font-semibold text-stone-900">접수 내용</h2>
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
                <div className="rounded-3xl border border-stone-200 bg-white p-5">
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
          </section>
        </aside>
      ) : null}
    </div>
  );
}
