type AdminSummaryCardItem = {
  id: string;
  label: string;
  value: number | string;
  detail: string;
};

type AdminSummaryCardsProps = {
  items: AdminSummaryCardItem[];
};

export function AdminSummaryCards({ items }: AdminSummaryCardsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <article
          key={item.id}
          data-testid={`admin-summary-card-${item.id}`}
          className="altteulmap-panel-muted p-4"
        >
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--altteul-accent-text)]">
            {item.label}
          </p>
          <h2 className="mt-3 text-[1.9rem] font-semibold tracking-[-0.04em] text-stone-950">
            {item.value}
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">{item.detail}</p>
        </article>
      ))}
    </div>
  );
}
