import Link from "next/link";

type AccessDeniedPanelProps = {
  eyebrow: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function AccessDeniedPanel({
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: AccessDeniedPanelProps) {
  return (
    <main className="bg-stone-50 px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-600">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
          {description}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={primaryHref}
            className="altteulmap-button bg-stone-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-700"
          >
            {primaryLabel}
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="altteulmap-button border border-stone-300 bg-white px-5 py-3 text-sm text-stone-700 transition hover:bg-stone-100"
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
