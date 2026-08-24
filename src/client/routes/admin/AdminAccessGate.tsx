import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { AdminSessionUser, LoadState } from "@/client/routes/admin/types";

export function AdminAccessGate<T>({
  state,
  children,
}: {
  state: LoadState<T>;
  children: (data: T, user: AdminSessionUser) => ReactNode;
}) {
  if (state.status === "loading") {
    return (
      <div className="altteulmap-panel-muted p-6 text-sm text-[var(--altteul-text-secondary)]">
        관리자 데이터를 불러오는 중입니다.
      </div>
    );
  }

  if (state.status === "unauthenticated") {
    return (
      <div className="altteulmap-panel-muted p-6">
        <h2 className="text-xl font-semibold text-[var(--altteul-text-strong)]">로그인이 필요합니다</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--altteul-text-secondary)]">
          관리자 화면은 운영자 계정으로 로그인해야 볼 수 있습니다.
        </p>
        <Link
          to="/login?callbackUrl=/admin"
          className="altteulmap-button altteulmap-accent-solid mt-4 inline-flex px-4 py-2 text-sm"
        >
          로그인하기
        </Link>
      </div>
    );
  }

  if (state.status === "forbidden") {
    return (
      <div className="altteulmap-panel-muted p-6">
        <h2 className="text-xl font-semibold text-[var(--altteul-text-strong)]">
          운영자 권한이 필요합니다
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--altteul-text-secondary)]">
          {state.user.name} 계정은 관리자 작업을 수행할 수 없습니다.
        </p>
        <Link
          to="/login?callbackUrl=/admin"
          className="altteulmap-button border border-[var(--altteul-surface-border-strong)] bg-[var(--altteul-bg-surface)] px-4 py-2 text-sm text-[var(--altteul-text-secondary)]"
        >
          다른 계정으로 로그인
        </Link>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        {state.message}
      </div>
    );
  }

  return children(state.data, state.user);
}
