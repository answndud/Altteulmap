import { PlaceholderScreen } from "@/components/placeholder-screen";

export default function BookmarksPage() {
  return (
    <PlaceholderScreen
      eyebrow="Bookmarks"
      title="북마크 화면 준비 중"
      description="회원 기능이 아직 붙지 않았기 때문에 저장 목록은 플레이스홀더 상태입니다. Auth.js가 연결되면 바로 사용자별 북마크를 조회할 수 있도록 스키마는 먼저 준비해두었습니다."
      checklist={[
        "회원별 저장 장소 목록",
        "최근 저장순 정렬",
        "북마크 해제",
        "상세 페이지 재진입",
      ]}
    />
  );
}
