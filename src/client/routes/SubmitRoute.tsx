import { PlaceSubmitForm } from "@/features/submission/place-submit-form";

export function SubmitRoute() {
  return (
    <main className="bg-[var(--altteul-bg-canvas)] px-4 py-6 sm:px-6 sm:py-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-4 sm:mb-5">
          <p className="altteulmap-section-kicker">장소 제보</p>
          <h1 className="mt-2 text-[2rem] font-bold text-[var(--altteul-text-strong)] sm:text-[2.3rem]">
            장소 등록
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--altteul-text-secondary)]">
            이름, 주소, 대표 가격 1개부터 적으면 됩니다.
          </p>
        </div>
        <PlaceSubmitForm />
      </section>
    </main>
  );
}
