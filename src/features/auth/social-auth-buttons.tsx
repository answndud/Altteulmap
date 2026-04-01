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
  kakao: "bg-black/10 text-stone-900",
  naver: "bg-white/14 text-white",
};

export function SocialAuthButtons({
  callbackUrl,
  providers,
  intent,
  onStart,
}: SocialAuthButtonsProps) {
  const [pendingProvider, setPendingProvider] =
    useState<SocialAuthProviderId | null>(null);
  const [isPending, startTransition] = useTransition();
  const isBusy = isPending || pendingProvider !== null;

  return (
    <div className="grid gap-3">
      {providers.map((provider) =>
        provider.enabled ? (
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
            className={`altteulmap-button altteulmap-brand-button ${providerClassNameMap[provider.id]} flex w-full items-center gap-3 px-4 py-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.9rem] text-sm font-semibold ${providerBadgeClassNameMap[provider.id]}`}
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
            <span aria-hidden className="text-sm opacity-70">
              →
            </span>
          </button>
        ) : (
          <div
            key={provider.id}
            className="rounded-[1.4rem] border border-dashed border-stone-300 bg-white/75 px-4 py-4"
          >
            <p className="text-sm font-medium text-stone-900">
              {provider.label} 연동 준비 중
            </p>
            <p className="mt-1 text-sm leading-6 text-stone-500">
              {provider.unavailableReason ??
                "현재 환경에서는 이 로그인 방식을 아직 사용할 수 없습니다."}
            </p>
          </div>
        ),
      )}
    </div>
  );
}
