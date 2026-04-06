"use client";

import { useState, type ReactNode } from "react";

type RouteResetDetailsProps = {
  bodyClassName?: string;
  children: ReactNode;
  className?: string;
  summary: ReactNode;
  summaryClassName?: string;
};

export function RouteResetDetails({
  bodyClassName,
  children,
  className,
  summary,
  summaryClassName,
}: RouteResetDetailsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details open={isOpen} className={className}>
      <summary
        className={summaryClassName}
        onClick={(event) => {
          event.preventDefault();
          setIsOpen((current) => !current);
        }}
      >
        {summary}
      </summary>
      {isOpen ? <div className={bodyClassName}>{children}</div> : null}
    </details>
  );
}
