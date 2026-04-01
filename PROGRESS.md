# PROGRESS.md

기준일: 2026-04-01

## 진행 현황 요약
- Cycle 0: 프로젝트 로컬 기반, DB 경로, 지도 탐색, 장소 상세, 등록, 신고, 북마크, 관리자 검토, 로컬 인증, 네이버 지도 연동 완료
- Cycle 1: 현재 위치 버튼, viewport 재조회, 모바일 목록 바텀시트, 모바일 상세 시트 기초 정리 완료
- Cycle 2: `PLAN.md`/`PROGRESS.md` 운영 문서 형식 정비, 지역/전역 검색, 검색 URL 상태 반영 완료
- Cycle 3: 댓글 작성/삭제, 기존 장소 가격 제보, 관리자 가격 검토 큐 완료
- Cycle 4: 관리자 가격 수정/숨김 UI, 대표 가격 재계산 규칙, 최소 rate limit, DB migration 적용, 실DB 런타임 검증 완료
- Cycle 5: sitemap/robots/canonical/기본 metadata, OAuth scaffolding, deploy check, Playwright E2E 3차, 공개 UI polish 진행 중. 실제 외부 로그인 E2E와 운영 도메인 기준 점검은 남아 있음
- Cycle 6: 좋아요/싫어요 반응 도입 완료, 비로그인 visitor cookie 반응과 공개 메타 줄 분리까지 반영. 랭킹/정렬/목록 노출 확장은 남아 있음
- Cycle 7: repo-local AI workflow 설정 완료 (`.agents`, `.githooks`, `verify`, local commit rules)
- 다음 우선순위: 실제 외부 로그인 E2E, 운영 도메인 기준 점검, 모바일 제스처/스냅 수준 E2E 보강

## 실행 로그

### 2026-04-01: 모바일 viewport Playwright 1차와 자체 리뷰
- 완료 내용
  - `/Users/alex/project/altteulmap/playwright.config.ts`에 `mobile-chromium` 프로젝트를 추가하고, 데스크톱 프로젝트는 `*.mobile.spec.ts`를 제외하도록 정리했다.
  - `/Users/alex/project/altteulmap/tests/e2e/map.mobile.spec.ts`를 추가해 모바일 목록 바텀시트 열기/닫기와 목록에서 플레이스를 선택했을 때 상세 시트가 열리고 닫힌 뒤 지도 화면으로 복귀하는 흐름을 검증하도록 만들었다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`의 목록 test id를 데스크톱과 모바일로 분리해 `desktop-place-list`, `mobile-place-list`, `mobile-place-list-item-*` 기준으로 모바일 UI를 안정적으로 집도록 정리했다.
  - `/Users/alex/project/altteulmap/package.json`의 `test:e2e`, `test:e2e:headed`는 모바일 viewport 시나리오만 `USE_MOCK_DATA=true` 런타임으로 분리하고, 기존 데스크톱 지도/북마크/등록/신고/관리자 흐름은 DB 기반으로 유지하도록 확장했다.
- 검증 결과
  - `npm run test:e2e` 통과
  - `npm run verify` 통과
- 리뷰 결과
  - `typescript-reviewer` 기준 자체 리뷰와 변경 파일 기준 서브에이전트 리뷰를 진행했다.
  - 최초 리뷰에서 `map.mobile`도 DB 상태에 의존하고 모바일/데스크톱 목록 test id가 겹친다는 지적이 있었고, 두 문제를 같은 세션에서 바로 수정했다.
  - 수정 후에는 현재 변경 범위에서 추가 수정이 필요한 동작 회귀나 타입/상태 정합성 문제를 찾지 못했다.
- 메모
  - 현재 Playwright는 데스크톱 read/react/share/admin 흐름과 별도로 모바일 목록 시트/상세 시트 전환까지 덮고, 모바일 viewport read 시나리오는 mock runtime으로 반복 가능하게 고정했다.
  - 남은 모바일 E2E 과제는 스냅/제스처 자체가 아니라, 실제 소셜 로그인 이후 모바일 보호 플로우와 좁은 viewport에서의 추가 쓰기 흐름이다.

### 2026-04-01: Playwright E2E 3차 확장과 로컬 검증 안정화
- 완료 내용
  - `/Users/alex/project/altteulmap/tests/e2e/helpers/auth.ts`를 기준으로 credentials 로그인 헬퍼를 공용화하고, 현재 Playwright 범위를 북마크 저장/해제, 신고 제출/관리자 처리, 가격 제보/관리자 반려까지 넓혔다.
  - `/Users/alex/project/altteulmap/tests/e2e/report-admin.spec.ts`의 로그인 callback URL을 ASCII query 기준으로 정리해 한글 query가 섞일 때 발생하던 브라우저 예외를 피하도록 수정했다.
  - `/Users/alex/project/altteulmap/src/db/client.ts`에서 postgres client에 `idle_timeout: 5`를 추가해 장시간 E2E 실행 뒤에도 로컬 연결이 오래 남지 않도록 보강했다.
  - `/Users/alex/project/altteulmap/playwright.config.ts`는 `next start`만 담당하도록 단순화하고, `/Users/alex/project/altteulmap/package.json`의 `test:e2e`와 `test:e2e:headed`는 `build` 후 Playwright를 두 그룹으로 나눠 실행하도록 바꿨다.
  - `/Users/alex/project/altteulmap/package.json`의 `pretest:e2e*`에서 3107 포트 stale 서버와 `test-results`, `playwright-report`, `.next`를 정리하도록 해 반복 실행 안정성을 높였다.
  - 검증 중 생성된 `E2E분식...`, `E2E 신고 ...`, `E2E 가격 ...` 데이터와 관련 `admin_actions`는 수동 정리해 로컬 DB를 seed 상태에 가깝게 되돌렸다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npx playwright test tests/e2e/report-admin.spec.ts tests/e2e/submission-admin.spec.ts` 통과
  - `npx playwright test tests/e2e/price-review.spec.ts tests/e2e/report-admin.spec.ts tests/e2e/submission-admin.spec.ts` 통과
  - `npm run test:e2e` 통과
  - `npm run verify` 통과
