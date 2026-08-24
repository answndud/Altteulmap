import { Link, useSearchParams } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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

const loginSchema = z.object({
  email: z.string().email("올바른 이메일 주소를 입력해주세요."),
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

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
  const [message, setMessage] = useState(
    getInitialErrorMessage(searchParams.get("error")),
  );
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const email = watch("email");
  const password = watch("password");
  const canSubmit = email.trim().length > 0 && password.length > 0;

  async function onSubmit(values: LoginFormValues) {
    startTransition(async () => {
      setMessage("");
      const body = new URLSearchParams({
        email: values.email,
        password: values.password,
        callbackUrl,
        json: "true",
      });
      const response = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const result =
        (await response
          .json()
          .catch(() => null)) as CredentialsCallbackResponse | null;
      if (!response.ok) {
        const errorUrl = result?.url
          ? new URL(result.url, window.location.origin)
          : null;
        const error = errorUrl?.searchParams.get("error");
        setMessage(errorMessageMap[error ?? ""] ?? errorMessageMap.default);
        return;
      }
      window.location.assign(result?.url ?? callbackUrl);
    });
  }

  return (
    <main className="bg-[var(--altteul-bg-canvas)] px-4 py-6 sm:px-6 sm:py-8">
      <section className="mx-auto flex min-h-[calc(100dvh-7rem)] max-w-[26rem] flex-col justify-center">
        <form onSubmit={handleSubmit(onSubmit)} data-testid="login-form"
          className="altteulmap-panel p-5 sm:p-6"
        >
          <div className="grid gap-5">
            <div className="grid gap-1.5">
              <p className="altteulmap-section-kicker">계정</p>
              <h1 className="text-[1.8rem] font-semibold text-[var(--altteul-text-strong)]">
                로그인
              </h1>
              <p className="text-sm text-[var(--altteul-text-tertiary)]">
                저장한 장소와 북마크를 이어서 봅니다.
              </p>
            </div>

            <section className="grid gap-3">
              <label className="grid gap-2 text-sm text-[var(--altteul-text-secondary)]">
                이메일
                <input
                  type="email"
                  disabled={isPending}
                  data-testid="login-email"
                  aria-invalid={Boolean(errors.email)}
                  className="altteulmap-input px-4 py-3.5 text-[var(--altteul-text-primary)]"
                  placeholder="이메일 주소"
                  autoComplete="email"
                  {...register("email")}
                />
              </label>
              {errors.email ? (
                <p className="text-xs text-[var(--altteul-danger-text)]" role="alert">
                  {errors.email.message}
                </p>
              ) : null}

              <label className="grid gap-2 text-sm text-[var(--altteul-text-secondary)]">
                비밀번호
                <input
                  type="password"
                  disabled={isPending}
                  data-testid="login-password"
                  aria-invalid={Boolean(errors.password)}
                  className="altteulmap-input px-4 py-3.5 text-[var(--altteul-text-primary)]"
                  placeholder="비밀번호"
                  autoComplete="current-password"
                  {...register("password")}
                />
              </label>
              {errors.password ? (
                <p className="text-xs text-[var(--altteul-danger-text)]" role="alert">
                  {errors.password.message}
                </p>
              ) : null}
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

            <div className="grid gap-2 rounded-2xl border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-subtle)] px-4 py-3 text-xs leading-5 text-[var(--altteul-text-tertiary)]">
              <p>이메일 로그인과 카카오/네이버 소셜 로그인을 지원합니다.</p>
              <p>로그인 후 저장한 장소와 운영자 권한을 계정에 맞게 이용할 수 있습니다.</p>
            </div>

            <div className="flex items-center justify-center border-t border-[var(--altteul-surface-border)] pt-4 text-sm text-[var(--altteul-text-tertiary)]">
              <Link
                to={signupHref}
                className="font-medium text-[var(--altteul-text-secondary)] transition hover:text-[var(--altteul-text-strong)]"
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
