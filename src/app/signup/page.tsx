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
    <main className="min-h-screen bg-stone-50 px-4 py-10 sm:px-6">
      <section className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-[32rem] flex-col justify-center gap-6">
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