- 메모
  - 현재 Playwright는 지도 read/react/share, credentials 로그인, 장소 등록/승인, 북마크 저장/해제, 신고 제출/처리 완료, 가격 제보/반려까지 덮는다.
  - `npm run test:e2e`는 `bookmarks/map`와 `price-review/report-admin/submission-admin` 두 그룹으로 나눠 실행해야 현재 로컬 환경에서 가장 안정적이다.
  - 남은 큰 테스트 과제는 실제 카카오/네이버 로그인과 모바일 viewport 전용 시나리오다.

### 2026-03-31: Playwright E2E 2차 확장
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/auth/login-form.tsx`, `/Users/alex/project/altteulmap/src/features/auth/sign-out-button.tsx`, `/Users/alex/project/altteulmap/src/features/submission/place-submit-form.tsx`, `/Users/alex/project/altteulmap/src/app/admin/places/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/admin-place-review-form.tsx`에 로그인, 장소 제보, 관리자 승인 흐름용 `data-testid`를 추가했다.
  - `/Users/alex/project/altteulmap/tests/e2e/submission-admin.spec.ts`를 추가해 `credentials 로그인 -> 장소 제보 -> 관리자 승인 -> 홈 검색 노출` 흐름을 Playwright로 검증하도록 만들었다.
  - `/Users/alex/project/altteulmap/README.md`, `/Users/alex/project/altteulmap/PLAN.md`, `/Users/alex/project/altteulmap/PROGRESS.md`를 현재 E2E 범위 기준으로 최신화했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run build` 통과
  - `npm run test:e2e` 통과
  - `npm run verify` 통과
  - 검증 후 로컬 DB에 남아 있던 `E2E분식...` 승인 테스트 장소와 관련 `admin_actions`를 직접 정리했다
- 메모
  - 현재 Playwright는 지도 read/react/share 흐름에 더해 credentials 로그인, 장소 등록, 관리자 승인까지 덮는다.
  - 다음 E2E 확장 후보는 신고 제출, 북마크, 관리자 가격 검토, 실제 카카오/네이버 로그인이다.

### 2026-03-31: Playwright E2E 1차 도입
- 완료 내용
  - `/Users/alex/project/altteulmap/package.json`에 `test:e2e`, `test:e2e:headed`, `test:e2e:ui`, `playwright:install` 스크립트를 추가했다.
  - `/Users/alex/project/altteulmap/playwright.config.ts`를 추가해 `build + start` 기반 Playwright 실행 설정을 넣었다.
  - `/Users/alex/project/altteulmap/tests/e2e/map.spec.ts`에 지도 첫 진입, 검색, 상세 시트 열기/닫기, 비회원 좋아요/취소, 좋아요순 정렬, 공유 버튼 fallback 흐름을 추가했다.
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-reaction-buttons.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-share-button.tsx`, `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`에 Playwright용 안정적인 `data-testid`를 추가했다.
  - `/Users/alex/project/altteulmap/README.md`에 Playwright 설치/실행 방법을 문서화했다.
- 검증 결과
  - `npm install` 통과
  - `npx playwright install chromium` 통과
  - `npm run verify:quick` 통과
  - `npm run build` 통과
  - `npm run test:e2e` 통과
- 메모
  - 현재 E2E는 지도 핵심 read/react/share 흐름까지만 포함한다.
  - 다음 확장 후보는 소셜 로그인, 북마크, 등록, 신고, 관리자 승인/가격 검토다.

### 2026-03-31: 지도 목록 좋아요 노출, 좋아요순 정렬, 공유 버튼 1차
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/places/types.ts`, `/Users/alex/project/altteulmap/src/features/places/queries.ts`, `/Users/alex/project/altteulmap/src/features/places/repository.ts`, `/Users/alex/project/altteulmap/src/app/api/places/map/route.ts`에서 정렬 타입에 `likes`를 추가했다.
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`에 `좋아요순` 정렬 옵션을 추가했다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에서 지도 목록 카드에 좋아요 수를 노출하고, 상세 시트에서 반응이 바뀌면 현재 지도 목록과 마커에 바로 반영되도록 동기화를 보강했다.
  - `/Users/alex/project/altteulmap/src/features/places/place-share-button.tsx`를 추가했고, `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`에 공유 버튼을 붙였다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run build` 통과
- 메모
  - 현재 공유 기능은 Web Share API 우선, 없으면 클립보드 복사 fallback 구조다.

