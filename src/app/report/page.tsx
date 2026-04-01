import { redirect } from "next/navigation";

import { ReportSubmitForm } from "@/features/reports/report-submit-form";
import {
  createLoginHref,
  getSessionUser,
  getSessionUserLabel,
} from "@/lib/session";

type ReportPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getFirstValue(value: string | string[] | undefined, fallback = "") {
  return Array.isArray(value) ? (value[0] ?? fallback) : (value ?? fallback);
}

export default async function ReportPage({ searchParams }: ReportPageProps) {
  const params = await searchParams;
  const placeId = getFirstValue(params.placeId, "unknown-place");
  const placeName = getFirstValue(params.placeName, "이름 없는 장소");
  const callbackUrl = `/report?placeId=${encodeURIComponent(placeId)}&placeName=${encodeURIComponent(placeName)}`;
  const user = await getSessionUser();

  if (!user) {
    redirect(createLoginHref(callbackUrl));
  }

  return (
    <main className="bg-stone-50 px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-7xl rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-medium tracking-[0.18em] text-orange-600">
          장소 신고
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          정보 수정 요청
        </h1>
        <div className="mt-6 inline-flex rounded-full bg-stone-100 px-4 py-2 text-sm text-stone-700">
          신고 계정: {getSessionUserLabel(user)}
        </div>

        <div className="mt-8">
          <ReportSubmitForm placeId={placeId} placeName={placeName} />
        </div>
      </section>
    </main>
  );
}
