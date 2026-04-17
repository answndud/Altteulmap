import Link from "next/link";

type BrandMarkProps = {
  href?: string;
  variant?: "compact" | "hero";
  className?: string;
  prefetch?: boolean;
};

const variantClassMap = {
  compact: {
    wrapper: "gap-0.5",
    eyebrow: "hidden",
    title: "text-[1.22rem] font-semibold tracking-[-0.06em] sm:text-[1.42rem]",
    description: "hidden",
  },
  hero: {
    wrapper: "gap-2",
    eyebrow: "altteulmap-section-kicker",
    title: "text-[2.2rem] font-semibold tracking-[-0.07em] text-stone-950 sm:text-[3.35rem]",
    description: "block max-w-xl text-sm leading-6 text-stone-600 sm:text-base",
  },
} as const;

function BrandMarkInner({
  variant = "compact",
  className = "",
}: Omit<BrandMarkProps, "href">) {
  const classes = variantClassMap[variant];

  return (
    <span className={`inline-flex min-w-0 flex-col ${classes.wrapper} ${className}`.trim()}>
      <span className={classes.eyebrow}>동네 가격 지도</span>
      <span
        className={`truncate text-stone-950 ${classes.title}`}
      >
        알뜰맵
      </span>
      <span className={classes.description}>
        내 주변에서 다시 찾게 되는 가격과 생활 장소를 빠르게 확인하는 지도
      </span>
    </span>
  );
}

export function BrandMark({
  href,
  variant = "compact",
  className,
  prefetch = false,
}: BrandMarkProps) {
  if (!href) {
    return <BrandMarkInner variant={variant} className={className} />;
  }

  return (
    <Link
      href={href}
      prefetch={prefetch}
      aria-label="알뜰맵 홈"
      className="inline-flex min-w-0"
    >
      <BrandMarkInner variant={variant} className={className} />
    </Link>
  );
}
