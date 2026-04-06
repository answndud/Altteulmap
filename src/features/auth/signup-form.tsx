"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState, useTransition } from "react";

import { type SocialAuthProviderAvailability } from "@/features/auth/constants";
import { SocialAuthButtons } from "@/features/auth/social-auth-buttons";
import { getRateLimitFeedbackMessage } from "@/lib/rate-limit-feedback";

type SignupFormProps = {
  callbackUrl: string;
  loginHref: string;
  socialProviders: SocialAuthProviderAvailability[];
  credentialsSignupEnabled: boolean;
};

type SignupActionResponse = {
  ok: boolean;
  message: string;
  retryAfterMs?: number;
};

export function SignupForm({
  callbackUrl,
  loginHref,
  socialProviders,
  credentialsSignupEnabled,
}: SignupFormProps) {
  const hasEnabledSocialProviders = socialProviders.some((provider) => provider.enabled);
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const canSubmit =
    credentialsSignupEnabled &&
    email.trim().length > 0 &&
    nickname.trim().length > 0 &&
    password.length >= 8 &&
    passwordConfirm.length >= 8;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();

        if (!credentialsSignupEnabled) {
          setMessage("회원가입은 데이터 연결 후 사용할 수 있습니다.");
          return;
        }

        if (password !== passwordConfirm) {
          setMessage("비밀번호 확인이 일치하지 않습니다.");
          return;
        }

        startTransition(async () => {
          setMessage("");

          const response = await fetch("/api/auth/signup", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              nickname,
              password,
            }),
          });

          const result = (await response.json()) as SignupActionResponse;

          if (!response.ok || !result.ok) {
            setMessage(
              getRateLimitFeedbackMessage({
                response,
                message: result.message,
                retryAfterMs: result.retryAfterMs,
                defaultMessage: "회원가입 요청이 너무 빠릅니다.",
              }),
            );
            return;
          }

          const loginResult = await signIn("credentials", {
            email,
            password,
            redirect: false,
            callbackUrl,
          });

          if (!loginResult || loginResult.error) {
            setMessage(
              "회원가입은 완료됐지만 자동 로그인에 실패했습니다. 로그인 화면에서 다시 시도해주세요.",
            );
            return;
          }

          window.location.assign(loginResult.url ?? callbackUrl);
        });
      }}
      data-testid="signup-form"
      className="rounded-[1.8rem] border border-stone-200 bg-white p-5 shadow-sm sm:p-7"
    >
      <div className="grid gap-5">
        <section>
          <h1 className="text-[1.85rem] font-semibold tracking-[-0.06em] text-stone-950">
            회원가입
          </h1>
        </section>

        <section className="grid gap-4">
          <label className="grid gap-2 text-sm text-stone-700">
            닉네임
            <input
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              disabled={isPending || !credentialsSignupEnabled}
              data-testid="signup-nickname"
              className="altteulmap-input px-4 py-3.5 text-stone-900"
              placeholder="표시 이름"
              autoComplete="nickname"
            />
          </label>

          <label className="grid gap-2 text-sm text-stone-700">
            이메일
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isPending || !credentialsSignupEnabled}
              data-testid="signup-email"
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
              disabled={isPending || !credentialsSignupEnabled}
              data-testid="signup-password"
              className="altteulmap-input px-4 py-3.5 text-stone-900"
              placeholder="8자 이상"
              autoComplete="new-password"
            />
          </label>

          <label className="grid gap-2 text-sm text-stone-700">
            비밀번호 확인
            <input
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              disabled={isPending || !credentialsSignupEnabled}
              data-testid="signup-password-confirm"
              className="altteulmap-input px-4 py-3.5 text-stone-900"
              placeholder="비밀번호 다시 입력"
              autoComplete="new-password"
            />
          </label>
        </section>

        {message ? (
          <div
            data-testid="signup-message"
            className="rounded-[1.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {message}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isPending || !canSubmit}
          data-testid="signup-submit"
          className="altteulmap-accent-solid altteulmap-button whitespace-nowrap px-5 py-3.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "가입 중..." : "회원가입"}
        </button>

        {hasEnabledSocialProviders ? (
          <>
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-stone-400">
              <span className="h-px flex-1 bg-stone-200" />
              또는
              <span className="h-px flex-1 bg-stone-200" />
            </div>

            <section className="grid gap-3">
              <p className="text-sm font-medium text-stone-700">소셜 회원가입</p>
              <SocialAuthButtons
                callbackUrl={callbackUrl}
                providers={socialProviders}
                intent="signup"
                onStart={() => {
                  setMessage("");
                }}
              />
            </section>
          </>
        ) : null}

        <div className="flex items-center justify-between border-t border-stone-200 pt-4 text-sm text-stone-500">
          <span>이미 계정이 있나요?</span>
          <Link
            href={loginHref}
            className="font-medium text-stone-700 transition hover:text-stone-950"
          >
            로그인
          </Link>
        </div>
      </div>
    </form>
  );
}
