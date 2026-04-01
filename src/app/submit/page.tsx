import { PlaceSubmitForm } from "@/features/submission/place-submit-form";
import { getSessionUser, getSessionUserLabel } from "@/lib/session";

export default async function SubmitPage() {
  const user = await getSessionUser();

  return (
    <main className="bg-stone-50 px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-7xl rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-medium tracking-[0.18em] text-orange-600">
          장소 등록
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          새 장소 등록
        </h1>
        <div className="altteulmap-badge mt-6 inline-flex bg-stone-100 px-4 py-2 text-sm text-stone-700">
          {user
            ? `등록 계정: ${getSessionUserLabel(user)}`
            : "로그인 없이도 장소를 등록할 수 있습니다."}
        </div>
        <p className="mt-4 text-sm leading-6 text-stone-600">
          주소만 적고 끝내지 않고, 지도에 표시될 위치를 함께 확인해야 등록이
          접수됩니다.
        </p>

        <div className="mt-8">
          <PlaceSubmitForm />
        </div>
      </section>
    </main>
  );
}