### 2026-03-31: 공개 화면 가격 이력 섹션 제거
- 완료 내용
  - `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`에서 공개 상세 페이지의 `가격 이력` 섹션을 제거했다.
  - `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`에서 상세 시트의 `가격 이력` 섹션을 제거했다.
  - 상세 시트 로딩 문구도 `세부 가격과 코멘트` 기준으로 짧게 정리했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run build` 통과
- 메모
  - 현재는 공개 UI에서만 제거했고, 내부 데이터 구조와 가격 검토/운영용 기록은 그대로 유지한다.

### 2026-03-31: 지도 마커 좋아요 동기화와 꼬리 제거
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/places/place-reaction-buttons.tsx`에 반응 변경 콜백을 추가했다.
  - `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`, `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`를 연결해 상세 시트에서 좋아요/싫어요를 누르면 현재 지도 목록과 선택된 플레이스 데이터가 즉시 갱신되도록 정리했다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에 서버 props 변경 동기화도 추가해 `router.refresh()` 이후 목록 상태가 최신 반응 수를 다시 반영하도록 보강했다.
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`에서 마커 HTML의 하단 다이아 꼬리를 제거하고, pill 형태 마커를 중심 anchor 기준으로 다시 맞췄다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run build` 통과
- 메모
  - 클라이언트 지도 상호작용은 정적 검증과 코드 경로 기준으로 정리했다. 브라우저에서 상세 시트 반응 직후 지도 마커 숫자가 바로 바뀌는지 최종 눈검증만 남아 있다.

### 2026-03-31: 비로그인 좋아요/싫어요와 공개 메타 줄 분리
- 완료 내용
  - `/Users/alex/project/altteulmap/src/db/schema.ts`의 `place_reactions`를 `user_id` 또는 `visitor_id` 기준으로 저장할 수 있게 바꿨고 `/Users/alex/project/altteulmap/drizzle/0004_yellow_morlocks.sql` migration을 생성했다.
  - `/Users/alex/project/altteulmap/src/lib/visitor-id.ts`를 추가해 guest visitor id cookie를 읽고 생성하도록 정리했다.
  - `/Users/alex/project/altteulmap/src/app/api/places/[id]/reaction/route.ts`는 더 이상 로그인을 요구하지 않고, guest 요청이면 visitor cookie를 발급한 뒤 반응을 저장한다.
  - `/Users/alex/project/altteulmap/src/app/api/places/[id]/route.ts`, `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/repository.ts`를 갱신해 guest도 자신의 반응 상태를 다시 읽을 수 있게 했다.
  - `/Users/alex/project/altteulmap/src/features/places/place-reaction-buttons.tsx`에서 로그인 리다이렉트를 제거했다.
  - `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`, `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`, `/Users/alex/project/altteulmap/src/app/bookmarks/page.tsx`에서 업종과 위치를 한 줄 메타 대신 여러 줄로 분리했다.
  - 로컬 `http://localhost` 기반 smoke에서도 cookie가 저장되도록 visitor cookie의 `Secure` 플래그를 host 기준으로 제어했다.
- 검증 결과
  - `npm run db:generate` 통과
  - `npm run db:push` 통과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `PORT=3105 npm run start` 기준으로 guest `PUT /api/places/school-gimbap/reaction` 응답에서 `Set-Cookie: altteulmap_visitor_id=...` 확인
  - 같은 visitor cookie를 `GET /api/places/school-gimbap`에 전달했을 때 `viewerReaction: "like"`가 내려오는 것 확인
  - 같은 visitor cookie로 `reaction: null`을 보냈을 때 취소 응답과 카운트 감소 확인
  - `/place/school-gimbap` HTML에서 `분식`, `서울 성북구 동소문로22길 31`, `학교앞김밥 성신점`이 각각 분리된 줄로 렌더링되는 것 확인
- 메모
  - 검증 중 생성한 visitor reaction row는 정리해 현재 DB에 남겨두지 않았다.

