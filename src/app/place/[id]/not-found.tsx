import Link from "next/link";

export default function PlaceNotFound() {
  return (
    <main className="bg-[var(--altteul-bg-canvas)] px-4 py-8 sm:px-6 sm:py-10">
      <section className="mx-auto grid min-h-[calc(100dvh-8rem)] max-w-3xl place-items-center">
        <div className="w-full rounded-[1.25rem] border border-stone-200 bg-[var(--altteul-bg-surface)] p-6 text-center shadow-sm sm:p-8">
          <p className="altteulmap-section-kicker">장소 없음</p>
          <h1 className="mt-3 break-keep text-2xl font-semibold leading-9 text-stone-950 sm:text-3xl">
            이 장소를 찾을 수 없어요
          </h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            삭제됐거나 아직 공개되지 않은 장소일 수 있습니다. 지도로 돌아가서
            주변 가격을 다시 확인하거나, 알고 있는 장소라면 새로 제보해 주세요.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href="/"
              className="altteulmap-accent-solid altteulmap-button inline-flex items-center justify-center px-5 py-3 text-sm font-medium"
            >
              지도로 돌아가기
            </Link>
            <Link
              href="/submit"
              className="altteulmap-button inline-flex items-center justify-center px-5 py-3 text-sm font-medium text-stone-700"
            >
              장소 등록하기
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
