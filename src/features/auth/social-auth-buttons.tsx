"use client";

import { signIn } from "next-auth/react";
import { useState, useTransition } from "react";

import {
  socialAuthProviderLabelMap,
  socialAuthProviderMonogramMap,
  type SocialAuthProviderAvailability,
  type SocialAuthProviderId,
} from "@/features/auth/constants";

type SocialAuthButtonsProps = {
  callbackUrl: string;
  providers: SocialAuthProviderAvailability[];
  intent: "login" | "signup";
  onStart?: () => void;
};

const providerClassNameMap: Record<SocialAuthProviderId, string> = {
  kakao: "altteulmap-brand-kakao",
  naver: "altteulmap-brand-naver",
};

const providerBadgeClassNameMap: Record<SocialAuthProviderId, string> = {
  kakao: "bg-[#291d06]/10 text-[#291d06]",
  naver: "bg-white/16 text-white",
};

export function SocialAuthButtons({
  callbackUrl,
  providers,
  intent,
  onStart,
}: SocialAuthButtonsProps) {
  const enabledProviders = providers.filter((provider) => provider.enabled);
  const [pendingProvider, setPendingProvider] =
    useState<SocialAuthProviderId | null>(null);
  const [isPending, startTransition] = useTransition();
  const isBusy = isPending || pendingProvider !== null;

  if (enabledProviders.length === 0) {
    return (
      <div className="rounded-[1.25rem] border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-500">
        카카오와 네이버 소셜 로그인은 아직 준비 중입니다.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {enabledProviders.map((provider) => (
        <button
          key={provider.id}
          type="button"
          disabled={isBusy}
          data-testid={`social-login-${provider.id}`}
          onClick={() => {
            onStart?.();
            startTransition(() => {
              setPendingProvider(provider.id);
              void signIn(provider.id, { callbackUrl }).finally(() => {
                setPendingProvider(null);
              });
            });
          }}
          className={`altteulmap-button altteulmap-brand-button ${providerClassNameMap[provider.id]} flex w-full items-center gap-3 px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.8rem] text-sm font-semibold ${providerBadgeClassNameMap[provider.id]}`}
          >
            {socialAuthProviderMonogramMap[provider.id]}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold">
              {pendingProvider === provider.id
                ? `${socialAuthProviderLabelMap[provider.id]}로 이동 중...`
                : intent === "signup"
                  ? `${socialAuthProviderLabelMap[provider.id]}로 시작하기`
                  : `${socialAuthProviderLabelMap[provider.id]}로 로그인`}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