### 2026-03-31: 플레이스 좋아요/싫어요 1차 도입
- 완료 내용
  - `/Users/alex/project/altteulmap/src/db/schema.ts`에 `place_reaction_type`, `place_reactions`를 추가했고 `/Users/alex/project/altteulmap/drizzle/0003_graceful_ma_gnuci.sql` migration을 생성했다.
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`에서 공개 읽기용 반응 카운트 집계와 사용자별 단일 반응 저장 로직을 추가했다. 한 사용자는 한 플레이스에 `like` 또는 `dislike` 하나만 유지하고, 같은 반응을 다시 누르면 취소된다.
  - `/Users/alex/project/altteulmap/src/features/places/reaction-schema.ts`, `/Users/alex/project/altteulmap/src/app/api/places/[id]/reaction/route.ts`를 추가해 반응 쓰기 API와 검증을 붙였다.
  - `/Users/alex/project/altteulmap/src/features/places/place-reaction-buttons.tsx`를 추가했고 `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`, `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`에 좋아요/싫어요 UI를 배치했다.
  - `/Users/alex/project/altteulmap/src/features/places/types.ts`, `/Users/alex/project/altteulmap/src/features/places/mock-data.ts`를 갱신해 `likeCount`, `dislikeCount`, `viewerReaction`을 place 응답에 포함시켰다.
- 검증 결과
  - `npm run db:generate` 통과
  - `npm run db:push` 통과
  - `npm run lint` 통과
  - `npm run build` 통과
  - `npm run verify` 통과
  - `PUT /api/places/school-gimbap/reaction` 비로그인 요청이 `401`을 반환하는 것 확인
  - `GET /api/places/school-gimbap` 응답에 `likeCount`, `dislikeCount`, `viewerReaction` 필드가 포함되는 것 확인
  - 검증용 DB insert 후 `GET /api/places/school-gimbap` 응답에서 `likeCount: 1` 반영을 확인했고, 이후 `place_reactions` 테이블 count를 `0`으로 원복했다
- 메모
  - 이번 1차 범위는 상세 시트와 상세 페이지 반응 UI까지다. 지도 목록 노출과 좋아요 랭킹/정렬은 다음 단계로 남겨둔다.

### 2026-03-31: 지도 선택 후 목록 누락 버그 수정
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`에서 플레이스 선택 시 무조건 `panTo` 하던 흐름을 정리했다.
  - 마커 클릭은 상세 선택만 수행하고, 이미 현재 viewport 안에 있는 장소를 선택할 때는 지도를 다시 이동하지 않도록 바꿨다.
  - 이 변경으로 플레이스 클릭 뒤 `idle -> viewport 재조회`가 연쇄적으로 발생하면서 목록이 과도하게 줄어드는 문제를 막았다.
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`, `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`에서 초기 지도 범위를 서버가 내려준 결과 bounds에 맞추도록 연결해, 첫 목록과 실제 지도 viewport가 어긋나며 누락처럼 보이던 상황도 줄였다.
  - `/Users/alex/project/altteulmap/src/app/page.tsx`를 지도 홈으로 바꾸고, 내부 링크/로그인 callback/manifest/sitemap/revalidate 경로를 `/` 기준으로 맞춰 더 이상 `/map` 경로를 기본으로 쓰지 않도록 정리했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
- 메모
  - 전체 검색처럼 현재 화면 밖 결과를 선택한 경우에는 기존처럼 필요한 지도 이동이 유지된다.

### 2026-03-31: 공개 UI polish 패스
- 완료 내용
  - `/Users/alex/project/altteulmap/src/components/site-header.tsx`에서 헤더 메뉴를 더 간소화하고, 공개 메뉴에서 불필요한 홈 항목을 제거했다.
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`, `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`를 정리해 지도 영역 비중을 키우고, 공개 라벨을 `결과`, `주변 지도` 중심으로 단순화했으며 버튼/필터 칩에 `whitespace-nowrap`를 넣었다.
  - `/Users/alex/project/altteulmap/src/features/bookmarks/bookmark-toggle-button.tsx`, `/Users/alex/project/altteulmap/src/app/bookmarks/page.tsx`에서 북마크 버튼 텍스트를 짧게 유지하고, 북마크 화면의 `데이터 소스`, `API 보기` 같은 개발 문구를 제거했다.
  - `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`, `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-price-report-form.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-comments-section.tsx`에서 공개용 `검증됨/미검증` 표시와 내부 운영 설명을 없애고, 액션 버튼을 한 줄 유지로 정리했다.
  - `/Users/alex/project/altteulmap/src/app/submit/page.tsx`, `/Users/alex/project/altteulmap/src/features/submission/place-submit-form.tsx`, `/Users/alex/project/altteulmap/src/app/report/page.tsx`, `/Users/alex/project/altteulmap/src/features/reports/report-submit-form.tsx`, `/Users/alex/project/altteulmap/src/features/submission/place-coordinate-picker.tsx`에서 `초안`, `MVP`, `payload`, `DB/목업`, 환경 변수명 노출 같은 개발 단계 문구를 사용자 친화적인 설명으로 바꿨다.
  - `/Users/alex/project/altteulmap/src/features/auth/login-form.tsx`, `/Users/alex/project/altteulmap/src/features/auth/sign-out-button.tsx`에서 로그인 화면과 인증 에러 문구를 덜 기술적으로 정리하고, 소셜/이메일 로그인 버튼과 로그아웃 버튼을 한 줄 유지로 맞췄다.
  - 같은 공개 UI 범위에서 제목 아래 소개문, 섹션 안내문, 로그인 유도 문장처럼 기능을 한 번 더 설명하던 보조 문장을 추가로 제거해 전체 톤을 더 짧고 건조하게 맞췄다.
  - `/Users/alex/project/altteulmap/src/features/bookmarks/repository.ts`, `/Users/alex/project/altteulmap/src/features/reports/repository.ts`, `/Users/alex/project/altteulmap/src/features/places/repository.ts`의 사용자 응답 메시지도 기술 용어 없이 보이도록 정리했다.
  - 더 이상 사용하지 않는 `/Users/alex/project/altteulmap/src/features/places/place-status-badge.tsx`를 제거했다.
  - 공개 화면의 기능 설명성 문구를 한 번 더 줄여 코멘트/가격 제보/제보/신고/로그인/좌표 선택 화면에서 불필요한 안내 문장을 제거했다.
  - `/Users/alex/project/altteulmap/src/app/globals.css`에 공개 UI용 웜 팔레트 유틸을 추가하고, 지도 필터/검색/대표 가격 박스/주요 CTA의 검정 계열 버튼을 크림+테라코타 톤으로 교체했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - 공개 UI 컴포넌트 기준 `검증됨`, `미검증`, `데이터 소스`, `API 보기`, `NEXT_PUBLIC_NAVER_MAP_KEY_ID`, `초안`, `MVP` 문구가 남아 있지 않은 것을 검색으로 재확인했다
- 메모
  - 저장소 내부 repository/mock fallback 메시지는 남아 있지만, 현재 공개 화면에는 직접 노출되지 않는다.
  - 관리자 화면의 검증 상태 문구와 DB/mock 상태 표시는 운영 도구로 유지했다.

