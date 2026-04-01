"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  appUserRoleLabelMap,
  authAccountHints,
  socialAuthProviderLabelMap,
  type SocialAuthProviderId,
} from "@/features/auth/constants";

const errorMessageMap: Record<string, string> = {
  CredentialsSignin: "이메일 또는 비밀번호가 맞지 않습니다.",
  OAuthEmailRequired: "소셜 로그인 계정에서 이메일을 가져오지 못했습니다.",
  OAuthAccountSyncFailed:
    "소셜 로그인 계정을 로컬 사용자와 연결하지 못했습니다.",
  OAuthSignin: "소셜 로그인 연결에 실패했습니다. 잠시 후 다시 시도해주세요.",
  OAuthCallback:
    "소셜 로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
  default: "로그인 처리에 실패했습니다. 잠시 후 다시 시도해주세요.",
};

type SocialProviderOption = {
  id: SocialAuthProviderId;
  label: string;
  enabled: boolean;
  unavailableReason?: string;
};

type LoginFormProps = {
  callbackUrl: string;
  initialError?: string | null;
  socialProviders: SocialProviderOption[];
};

export function LoginForm({
  callbackUrl,
  initialError = null,
  socialProviders,
}: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(authAccountHints[0]?.email ?? "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(
    initialError ? errorMessageMap[initialError] ?? errorMessageMap.default : "",
  );
  const [pendingAction, setPendingAction] = useState<
    "credentials" | SocialAuthProviderId | null
  >(null);
  const [isPending, startTransition] = useTransition();
  function getSocialButtonClass(providerId: SocialAuthProviderId) {
    if (providerId === "kakao") {
      return "bg-[#FEE500] text-stone-900 hover:bg-[#f7d900]";
    }

    return "bg-[#03C75A] text-white hover:bg-[#02b351]";
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <form
        onSubmit={(event) => {
          event.preventDefault();

          startTransition(async () => {
            setMessage("");

            const result = await signIn("credentials", {
              email,
              password,
              redirect: false,
              callbackUrl,
            });

            if (!result) {
              setMessage(errorMessageMap.default);
              return;
            }

            if (result.error) {
              setMessage(
                errorMessageMap[result.error] ?? errorMessageMap.default,
              );
              return;
            }

            router.replace(callbackUrl);
            router.refresh();
          });
        }}
        data-testid="login-form"
        className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="grid gap-6">
          <section>
            <p className="text-xs font-medium tracking-[0.18em] text-orange-600">
              로그인
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
              로그인
            </h1>
          </section>

          <section className="grid gap-3">
            <p className="text-sm font-medium text-stone-700">소셜 로그인</p>
            <div className="grid gap-3">
              {socialProviders.map((provider) =>
                provider.enabled ? (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => {
                      startTransition(async () => {
                        setMessage("");
                        setPendingAction(provider.id);
                        await signIn(provider.id, {
                          callbackUrl,
                        });
                        setPendingAction(null);
                      });
                    }}
                    disabled={isPending}
                    data-testid={`social-login-${provider.id}`}
                    className={`whitespace-nowrap rounded-full px-5 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${getSocialButtonClass(
                      provider.id,
                    )}`}
                  >
                    {pendingAction === provider.id
                      ? `${socialAuthProviderLabelMap[provider.id]}로 이동 중...`
                      : `${socialAuthProviderLabelMap[provider.id]}로 로그인`}
                  </button>
                ) : (
                  <div
                    key={provider.id}
                    className="rounded-3xl border border-dashed border-stone-300 bg-stone-50 px-4 py-4"
                  >
                    <p className="text-sm font-medium text-stone-900">
                      {provider.label} 로그인 준비 중
                    </p>
                  </div>
                ),
              )}
            </div>
          </section>

          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-stone-400">
            <span className="h-px flex-1 bg-stone-200" />
            또는
            <span className="h-px flex-1 bg-stone-200" />
          </div>

          <label className="grid gap-2 text-sm text-stone-700">
            이메일
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              data-testid="login-email"
              className="rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
              placeholder="demo@altteulmap.local"
              autoComplete="email"
            />
          </label>

          <label className="grid gap-2 text-sm text-stone-700">
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              data-testid="login-password"
              className="rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
              placeholder="비밀번호"
              autoComplete="current-password"
            />
          </label>

          {message ? (
            <div className="rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-800">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            data-testid="login-submit"
            className="altteulmap-accent-solid whitespace-nowrap rounded-full px-5 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === "credentials" || isPending
              ? "로그인 중..."
              : "이메일로 로그인"}
          </button>
        </div>
      </form>

      <aside className="space-y-6">
        <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium tracking-[0.18em] text-orange-600">
            테스트 계정
          </p>
          <h2 className="mt-3 text-xl font-semibold text-stone-900">
            바로 확인해볼 계정
          </h2>
          <div className="mt-4 grid gap-3">
            {authAccountHints.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setMessage("");
                }}
                className="rounded-3xl border border-stone-200 bg-stone-50 px-4 py-4 text-left transition hover:border-stone-300 hover:bg-stone-100"
              >
                <p className="text-sm font-semibold text-stone-900">
                  {appUserRoleLabelMap[account.role]}
                </p>
                <p className="mt-1 text-sm text-stone-600">{account.email}</p>
                <p className="mt-2 text-xs text-stone-500">
                  비밀번호는 로컬 설정값을 사용합니다.
                </p>
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
