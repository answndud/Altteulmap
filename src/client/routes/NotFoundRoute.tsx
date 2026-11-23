import { Link } from "react-router-dom";

export function NotFoundRoute() {
  return (
    <main className="mx-auto grid max-w-xl gap-4 px-4 py-16" data-testid="not-found">
      <p className="altteulmap-section-kicker">404</p>
      <h1 className="text-2xl font-semibold text-[var(--altteul-text-strong)]">
        페이지를 찾을 수 없습니다
      </h1>
      <p className="text-sm leading-6 text-[var(--altteul-text-secondary)]">
        주소가 바뀌었거나 삭제된 페이지입니다. 지도에서 가까운 알뜰 장소를 다시 찾아보세요.
      </p>
      <Link
        to="/"
        className="altteulmap-button altteulmap-accent-solid w-fit px-4 py-2 text-sm"
      >
        지도로 돌아가기
      </Link>
    </main>
  );
}