### 2026-03-31: Cycle 5 진행 중 (인증 정리와 출시 준비)
- 완료 내용
  - `/Users/alex/project/altteulmap/src/lib/site.ts`를 추가해 사이트 기준 URL 계산을 공용화했다.
  - `/Users/alex/project/altteulmap/src/app/layout.tsx`의 기본 metadata를 확장해 `metadataBase`, Open Graph, Twitter, 키워드, 애플리케이션 정보를 설정했다.
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`에 지도 페이지 canonical metadata를 추가했다.
  - `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`에 동적 `generateMetadata`를 추가해 장소별 title/description/canonical을 만들었다.
  - `/Users/alex/project/altteulmap/src/app/robots.ts`, `/Users/alex/project/altteulmap/src/app/sitemap.ts`, `/Users/alex/project/altteulmap/src/app/manifest.ts`를 추가해 공개 라우트 기준 SEO 기본 산출물을 생성했다.
  - `/Users/alex/project/altteulmap/src/app/api/places/[id]/route.ts`, `/Users/alex/project/altteulmap/src/app/api/places/map/route.ts`에 `Cache-Control: no-store`를 추가하고, 지도/상세 페이지를 `force-dynamic`으로 명시해 승인 직후 stale 응답 여지를 줄였다.
  - `/Users/alex/project/altteulmap/src/auth.ts`에 카카오/네이버 OAuth provider를 환경 변수 기반으로 선택적으로 붙이고, 소셜 로그인 시 `users`/`auth_accounts`와 연결하는 동기화 로직을 추가했다.
  - `/Users/alex/project/altteulmap/src/features/auth/repository.ts`, `/Users/alex/project/altteulmap/src/app/login/page.tsx`, `/Users/alex/project/altteulmap/src/features/auth/login-form.tsx`를 수정해 로그인 화면에서 provider 활성 상태와 미설정 이유를 보여주고, 로컬 credentials 로그인은 그대로 유지했다.
  - 지도용 네이버 키와 로그인용 OAuth 키가 섞이지 않도록 `.env.example`과 `README.md`를 `AUTH_NAVER_*`, `AUTH_KAKAO_*` 기준으로 정리했다.
  - `/Users/alex/project/altteulmap/scripts/smoke-local.mjs`와 `npm run smoke:local`을 추가해 SEO/지도 API/credentials 로그인/관리자 보호 API를 한 번에 확인할 수 있게 했다.
  - `/Users/alex/project/altteulmap/scripts/check-cloudflare-deploy.mjs`, `/Users/alex/project/altteulmap/docs/deploy-cloudflare.md`, `npm run deploy:check`를 추가해 Cloudflare 배포 전 환경 변수와 도메인 설정을 점검할 수 있게 했다.
  - `trd.md`의 환경 변수 표기를 현재 코드 기준(`NEXTAUTH_URL`, `AUTH_KAKAO_*`, `AUTH_NAVER_*`, `NEXT_PUBLIC_NAVER_MAP_KEY_ID`)으로 맞췄다.
- 변경 파일
  - `/Users/alex/project/altteulmap/src/lib/site.ts`
  - `/Users/alex/project/altteulmap/src/app/layout.tsx`
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`
  - `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`
  - `/Users/alex/project/altteulmap/src/app/api/places/[id]/route.ts`
  - `/Users/alex/project/altteulmap/src/app/api/places/map/route.ts`
  - `/Users/alex/project/altteulmap/src/auth.ts`
  - `/Users/alex/project/altteulmap/src/features/auth/repository.ts`
  - `/Users/alex/project/altteulmap/src/features/auth/login-form.tsx`
  - `/Users/alex/project/altteulmap/src/app/login/page.tsx`
  - `/Users/alex/project/altteulmap/src/lib/env.ts`
  - `/Users/alex/project/altteulmap/src/types/next-auth.d.ts`
  - `/Users/alex/project/altteulmap/src/features/auth/constants.ts`
  - `/Users/alex/project/altteulmap/scripts/smoke-local.mjs`
  - `/Users/alex/project/altteulmap/scripts/check-cloudflare-deploy.mjs`
  - `/Users/alex/project/altteulmap/docs/deploy-cloudflare.md`
  - `/Users/alex/project/altteulmap/package.json`
  - `/Users/alex/project/altteulmap/src/app/robots.ts`
  - `/Users/alex/project/altteulmap/src/app/sitemap.ts`
  - `/Users/alex/project/altteulmap/src/app/manifest.ts`
  - `/Users/alex/project/altteulmap/.env.example`
  - `/Users/alex/project/altteulmap/README.md`
  - `/Users/alex/project/altteulmap/trd.md`
  - `/Users/alex/project/altteulmap/PLAN.md`
  - `/Users/alex/project/altteulmap/PROGRESS.md`
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - production server(`127.0.0.1:3102`) 기준 `/robots.txt` 응답 확인
  - production server(`127.0.0.1:3102`) 기준 `/sitemap.xml` 응답 확인
  - production server(`127.0.0.1:3102`) 기준 `/manifest.webmanifest` 응답 확인
  - production server(`127.0.0.1:3102`) 기준 `/place/school-gimbap`의 `title`, `description`, canonical, `og:url` 메타 태그 확인
  - `HEAD /api/places/school-gimbap`, `HEAD /api/places/map?...` 응답에서 `Cache-Control: no-store, max-age=0` 확인
  - production server(`localhost:3102`) 기준 `/login` 화면에 카카오/네이버 provider 상태와 미설정 이유가 렌더링되는 것 확인
  - production server(`localhost:3102`) 기준 로컬 credentials 로그인 후 `/api/bookmarks`가 `source: "database"`로 응답하는 것 확인
  - `.env.local` 기준 `NEXTAUTH_URL`, `AUTH_NAVER_CLIENT_ID`, `AUTH_NAVER_CLIENT_SECRET`, `AUTH_KAKAO_CLIENT_ID`가 설정된 것을 확인했다. `AUTH_KAKAO_CLIENT_SECRET`은 현재 비어 있어 카카오는 비활성 상태다.
  - `localhost:3000` 기준 `/login`에서 네이버 provider가 활성화되고, `/api/auth/signin/naver`가 `nid.naver.com/oauth2.0/authorize`로 redirect URL을 생성하는 것 확인
  - 이후 `.env.local`에 `AUTH_KAKAO_CLIENT_SECRET`이 추가된 것을 확인했고, `localhost:3000` 기준 `/login`에서 카카오/네이버 provider가 모두 활성화되는 것 확인
  - `localhost:3000` 기준 `/api/auth/signin/kakao`가 `kauth.kakao.com/oauth/authorize`로 redirect URL을 생성하는 것 확인
  - `npm run smoke:local` 통과
  - `npm run deploy:check -- --preview` 통과
  - `npm run deploy:check`는 의도대로 실패했고, 실패 이유는 현재 `NEXTAUTH_URL=http://localhost:3000`이 production 기준 검증을 통과하지 못하기 때문이었다
