import { redirect } from "next/navigation";

import { PlaceSubmitForm } from "@/features/submission/place-submit-form";
import { createLoginHref, getSessionUser, getSessionUserLabel } from "@/lib/session";

export default async function SubmitPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(createLoginHref("/submit"));
  }

  return (
    <main className="bg-stone-50 px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-7xl rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-600">
          Write MVP
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          장소 등록 폼 초안
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">
          로그인한 계정으로 신규 장소를 제보합니다. 제출된 장소는 즉시 공개되지
          않고 승인 큐로 들어가며, 운영자가 좌표를 보완해 승인하면 지도 목록에
          노출됩니다.
        </p>
        <div className="mt-6 inline-flex rounded-full bg-stone-100 px-4 py-2 text-sm text-stone-700">
          제출 계정: {getSessionUserLabel(user)}
        </div>

        <div className="mt-8">
          <PlaceSubmitForm />
        </div>
      </section>
    </main>
  );
}
