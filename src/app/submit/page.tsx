import { PlaceSubmitForm } from "@/features/submission/place-submit-form";
export default async function SubmitPage() {
  return (
    <main className="bg-stone-50 px-4 py-6 sm:px-6 sm:py-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-4 sm:mb-5">
          <p className="text-xs font-medium tracking-[0.18em] text-orange-600">
            장소 등록
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
            새 장소 등록
          </h1>
        </div>
        <PlaceSubmitForm />
      </section>
    </main>
  );
}
