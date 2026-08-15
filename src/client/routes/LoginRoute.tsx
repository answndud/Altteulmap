import { Link, useSearchParams } from "react-router-dom";
import { useState, useTransition } from "react";

import {
  createSignupHref,
  normalizeCallbackUrl,
} from "@/lib/auth-navigation";

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

type CredentialsCallbackResponse = {
  url?: string;
};

function getInitialErrorMessage(error: string | null) {
  if (!error) {
    return "";
  }

  return errorMessageMap[error] ?? errorMessageMap.default;
}

export function LoginRoute() {
  const [searchParams] = useSearchParams();
  const callbackUrl = normalizeCallbackUrl(searchParams.get("callbackUrl"));
  const signupHref = createSignupHref(callbackUrl);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(
    getInitialErrorMessage(searchParams.get("error")),
  );
  const [isPending, startTransition] = useTransition();
  const canSubmit = email.trim().length > 0 && password.length > 0;

  return (
    <main className="bg-[var(--altteul-bg-canvas)] px-4 py-6 sm:px-6 sm:py-8">
      <section className="mx-auto flex min-h-[calc(100dvh-7rem)] max-w-[26rem] flex-col justify-center">
        <form
          onSubmit={(event) => {
            event.preventDefault();

            startTransition(async () => {
              setMessage("");

              const body = new URLSearchParams({
                email,
                password,
                callbackUrl,
                json: "true",
              });
              const response = await fetch("/api/auth/callback/credentials", {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body,
              });
              const result =
                (await response.json().catch(() => null)) as CredentialsCallbackResponse | null;

              if (!response.ok) {
                const errorUrl = result?.url ? new URL(result.url, window.location.origin) : null;
                const error = errorUrl?.searchParams.get("error");
                setMessage(errorMessageMap[error ?? ""] ?? errorMessageMap.default);
                return;
              }

              window.location.assign(result?.url ?? callbackUrl);
            });
          }}
          data-testid="login-form"
          className="altteulmap-panel p-5 sm:p-6"
        >
          <div className="grid gap-5">
            <div className="grid gap-1.5">
              <p className="altteulmap-section-kicker">계정</p>
              <h1 className="text-[1.8rem] font-semibold text-stone-950">
                로그인
              </h1>
              <p className="text-sm text-stone-500">
                저장한 장소를 다시 확인해 보세요.
              </p>
            </div>

            <section className="grid gap-3">
              <label className="grid gap-2 text-sm text-stone-700">
                이메일
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isPending}
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
                  disabled={isPending}
                  data-testid="login-password"
                  className="altteulmap-input px-4 py-3.5 text-stone-900"
                  placeholder="비밀번호"
                  autoComplete="current-password"
                />
              </label>
            </section>

            {message ? (
              <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isPending || !canSubmit}
              data-testid="login-submit"
              className="altteulmap-accent-solid altteulmap-button whitespace-nowrap px-5 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "로그인 중..." : "로그인"}
            </button>

            <div className="grid gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-xs leading-5 text-stone-500">
              <p>이메일 로그인과 카카오/네이버 소셜 로그인을 지원합니다.</p>
              <p>로그인 후 저장한 장소와 운영자 권한을 계정에 맞게 이용할 수 있습니다.</p>
            </div>

            <div className="flex items-center justify-center border-t border-stone-200 pt-4 text-sm text-stone-500">
              <Link
                to={signupHref}
                className="font-medium text-stone-700 transition hover:text-stone-950"
              >
                회원가입
              </Link>
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}