- 메모
  - 현재는 `NEXTAUTH_URL`을 사이트 기준 URL로도 사용한다. 배포 시 실제 도메인으로 반드시 맞춰야 한다.
  - OAuth provider는 코드상 준비됐고, 현재 `.env.local` 기준으로 카카오/네이버 모두 authorize redirect 생성까지 확인했다.
  - 실제 production 체크는 배포 도메인이 정해진 뒤 `NEXTAUTH_URL`을 운영 주소로 바꿔 다시 돌리면 된다.

### 2026-03-31: Cycle 4 완료 (운영 품질과 관리자 가격 관리)
- 완료 내용
  - `/Users/alex/project/altteulmap/src/db/schema.ts`에 `price_items.is_active`를 추가했고, `/Users/alex/project/altteulmap/drizzle/0002_swift_red_skull.sql` migration을 생성했다.
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`의 대표 가격 재계산 규칙을 TRD 기준으로 정리했다. 이제 활성 가격 항목만 집계하고, `대표 플래그 + 검증 상태 + 최신성`을 우선한 뒤 fallback으로 최저가를 대표값으로 사용한다.
  - `/Users/alex/project/altteulmap/src/app/admin/prices/places/[id]/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/admin-price-item-form.tsx`, `/Users/alex/project/altteulmap/src/app/api/admin/price-items/[id]/route.ts`를 추가해 운영자가 가격 항목을 직접 수정/대표 지정/숨김/복원할 수 있는 경로를 만들었다.
  - `/Users/alex/project/altteulmap/src/app/admin/prices/page.tsx`에 최근 장소 기준 `현재 가격 관리` 목록을 추가해 큐가 비어 있어도 가격 관리 화면으로 진입할 수 있게 했다.
  - `/Users/alex/project/altteulmap/src/lib/rate-limit.ts`를 추가하고, `/Users/alex/project/altteulmap/src/app/api/places/route.ts`, `/Users/alex/project/altteulmap/src/app/api/reports/route.ts`, `/Users/alex/project/altteulmap/src/app/api/places/[id]/comments/route.ts`, `/Users/alex/project/altteulmap/src/app/api/places/[id]/prices/route.ts`에 최소 rate limit(`429`)을 붙였다.
- 변경 파일
  - `/Users/alex/project/altteulmap/src/db/schema.ts`
  - `/Users/alex/project/altteulmap/src/db/seed.ts`
  - `/Users/alex/project/altteulmap/drizzle/0002_swift_red_skull.sql`
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`
  - `/Users/alex/project/altteulmap/src/features/places/write-schema.ts`
  - `/Users/alex/project/altteulmap/src/features/places/admin-price-item-form.tsx`
  - `/Users/alex/project/altteulmap/src/app/admin/prices/page.tsx`
  - `/Users/alex/project/altteulmap/src/app/admin/prices/places/[id]/page.tsx`
  - `/Users/alex/project/altteulmap/src/app/api/admin/price-items/[id]/route.ts`
  - `/Users/alex/project/altteulmap/src/lib/rate-limit.ts`
  - `/Users/alex/project/altteulmap/src/app/api/places/route.ts`
  - `/Users/alex/project/altteulmap/src/app/api/reports/route.ts`
  - `/Users/alex/project/altteulmap/src/app/api/places/[id]/comments/route.ts`
  - `/Users/alex/project/altteulmap/src/app/api/places/[id]/prices/route.ts`
  - `/Users/alex/project/altteulmap/PLAN.md`
  - `/Users/alex/project/altteulmap/PROGRESS.md`
- 검증 결과
  - `npm run db:generate` 통과, migration 생성 확인
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `npm run db:push` 통과, 로컬 DB에 `is_active` 컬럼과 인덱스 반영 확인
  - `npm run db:seed` 통과
  - production server(`127.0.0.1:3102`) 기준 실DB 런타임 확인
  - 일반 사용자 가격 제보 승인 1회 후 대표 가격이 `3800원`으로 갱신되고 `unverified` 상태가 공개 상세에 반영되는 것 확인
  - 동일 가격을 2회째 승인했을 때 `verified_report_count = 2`, `verification_status = verified`로 승격되는 것 확인
  - 운영자 가격 항목 숨김 후 공개 상세에서 해당 항목이 사라지고 대표 가격이 다른 활성 항목으로 재계산되는 것 확인
  - 운영자 `/admin/prices/places/school-gimbap` 페이지에서 가격 관리 UI 렌더링 확인
  - 일반 사용자 댓글 등록을 11회 반복 호출했을 때 11번째 요청이 `429`로 차단되는 것 확인
- 메모
  - 승인 직후 첫 공개 상세 재조회 한 번에서 이전 상태가 잠깐 보였지만, 직후 재조회에서는 최신 DB 상태가 반영됐다. 추후 캐시/재검증 정책을 조금 더 조일 여지가 있다.

