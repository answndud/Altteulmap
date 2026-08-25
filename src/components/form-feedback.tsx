import type { ReactNode } from "react";

type FieldErrorProps = {
  children?: ReactNode;
  as?: "span" | "p";
};

export function FieldError({ children, as = "span" }: FieldErrorProps) {
  if (!children) {
    return null;
  }

  const className = "text-xs text-rose-600";

  return as === "p" ? (
    <p className={className}>{children}</p>
  ) : (
    <span className={className}>{children}</span>
  );
}

type ResultMessageProps = {
  children: ReactNode;
  isOk: boolean;
  testId?: string;
  className?: string;
  errorClassName?: string;
  okClassName?: string;
};

export function ResultMessage({
  children,
  errorClassName = "border border-rose-200 bg-rose-50 text-rose-800",
  isOk,
  okClassName = "border border-emerald-200 bg-emerald-50 text-emerald-800",
  testId,
  className = "rounded-[1rem] px-4 py-3 text-sm",
}: ResultMessageProps) {
  const toneClassName = isOk ? okClassName : errorClassName;

  return (
    <div
      data-testid={testId}
      role={isOk ? "status" : "alert"}
      aria-live={isOk ? "polite" : "assertive"}
      className={`${className} ${toneClassName}`}
    >
      {children}
    </div>
  );
}
