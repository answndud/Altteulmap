import { PlaceholderScreen } from "@/components/placeholder-screen";

export default function SubmitPage() {
  return (
    <PlaceholderScreen
      eyebrow="Submit"
      title="장소 등록 플로우 준비 중"
      description="로그인과 주소 검색이 아직 연결되지 않아 폼 실구현 전 단계입니다. 대신 필요한 필드 구조와 등록 흐름은 TRD 기준으로 정리해두었습니다."
      checklist={[
        "상호명, 카테고리, 주소 입력",
        "가격 항목 1개 이상 등록",
        "메모 선택 입력",
        "기존 장소에 가격 추가 제보",
      ]}
    />
  );
}
