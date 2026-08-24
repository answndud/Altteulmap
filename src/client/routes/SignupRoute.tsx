import { Link, useSearchParams } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

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

const signupSchema = z
  .object({
    nickname: z.string().trim().min(1, "닉네임을 입력해주세요."),
    email: z.string().email("올바른 이메일 주소를 입력해주세요."),
    password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
    passwordConfirm: z.string().min(8, "비밀번호 확인을 입력해주세요."),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    message: "비밀번호 확인이 일치하지 않습니다.",
    path: ["passwordConfirm"],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

export function SignupRoute() {
  const [searchParams] = useSearchParams();
  const callbackUrl = normalizeCallbackUrl(searchParams.get("callbackUrl"));
  const loginHref = createLoginHref(callbackUrl);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    mode: "onChange",
    defaultValues: {
      nickname: "",
      email: "",
      password: "",
      passwordConfirm: "",
    },
  });
  const values = watch();
  const canSubmit =
    values.email.trim().length > 0 &&
    values.nickname.trim().length > 0 &&
    values.password.length >= 8 &&
    values.passwordConfirm.length >= 8;

  async function onSubmit(formValues: SignupFormValues) {
    startTransition(async () => {
      setMessage("");

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formValues.email,
          nickname: formValues.nickname,
          password: formValues.password,
        }),
      });
      const result =
        (await response
          .json()
          .catch(() => null)) as SignupActionResponse | null;

      if (!response.ok || !result?.ok) {
        setMessage(
          result?.message ??
            "회원가입 처리에 실패했습니다. 잠시 후 다시 시도해주세요.",
        );
        return;
      }

      const loginBody = new URLSearchParams({
        email: formValues.email,
        password: formValues.password,
        callbackUrl,
        json: "true",
      });
      const loginResponse = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: loginBody,
      });
      const loginResult =
        (await loginResponse
          .json()
          .catch(() => null)) as CredentialsCallbackResponse | null;

      if (!loginResponse.ok) {
        setMessage(
          "회원가입은 완료됐지만 자동 로그인에 실패했습니다. 로그인 화면에서 다시 시도해주세요.",
        );
        return;
      }

      window.location.assign(loginResult?.url ?? callbackUrl);
    });
  }

  return (
    <main className="bg-[var(--altteul-bg-canvas)] px-4 py-6 sm:px-6 sm:py-8">
      <section className="mx-auto flex min-h-[calc(100dvh-7rem)] max-w-[26rem] flex-col justify-center">
        <form onSubmit={handleSubmit(onSubmit)} data-testid="signup-form"
          className="altteulmap-panel p-5 sm:p-6"
        >
          <div className="grid gap-5">
            <div className="grid gap-1.5">
              <p className="altteulmap-section-kicker">계정</p>
              <h1 className="text-[1.8rem] font-semibold text-[var(--altteul-text-strong)]">
                회원가입
              </h1>
              <p className="text-sm text-[var(--altteul-text-tertiary)]">
                북마크와 제보 내역을 계정에 연결합니다.
              </p>
            </div>

            <section className="grid gap-3">
              <label className="grid gap-2 text-sm text-[var(--altteul-text-secondary)]">
                닉네임
                <input
                  type="text"
                  disabled={isPending}
                  data-testid="signup-nickname"
                  aria-invalid={Boolean(errors.nickname)}
                  className="altteulmap-input px-4 py-3.5 text-[var(--altteul-text-primary)]"
                  placeholder="표시 이름"
                  autoComplete="nickname"
                  {...register("nickname")}
                />
              </label>
              {errors.nickname ? (
                <p className="text-xs text-[var(--altteul-danger-text)]" role="alert">
                  {errors.nickname.message}
                </p>
              ) : null}

              <label className="grid gap-2 text-sm text-[var(--altteul-text-secondary)]">
                이메일
                <input
                  type="email"
                  disabled={isPending}
                  data-testid="signup-email"
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
                  data-testid="signup-password"
                  aria-invalid={Boolean(errors.password)}
                  className="altteulmap-input px-4 py-3.5 text-[var(--altteul-text-primary)]"
                  placeholder="8자 이상"
                  autoComplete="new-password"
                  {...register("password")}
                />
              </label>
              {errors.password ? (
                <p className="text-xs text-[var(--altteul-danger-text)]" role="alert">
                  {errors.password.message}
                </p>
              ) : null}

              <label className="grid gap-2 text-sm text-[var(--altteul-text-secondary)]">
                비밀번호 확인
                <input
                  type="password"
                  disabled={isPending}
                  data-testid="signup-password-confirm"
                  aria-invalid={Boolean(errors.passwordConfirm)}
                  className="altteulmap-input px-4 py-3.5 text-[var(--altteul-text-primary)]"
                  placeholder="비밀번호 다시 입력"
                  autoComplete="new-password"
                  {...register("passwordConfirm")}
                />
              </label>
              {errors.passwordConfirm ? (
                <p className="text-xs text-[var(--altteul-danger-text)]" role="alert">
                  {errors.passwordConfirm.message}
                </p>
              ) : null}
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

            <div className="grid gap-2 rounded-2xl border border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-subtle)] px-4 py-3 text-xs leading-5 text-[var(--altteul-text-tertiary)]">
              <p>회원가입 후 같은 계정으로 북마크와 제보 내역을 이어서 관리할 수 있습니다.</p>
              <p>입력한 비밀번호는 안전하게 해시 처리되어 저장됩니다.</p>
            </div>

            <div className="flex items-center justify-center border-t border-[var(--altteul-surface-border)] pt-4 text-sm text-[var(--altteul-text-tertiary)]">
              <Link
                to={loginHref}
                className="font-medium text-[var(--altteul-text-secondary)] transition hover:text-[var(--altteul-text-strong)]"
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
