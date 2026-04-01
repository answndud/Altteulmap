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
        <p className="text-xs font-medium tracking-[0.18em] text-orange-600">
          장소 제보
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          새 장소 제보
        </h1>
        <div className="mt-6 inline-flex rounded-full bg-stone-100 px-4 py-2 text-sm text-stone-700">
          제보 계정: {getSessionUserLabel(user)}
        </div>

        <div className="mt-8">
          <PlaceSubmitForm />
        </div>
      </section>
    </main>
  );
}
