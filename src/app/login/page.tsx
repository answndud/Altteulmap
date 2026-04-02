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
    <main className="min-h-screen bg-stone-50 px-4 py-10 sm:px-6">
      <section className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-[32rem] flex-col justify-center gap-6">
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
