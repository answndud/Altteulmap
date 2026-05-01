import { Link, useSearchParams } from "react-router-dom";
import { useState, useTransition } from "react";

import {
  createLoginHref,
  normalizeCallbackUrl,
} from "@/lib/auth-navigation";

type SignupActionResponse = {
  ok: boolean;
  message: string;
  retryAfterMs?: number;
};

type CredentialsCallbackResponse = {
  url?: string;
};

export function SignupRoute() {
  const [searchParams] = useSearchParams();
  const callbackUrl = normalizeCallbackUrl(searchParams.get("callbackUrl"));
  const loginHref = createLoginHref(callbackUrl);
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const canSubmit =
    email.trim().length > 0 &&
    nickname.trim().length > 0 &&
    password.length >= 8 &&
    passwordConfirm.length >= 8;

  return (
    <main className="bg-[var(--altteul-bg-canvas)] px-4 py-6 sm:px-6 sm:py-8">
      <section className="mx-auto flex min-h-[calc(100dvh-7rem)] max-w-[26rem] flex-col justify-center">
        <form
          onSubmit={(event) => {
            event.preventDefault();

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
              const result =
                (await response.json().catch(() => null)) as SignupActionResponse | null;

              if (!response.ok || !result?.ok) {
                setMessage(
                  result?.message ??
                    "회원가입 처리에 실패했습니다. 잠시 후 다시 시도해주세요.",
                );
                return;
              }

              const loginBody = new URLSearchParams({
                email,
                password,
                callbackUrl,
                json: "true",
              });
              const loginResponse = await fetch("/api/auth/callback/credentials", {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: loginBody,
              });
              const loginResult =
                (await loginResponse.json().catch(() => null)) as CredentialsCallbackResponse | null;

              if (!loginResponse.ok) {
                setMessage(
                  "회원가입은 완료됐지만 자동 로그인에 실패했습니다. 로그인 화면에서 다시 시도해주세요.",
                );
                return;
              }

              window.location.assign(loginResult?.url ?? callbackUrl);
            });
          }}
          data-testid="signup-form"
          className="altteulmap-panel p-5 sm:p-6"
        >
          <div className="grid gap-5">
            <div className="grid gap-1.5">
              <p className="altteulmap-section-kicker">계정</p>
              <h1 className="text-[1.8rem] font-semibold text-stone-950">
                회원가입
              </h1>
              <p className="text-sm text-stone-500">
                북마크와 제보 내역을 계정에 연결합니다.
              </p>
            </div>

            <section className="grid gap-3">
              <label className="grid gap-2 text-sm text-stone-700">
                닉네임
                <input
                  type="text"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  disabled={isPending}
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
                  disabled={isPending}
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
                  disabled={isPending}
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
                  disabled={isPending}
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
                className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              >
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isPending || !canSubmit}
              data-testid="signup-submit"
              className="altteulmap-accent-solid altteulmap-button whitespace-nowrap px-5 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "가입 중..." : "회원가입"}
            </button>

            <div className="grid gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-xs leading-5 text-stone-500">
              <p>회원가입 후 같은 계정으로 북마크와 제보 내역을 이어서 관리할 수 있습니다.</p>
              <p>입력한 비밀번호는 안전하게 해시 처리되어 저장됩니다.</p>
            </div>

            <div className="flex items-center justify-center border-t border-stone-200 pt-4 text-sm text-stone-500">
              <Link
                to={loginHref}
                className="font-medium text-stone-700 transition hover:text-stone-950"
              >
                로그인
              </Link>
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}
