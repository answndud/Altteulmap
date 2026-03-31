import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth/login-form";
import { getSessionUser, normalizeCallbackUrl } from "@/lib/session";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getFirstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = normalizeCallbackUrl(getFirstValue(params.callbackUrl));
  const error = getFirstValue(params.error) ?? null;
  const user = await getSessionUser();

  if (user) {
    redirect(callbackUrl);
  }

  return (
    <main className="bg-stone-50 px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-7xl">
        <LoginForm callbackUrl={callbackUrl} initialError={error} />
      </section>
    </main>
  );
}