### 2026-03-31: Cycle 3 완료 (댓글과 기존 장소 가격 추가 제보)
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`에 댓글 작성/숨김 삭제, 기존 장소 가격 제보, 관리자 가격 검토 큐, 승인/반려 로직을 추가했다.
  - `/Users/alex/project/altteulmap/src/app/api/places/[id]/comments/route.ts`, `/Users/alex/project/altteulmap/src/app/api/places/[id]/comments/[commentId]/route.ts`, `/Users/alex/project/altteulmap/src/app/api/places/[id]/prices/route.ts`로 장소 상세 쓰기 API를 열었다.
  - `/Users/alex/project/altteulmap/src/features/places/place-comments-section.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-price-report-form.tsx`를 추가해 상세 페이지와 상세 시트 양쪽에서 댓글/가격 제보를 처리하도록 연결했다.
  - `/Users/alex/project/altteulmap/src/app/admin/prices/page.tsx`, `/Users/alex/project/altteulmap/src/app/api/admin/prices/route.ts`, `/Users/alex/project/altteulmap/src/app/api/admin/prices/[id]/route.ts`, `/Users/alex/project/altteulmap/src/features/places/admin-price-report-review-form.tsx`를 추가해 관리자 가격 검토 큐를 구성했다.
  - 공개 상세 이력에서 미검토 가격 제보가 보이지 않도록 `/Users/alex/project/altteulmap/src/features/places/repository.ts`의 가격 이력 조회를 `accepted` 기준으로 제한했다.
- 변경 파일
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`
  - `/Users/alex/project/altteulmap/src/features/places/types.ts`
  - `/Users/alex/project/altteulmap/src/features/places/write-schema.ts`
  - `/Users/alex/project/altteulmap/src/features/places/place-comments-section.tsx`
  - `/Users/alex/project/altteulmap/src/features/places/place-price-report-form.tsx`
  - `/Users/alex/project/altteulmap/src/features/places/admin-price-report-review-form.tsx`
  - `/Users/alex/project/altteulmap/src/app/api/places/[id]/route.ts`
  - `/Users/alex/project/altteulmap/src/app/api/places/[id]/comments/route.ts`
  - `/Users/alex/project/altteulmap/src/app/api/places/[id]/comments/[commentId]/route.ts`
  - `/Users/alex/project/altteulmap/src/app/api/places/[id]/prices/route.ts`
  - `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`
  - `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`
  - `/Users/alex/project/altteulmap/src/app/admin/page.tsx`
  - `/Users/alex/project/altteulmap/src/app/admin/prices/page.tsx`
  - `/Users/alex/project/altteulmap/src/app/api/admin/prices/route.ts`
  - `/Users/alex/project/altteulmap/src/app/api/admin/prices/[id]/route.ts`
  - `/Users/alex/project/altteulmap/src/app/admin/places/page.tsx`
  - `/Users/alex/project/altteulmap/src/app/admin/reports/page.tsx`
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `AUTH_SECRET=... NEXTAUTH_URL=http://127.0.0.1:3100 USE_MOCK_DATA=true PORT=3100 npm run start` 기준으로 mock 런타임 검증
  - 일반 사용자 로그인 후 `GET /api/places/school-gimbap` 응답 확인
  - 일반 사용자 로그인 후 `POST /api/places/school-gimbap/comments` 성공 응답 확인
  - 일반 사용자 로그인 후 `DELETE /api/places/school-gimbap/comments/{mock-comment-id}` 성공 응답 확인
  - 일반 사용자 로그인 후 `POST /api/places/school-gimbap/prices` 성공 응답 확인
  - 일반 사용자 `GET /api/admin/prices`는 `운영자 권한이 필요합니다.` 응답 확인
  - 운영자 로그인 후 `GET /api/admin/prices`는 `items: []`, `source: "mock"` 응답 확인
  - 운영자 로그인 후 `/admin/prices` HTML에 `가격 제보 검토 큐`, `현재 검토 대기 중인 가격 제보가 없습니다.` 문구 렌더링 확인
- 메모
  - Docker daemon이 꺼져 있어 DB-backed 가격 검토 승인/반려까지의 실데이터 런타임 검증은 이번 cycle에서 못 했다.
  - mock 모드에서도 댓글/가격 제보 route contract와 권한 분기는 확인했다.

### 2026-03-31: Cycle 7 완료 (repo-local AI workflow setup)
- 완료 내용
  - `AGENTS.md`를 현재 저장소 기준으로 정리하고 repo-local AI workflow 규칙을 추가했다.
  - `.agents/skills/` 아래에 `database-migrations`, `api-design`, `verification-loop`, `e2e-testing` 프로젝트 전용 skill 문서를 추가했다.
  - `.agents/reviewers/` 아래에 `typescript-reviewer.md`, `database-reviewer.md`를 추가해 큰 변경 후 자체 리뷰 기준을 고정했다.
  - `.githooks/`, `scripts/git-hooks/`를 추가하고 `pre-commit`, `commit-msg` hook를 repo-local 방식으로 구성했다.
  - `package.json`에 `verify`, `verify:quick`, `hooks:install` 스크립트를 추가했고, `README.md`에 사용법을 문서화했다.
- 변경 파일
  - `/Users/alex/project/altteulmap/AGENTS.md`
  - `/Users/alex/project/altteulmap/.agents/README.md`
  - `/Users/alex/project/altteulmap/.agents/skills/**`
  - `/Users/alex/project/altteulmap/.agents/reviewers/**`
  - `/Users/alex/project/altteulmap/.githooks/**`
  - `/Users/alex/project/altteulmap/scripts/git-hooks/**`
  - `/Users/alex/project/altteulmap/package.json`
  - `/Users/alex/project/altteulmap/README.md`
  - `/Users/alex/project/altteulmap/PLAN.md`
  - `/Users/alex/project/altteulmap/PROGRESS.md`
