import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { listSocialAuthProviders } from "@/features/auth/repository";
import { LoginForm } from "@/features/auth/login-form";
import {
  createSignupHref,
  getSessionUser,
  normalizeCallbackUrl,
} from "@/lib/session";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "로그인",
  alternates: {
    canonical: "/login",
  },
};

function getFirstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = normalizeCallbackUrl(getFirstValue(params.callbackUrl));
  const error = getFirstValue(params.error) ?? null;
  const user = await getSessionUser();
  const socialProviders = listSocialAuthProviders();
  const signupHref = createSignupHref(callbackUrl);

  if (user) {
    redirect(callbackUrl);
  }

  return (
    <main className="bg-[var(--altteul-bg-canvas)] px-4 py-6 sm:px-6 sm:py-8">
      <section className="mx-auto flex min-h-[calc(100dvh-7rem)] max-w-[26rem] flex-col justify-center">
        <LoginForm
          callbackUrl={callbackUrl}
          initialError={error}
          signupHref={signupHref}
          socialProviders={socialProviders}
        />
      </section>
    </main>
  );
}
