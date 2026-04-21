import type { ReactNode } from "react";

type AdminPageShellProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  statusBadges?: ReactNode;
  children: ReactNode;
};

export function AdminPageShell({
  eyebrow = "운영",
  title,
  description,
  actions,
  statusBadges,
  children,
}: AdminPageShellProps) {
  return (
    <main className="bg-[var(--altteul-bg-canvas)] px-3 py-4 sm:px-4 sm:py-5 lg:px-5 xl:px-6">
      <section className="mx-auto max-w-[96rem]">
        <div className="grid gap-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="altteulmap-section-kicker">{eyebrow}</p>
              <h1 className="mt-1 text-[1.85rem] font-semibold text-stone-950 sm:text-[2.3rem]">
                {title}
              </h1>
              <p className="mt-2 text-sm leading-6 text-stone-600 sm:text-[0.95rem]">
                {description}
              </p>
            </div>
            {actions ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {actions}
              </div>
            ) : null}
          </div>

          {statusBadges ? (
            <div className="flex flex-wrap gap-2">{statusBadges}</div>
          ) : null}

          {children}
        </div>
      </section>
    </main>
  );
}
