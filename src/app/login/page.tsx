import { PlaceholderScreen } from "@/components/placeholder-screen";

export default function LoginPage() {
  return (
    <PlaceholderScreen
      eyebrow="Auth"
      title="로그인 화면 준비 중"
      description="이메일 매직링크, 카카오, 네이버 로그인을 차례로 붙일 예정입니다. 현재 단계에서는 인증 UI 대신 필요한 데이터 테이블과 라우트만 먼저 준비해둔 상태입니다."
      checklist={[
        "이메일 매직링크",
        "카카오 OAuth",
        "네이버 OAuth",
        "로그인 후 등록/북마크 접근 제어",
      ]}
    />
  );
}
