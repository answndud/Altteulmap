"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  appUserRoleLabelMap,
  authAccountHints,
} from "@/features/auth/constants";

const errorMessageMap: Record<string, string> = {
  CredentialsSignin: "이메일 또는 비밀번호가 맞지 않습니다.",
  default: "로그인 처리에 실패했습니다. 잠시 후 다시 시도해주세요.",
};

type LoginFormProps = {
  callbackUrl: string;
  initialError?: string | null;
};

export function LoginForm({
  callbackUrl,
  initialError = null,
}: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(authAccountHints[0]?.email ?? "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(
    initialError ? errorMessageMap[initialError] ?? errorMessageMap.default : "",
  );
  const [isPending, startTransition] = useTransition();

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
        className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="grid gap-6">
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-600">
              Auth
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
              로컬 로그인
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
              현재 단계에서는 로컬 개발용 credentials 로그인만 연결했습니다.
              북마크, 등록, 신고, 운영자 화면은 로그인 후 같은 세션을
              공유합니다.
            </p>
          </section>

          <label className="grid gap-2 text-sm text-stone-700">
            이메일
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
              className="rounded-2xl border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
              placeholder="로컬 개발용 비밀번호"
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
            className="rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "로그인 중..." : "로그인"}
          </button>
        </div>
      </form>

      <aside className="space-y-6">
        <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">
            Dev accounts
          </p>
          <h2 className="mt-3 text-xl font-semibold text-stone-900">
            준비된 로컬 계정
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
                  비밀번호는 `.env`의 `{account.passwordEnv}` 값을 사용합니다.
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-stone-200 bg-stone-50 p-6">
          <h2 className="text-xl font-semibold text-stone-900">로그인 후 열리는 기능</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-stone-600">
            <li>장소 북마크 저장과 해제</li>
            <li>신규 장소 제보 제출</li>
            <li>오류/중복/폐업 신고 제출</li>
            <li>운영자 계정의 승인 큐와 신고 큐 접근</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
