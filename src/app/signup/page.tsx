import type { Metadata } from "next";
import { redirect } from "next/navigation";

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
    <main className="bg-[var(--altteul-bg-canvas)] px-4 py-6 sm:px-6 sm:py-8">
      <section className="mx-auto flex min-h-[calc(100dvh-7rem)] max-w-[26rem] flex-col justify-center">
        <SignupForm
          callbackUrl={callbackUrl}
          loginHref={loginHref}
          socialProviders={socialProviders}
          credentialsSignupEnabled={credentialsSignupEnabled}
        />
      </section>
    </main>
  );
}
