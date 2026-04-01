"use client";

import { signOut } from "next-auth/react";
import { useTransition } from "react";

type SignOutButtonProps = {
  callbackUrl?: string;
  compact?: boolean;
};

export function SignOutButton({
  callbackUrl = "/",
  compact = false,
}: SignOutButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => {
        startTransition(async () => {
          await signOut({
            callbackUrl,
          });
        });
      }}
      disabled={isPending}
      data-testid="sign-out-button"
      className={`whitespace-nowrap rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
        compact
          ? "border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-100"
          : "border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
      }`}
    >
      {isPending ? "로그아웃 중..." : "로그아웃"}
    </button>
  );
}
