import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-orange-600">
          Altteulmap
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          내 주변의 절약 가능한 장소를 지도에서 빠르게 찾는 서비스
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg">
          알뜰맵 초기 개발 환경이 설정되었습니다. 지금은 로컬 기준으로 Next.js
          개발을 진행하고, Cloudflare Workers 배포는 계정 준비 후 이어서 붙일 수
          있도록 구조를 맞춰둔 상태입니다.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/map"
            className="rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-700"
          >
            지도 화면 보기
          </Link>
          <Link
            href="/submit"
            className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
          >
            등록 화면 보기
          </Link>
        </div>
        <div className="mt-10 flex flex-wrap gap-3 text-sm text-stone-600">
          <span className="rounded-full border border-stone-300 px-4 py-2">
            Next.js 16
          </span>
          <span className="rounded-full border border-stone-300 px-4 py-2">
            Tailwind CSS 4
          </span>
          <span className="rounded-full border border-stone-300 px-4 py-2">
            OpenNext for Cloudflare
          </span>
          <span className="rounded-full border border-stone-300 px-4 py-2">
            Drizzle ORM
          </span>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-stone-900">
              지금 준비된 기반
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-stone-600">
              <li>Next.js App Router + Tailwind CSS</li>
              <li>Cloudflare Workers/OpenNext 설정</li>
              <li>Drizzle + PostgreSQL 스키마 기반</li>
              <li>핵심 화면 라우트 구조</li>
            </ul>
          </section>
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-stone-900">
              다음 작업 순서
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-stone-600">
              <li>Supabase 프로젝트 생성 후 DATABASE_URL 연결</li>
              <li>카테고리 시드와 첫 마이그레이션 생성</li>
              <li>지도 SDK와 목록 필터 UI 구현</li>
              <li>Auth.js 로그인 연동</li>
            </ul>
          </section>
        </div>
      </section>
    </main>
  );
}
