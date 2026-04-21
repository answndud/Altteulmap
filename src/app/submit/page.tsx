import { PlaceSubmitForm } from "@/features/submission/place-submit-form";
export default async function SubmitPage() {
  return (
    <main className="bg-[var(--altteul-bg-canvas)] px-4 py-6 sm:px-6 sm:py-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-4 sm:mb-5">
          <h1 className="text-[2rem] font-semibold text-stone-950 sm:text-[2.3rem]">
            장소 등록
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            이름, 주소, 대표 가격 1개부터 적으면 됩니다.
          </p>
        </div>
        <PlaceSubmitForm />
      </section>
    </main>
  );
}
