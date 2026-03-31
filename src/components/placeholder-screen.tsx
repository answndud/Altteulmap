type PlaceholderScreenProps = {
  eyebrow: string;
  title: string;
  description: string;
  checklist: string[];
};

export function PlaceholderScreen({
  eyebrow,
  title,
  description,
  checklist,
}: PlaceholderScreenProps) {
  return (
    <main className="min-h-[calc(100vh-73px)] bg-stone-50 px-4 py-12 sm:px-6">
      <section className="mx-auto max-w-4xl rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-600">
          {eyebrow}
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
          {description}
        </p>
        <div className="mt-8 grid gap-3">
          {checklist.map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700"
            >
              {item}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
