"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState, useTransition } from "react";

import { type SocialAuthProviderAvailability } from "@/features/auth/constants";
import { SocialAuthButtons } from "@/features/auth/social-auth-buttons";

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

type LoginFormProps = {
  callbackUrl: string;
  initialError?: string | null;
  signupHref: string;
  socialProviders: SocialAuthProviderAvailability[];
};

export function LoginForm({
  callbackUrl,
  initialError = null,
  signupHref,
  socialProviders,
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(
    initialError ? errorMessageMap[initialError] ?? errorMessageMap.default : "",
  );
  const [pendingAction, setPendingAction] = useState<"credentials" | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="w-full max-w-[32rem]">
      <form
        onSubmit={(event) => {
          event.preventDefault();

          startTransition(async () => {
            setMessage("");
            setPendingAction("credentials");

            const result = await signIn("credentials", {
              email,
              password,
              redirect: false,
              callbackUrl,
            });

            if (!result) {
              setPendingAction(null);
              setMessage(errorMessageMap.default);
              return;
            }

            if (result.error) {
              setPendingAction(null);
              setMessage(
                errorMessageMap[result.error] ?? errorMessageMap.default,
              );
              return;
            }

            window.location.assign(result.url ?? callbackUrl);
          });
        }}
        data-testid="login-form"
        className="rounded-[2.15rem] border border-stone-200/80 bg-white/92 p-6 shadow-[0_24px_60px_-42px_rgba(32,24,18,0.38)] backdrop-blur sm:p-8"
      >
        <div className="grid gap-6">
          <section className="flex items-center justify-between gap-3 border-b border-stone-200 pb-5">
            <h1 className="text-3xl font-semibold tracking-[-0.06em] text-stone-950">
              로그인
            </h1>
            <Link
              href={signupHref}
              className="text-sm font-medium text-stone-500 transition hover:text-stone-950"
            >
              회원가입
            </Link>
          </section>

          <section className="grid gap-3">
            <p className="text-sm font-medium text-stone-700">소셜 로그인</p>
            <SocialAuthButtons
              callbackUrl={callbackUrl}
              providers={socialProviders}
              intent="login"
              onStart={() => {
                setMessage("");
                setPendingAction(null);
              }}
            />
          </section>

          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-stone-400">
            <span className="h-px flex-1 bg-stone-200" />
            또는
            <span className="h-px flex-1 bg-stone-200" />
          </div>

          <section className="grid gap-4">
            <p className="text-sm font-medium text-stone-700">이메일 로그인</p>

            <label className="grid gap-2 text-sm text-stone-700">
              이메일
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                data-testid="login-email"
                className="altteulmap-input px-4 py-3.5 text-stone-900"
                placeholder="이메일 주소"
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
                className="altteulmap-input px-4 py-3.5 text-stone-900"
                placeholder="비밀번호"
                autoComplete="current-password"
              />
            </label>
          </section>

          {message ? (
            <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            data-testid="login-submit"
            className="altteulmap-accent-solid altteulmap-button whitespace-nowrap px-5 py-3.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === "credentials"
              ? "로그인 중..."
              : "이메일로 로그인"}
          </button>
        </div>
      </form>
    </div>
  );
}
