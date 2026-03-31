---
name: e2e-testing
description: altteulmap의 향후 Playwright E2E 작성 기준
origin: altteulmap
---

# E2E Testing

아직 Playwright가 붙어 있지는 않지만, 이후 E2E는 아래 기준으로 추가한다.

## 우선 대상 흐름
- 지도 첫 진입
- 지역/전역 검색
- 플레이스 상세 시트 열기/닫기
- 로그인 후 북마크
- 장소 등록
- 신고 제출
- 관리자 승인/검토

## 원칙
- 지도와 시트는 `data-testid` 또는 안정적인 role/text 기준을 먼저 만든 뒤 테스트한다.
- 네이버 지도 SDK 자체보다 우리 UI 상태 변화를 검증한다.
- 모바일 시트 UX는 모바일 viewport project로 따로 검증한다.
- 테스트 산출물은 `test-results/`, `playwright-report/`에 모으고 git에는 올리지 않는다.

## 추천 구조
```text
tests/e2e/
  map/
  auth/
  submission/
  admin/
playwright.config.ts
```

## 첫 E2E 후보
1. `/` 진입 -> `/map` 렌더
2. 검색어 입력 -> 목록 개수 갱신
3. 플레이스 클릭 -> 상세 시트 표시
4. 시트 닫기 -> 지도 유지