- 검증 결과
  - `npm run hooks:install` 통과
  - `npm run verify` 통과
  - `git config --local --get core.hooksPath` 결과 `.githooks`
- 메모
  - hook는 이 저장소 안에서만 동작한다.
  - ECC 전체 번들은 가져오지 않았고, 현재 프로젝트에 필요한 축만 축소 도입했다.

### 2026-03-31: Cycle 2 완료 (문서 체계 정비와 지도 검색/URL 상태 반영)
- 완료 내용
  - `/Users/alex/project/townpet/PLAN.md`와 `/Users/alex/project/townpet/PROGRESS.md` 형식을 참고해 현재 문서를 `기준일 -> 운영 규칙/요약 -> Active Plan/실행 로그` 구조로 재작성했다.
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`에 검색 UI를 추가해 `q`, `scope(viewport/global)` 상태를 URL에 반영하도록 바꿨다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`는 지역 검색일 때만 viewport bbox를 API에 보내고, 전체 검색일 때는 bounds 없이 검색 결과를 유지하도록 바꿨다.
  - `/Users/alex/project/altteulmap/src/app/api/places/map/route.ts`, `/Users/alex/project/altteulmap/src/features/places/repository.ts`, `/Users/alex/project/altteulmap/src/features/places/queries.ts`에 텍스트 검색 조건을 추가해 mock/DB 양쪽에서 이름, 주소, 지역, 대표 가격 라벨 등으로 검색 가능하게 만들었다.
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`는 전체 검색 결과가 들어왔을 때 해당 결과 중심으로 한 번 이동할 수 있게 조정했다.
- 변경 파일
  - `/Users/alex/project/altteulmap/PLAN.md`
  - `/Users/alex/project/altteulmap/PROGRESS.md`
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`
  - `/Users/alex/project/altteulmap/src/app/api/places/map/route.ts`
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`
  - `/Users/alex/project/altteulmap/src/features/places/queries.ts`
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`
  - `/Users/alex/project/altteulmap/src/features/places/types.ts`
- 검증 결과
  - `npm run lint` 통과
  - `npm run build` 통과
  - `curl -s --max-time 10 'http://localhost:3001/api/places/map?query=%EA%B9%80%EB%B0%A5&scope=global'` 응답 확인
  - `curl -s --max-time 10 'http://localhost:3001/api/places/map?query=%EA%B9%80%EB%B0%A5&scope=viewport&minLat=37.58&maxLat=37.60&minLng=127.00&maxLng=127.03'` 응답 확인
  - `curl -I -s --max-time 10 'http://localhost:3001/map?q=%EA%B9%80%EB%B0%A5&scope=global'` 응답 확인
- 메모
  - 사용자가 이미 띄워 둔 `next dev` 인스턴스는 `localhost:3000`에서 별도로 돌고 있었고, 전역 검색 런타임 검증은 충돌을 피하기 위해 production server `localhost:3001`에서 수행했다.

### 2026-03-31: Cycle 1 완료 (지도 viewport 조회와 모바일 바텀시트 정리)
- 완료 내용
  - `/Users/alex/project/altteulmap/src/app/api/places/map/route.ts`에 bbox 조회 파라미터를 추가했다.
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`, `/Users/alex/project/altteulmap/src/features/places/queries.ts`에 viewport bounds 필터를 추가했다.
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`에 현재 위치 버튼과 지도 idle 기준 viewport 보고 구조를 넣었다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에 모바일 목록 바텀시트를 추가했고, `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`는 모바일 하단 시트 형태로 조정했다.
- 검증 결과
  - `npm run lint` 통과
  - `npm run build` 통과
  - `curl 'http://localhost:3000/api/places/map?minLat=37.58&maxLat=37.60&minLng=127.00&maxLng=127.03'`로 bbox 조회 응답 확인
- 메모
  - 상세 시트는 현재도 usable 상태지만 모바일 스냅/제스처 감각은 추가 polish가 필요하다.

### 2026-03-31: Cycle 0 완료 (로컬 기반과 핵심 MVP 흐름 구축)
- 완료 내용
  - Next.js, OpenNext/Cloudflare 대비 구조, Docker Postgres, Drizzle 스키마, seed 경로를 정리했다.
  - 지도 탐색, 장소 상세, 등록, 신고, 북마크, 관리자 장소 승인/신고 검토 흐름을 연결했다.
  - Auth.js credentials 로그인과 네이버 지도 SDK 연동을 붙였다.
  - 첫 화면을 지도 중심으로 재정리하고, 개발용 안내 문구를 걷어냈다.
- 검증 결과
  - 각 단계에서 `npm run lint`, `npm run build`, `npm run db:push`, `npm run db:seed`를 반복 검증했다.
  - 로컬 DB에서 장소 제보, 신고 생성, 관리자 승인/상태 변경, 북마크 저장/해제까지 확인했다.
- 메모
  - 현재 로컬 `.env`, Docker Postgres, 네이버 지도 키가 이미 준비돼 있어 다음 cycle은 기능 확장에 바로 들어갈 수 있다.

## 다음 작업
1. 카카오 또는 네이버 실제 developer 설정으로 외부 로그인 end-to-end 검증
2. 실제 도메인이 정해지면 `NEXTAUTH_URL`을 운영 주소로 바꾸고 `npm run deploy:check` 재실행
3. 필요 시 캐시/재검증 정책을 추가 보강해 관리자 승인 직후 상세 반영 지연을 더 줄이기
4. 이후 E2E 자동화 도입 여부 판단
