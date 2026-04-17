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
    <main className="bg-[var(--altteul-bg-canvas)] px-3 py-4 sm:px-4 sm:py-5 lg:px-5 xl:px-6">
      <section className="altteulmap-panel mx-auto max-w-4xl p-6 sm:p-7">
        <p className="altteulmap-section-kicker">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-[1.85rem] font-semibold tracking-[-0.06em] text-stone-950 sm:text-[2.35rem]">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600 sm:text-[0.95rem]">
          {description}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={primaryHref}
            className="altteulmap-accent-solid altteulmap-button px-5 py-3 text-sm font-medium"
          >
            {primaryLabel}
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="altteulmap-button border border-stone-300 bg-white px-5 py-3 text-sm text-stone-700 transition hover:bg-white"
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
