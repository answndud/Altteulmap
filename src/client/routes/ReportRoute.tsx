import { Link, useSearchParams } from "react-router-dom";

import { ReportSubmitForm } from "@/features/reports/report-submit-form";

export function ReportRoute() {
  const [searchParams] = useSearchParams();
  const placeId = searchParams.get("placeId")?.trim() ?? "";
  const placeName = searchParams.get("placeName")?.trim() ?? "";

  if (!placeId || !placeName) {
    return (
      <main className="bg-[var(--altteul-bg-canvas)] px-4 py-8 sm:px-6">
        <section className="mx-auto grid min-h-[calc(100dvh-8rem)] max-w-3xl place-items-center">
          <div className="w-full rounded-[1.25rem] border border-stone-200 bg-[var(--altteul-bg-surface)] p-6 text-center shadow-sm sm:p-8">
            <p className="altteulmap-section-kicker">장소 신고</p>
            <h1 className="mt-3 break-keep text-2xl font-semibold leading-9 text-stone-950 sm:text-3xl">
              신고할 장소를 먼저 선택해 주세요
            </h1>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              지도나 장소 상세에서 신고하기를 누르면 어떤 장소를 수정할지
              함께 전달됩니다. 장소를 찾지 못했다면 새 장소로 등록할 수 있어요.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link
                to="/"
                className="altteulmap-accent-solid altteulmap-button inline-flex items-center justify-center px-5 py-3 text-sm font-medium"
              >
                가격 지도에서 찾기
              </Link>
              <Link
                to="/submit"
                className="altteulmap-button inline-flex items-center justify-center px-5 py-3 text-sm font-medium text-stone-700"
              >
                장소 등록하기
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="bg-stone-50 px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-7xl rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div>
          <p className="text-xs font-medium text-orange-600">장소 신고</p>
          <h1 className="mt-3 text-3xl font-semibold text-stone-900 sm:text-5xl">
            정보 수정 요청
          </h1>
        </div>

        <div className="mt-8">
          <ReportSubmitForm placeId={placeId} placeName={placeName} />
        </div>
      </section>
    </main>
  );
}
