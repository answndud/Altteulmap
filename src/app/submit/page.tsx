import { PlaceSubmitForm } from "@/features/submission/place-submit-form";
export default async function SubmitPage() {
  return (
    <main className="bg-stone-50 px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-7xl rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-orange-600">
            장소 등록
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
            새 장소 등록
          </h1>
        </div>

        <div className="mt-8">
          <PlaceSubmitForm />
        </div>
      </section>
    </main>
  );
}
