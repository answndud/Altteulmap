import type { Metadata } from "next";

import Link from "next/link";
import { redirect } from "next/navigation";

import { BrandMark } from "@/components/brand-mark";
import {
  isCredentialsSignupAvailable,
  listSocialAuthProviders,
} from "@/features/auth/repository";
import { SignupForm } from "@/features/auth/signup-form";
import {
  createLoginHref,
  getSessionUser,
  normalizeCallbackUrl,
} from "@/lib/session";

type SignupPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "회원가입",
  alternates: {
    canonical: "/signup",
  },
};

function getFirstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const callbackUrl = normalizeCallbackUrl(getFirstValue(params.callbackUrl));
  const user = await getSessionUser();
  const socialProviders = listSocialAuthProviders();
  const credentialsSignupEnabled = isCredentialsSignupAvailable();
  const loginHref = createLoginHref(callbackUrl);

  if (user) {
    redirect(callbackUrl);
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-10 sm:px-6">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[32rem] flex-col justify-center gap-6">
        <BrandMark href="/" variant="compact" className="max-w-[12rem]" />
        <SignupForm
          callbackUrl={callbackUrl}
          loginHref={loginHref}
          socialProviders={socialProviders}
          credentialsSignupEnabled={credentialsSignupEnabled}
        />
        {!credentialsSignupEnabled ? (
          <p className="px-2 text-sm leading-6 text-stone-500">
            로컬 DB 없이 실행 중이면 회원가입은 저장되지 않습니다. 기존 계정 로그인이
            필요하면 <Link href={loginHref} className="font-medium text-stone-900">로그인</Link>
            을 사용하세요.
          </p>
        ) : null}
      </section>
    </main>
  );
}
