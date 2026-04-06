import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AdminRootPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center px-4 py-16 sm:px-6">
      <section className="w-full rounded-[2rem] border border-stone-200 bg-white p-8 shadow-[0_20px_60px_-36px_rgba(28,25,23,0.35)]">
        <p className="text-sm font-medium tracking-[0.2em] text-stone-400">ALTTEULMAP ADMIN</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-stone-900">
          운영 콘솔로 이동
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          관리자 페이지는 별도 Worker로 분리되어 있습니다. 아래에서 바로 이동하면 됩니다.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-stone-900 bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700"
          >
            관리자 홈
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:bg-stone-100"
          >
            로그인
          </Link>
        </div>
      </section>
    </main>
  );
}
