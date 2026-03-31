import { PlaceSubmitForm } from "@/features/submission/place-submit-form";

export default function SubmitPage() {
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
          아직 로그인과 주소 검색은 연결하지 않았지만, 실제 저장 API에 가깝게
          사용할 수 있는 입력 구조와 검증 흐름은 먼저 만들었습니다. 다음 단계에서
          Auth.js와 DB 저장을 붙이면 곧바로 실등록 플로우로 확장할 수 있습니다.
        </p>

        <div className="mt-8">
          <PlaceSubmitForm />
        </div>
      </section>
    </main>
  );
}
