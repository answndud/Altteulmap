import Link from "next/link";

type BrandMarkProps = {
  href?: string;
  variant?: "compact" | "hero";
  className?: string;
};

const variantClassMap = {
  compact: {
    wrapper: "gap-0.5",
    eyebrow: "text-[0.65rem] tracking-[0.28em] text-stone-500",
    title: "text-[1.55rem] sm:text-[1.85rem]",
    description: "hidden",
  },
  hero: {
    wrapper: "gap-2.5",
    eyebrow: "text-[0.72rem] tracking-[0.3em] text-orange-600",
    title: "text-4xl sm:text-[4.5rem]",
    description: "block text-sm leading-6 text-stone-500 sm:text-base",
  },
} as const;

function BrandMarkInner({
  variant = "compact",
  className = "",
}: Omit<BrandMarkProps, "href">) {
  const classes = variantClassMap[variant];

  return (
    <span className={`inline-flex min-w-0 flex-col ${classes.wrapper} ${className}`.trim()}>
      <span
        className={`truncate font-semibold tracking-[-0.07em] text-stone-950 ${classes.title}`}
      >
        알뜰맵
      </span>
      <span className={classes.description}>
        동네 가격을 기록하고, 다시 찾기 쉽게 묶어 두는 지도
      </span>
    </span>
  );
}

export function BrandMark({
  href,
  variant = "compact",
  className,
}: BrandMarkProps) {
  if (!href) {
    return <BrandMarkInner variant={variant} className={className} />;
  }

  return (
    <Link href={href} aria-label="알뜰맵 홈" className="inline-flex min-w-0">
      <BrandMarkInner variant={variant} className={className} />
    </Link>
  );
}
