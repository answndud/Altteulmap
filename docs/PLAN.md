# PLAN.md

## Active 작업

Next.js 기능 parity 회귀를 복구한다.

## 배경
- Vite + React 이관 후 전체 리뷰에서 Next.js 시절 기능 일부가 누락된 것이 확인됐다.
- `npm run verify`와 remote smoke는 통과하지만, full E2E 기준으로 모바일 지도 목록, 상세 가격 제보/코멘트, admin 가격/신고 검토 흐름이 실패한다.
- 이번 작업은 신규 기능이 아니라 동작 보존형 회귀 복구다. DB schema, API path/response shape, env 이름, 운영 데이터, 배포 구조는 변경하지 않는다.

## 목표
- 모바일 지도에서 Next 시절의 목록 바텀시트 UX를 복구한다.
- 장소 상세에서 가격 제보와 코멘트 작성/삭제/rate limit 흐름을 사용자가 바로 수행할 수 있게 복구한다.
- admin 가격 제보/신고 큐에서 AI 1차 검수 레이어와 기존 E2E DOM contract를 복구한다.
- 실패한 E2E를 모두 통과시키고, smoke/verify/deploy check까지 다시 확인한다.

## 작업 순서
- Next parity 기준선 확정
  - public route, admin route, API endpoint, auth/OAuth, SEO/static asset, mobile gesture, 디자인 parity를 표로 대조한다.
  - 기존 E2E에 걸린 회귀뿐 아니라 Next 시절 제공되던 주요 사용자 플로우가 Vite 앱에서 모두 노출되는지 확인한다.
  - 누락이 발견되면 이번 회귀 복구 범위에 포함할지, 후속 작업으로 분리할지 `docs/PROGRESS.md`에 명시한다.
- 모바일 지도 목록 복구
  - `MapRoute`에 `mobile-place-list-open`, `mobile-place-list-sheet`, `mobile-place-list-drag-handle`, `mobile-place-list-toggle-size`, `mobile-place-list`, `mobile-place-list-item-*` 흐름을 복구한다.
  - 작은 화면에서는 지도 중심 화면을 유지하고, 목록은 하단 sheet로 `peek`/`expanded`/hidden 상태를 전환한다.
  - 목록에서 장소를 선택하면 목록 sheet를 닫고 기존 `place-detail-sheet`를 열어야 한다.
  - 가능하면 기존 `useMobileSheetGesture`를 재사용하고, 새 상태/gesture 로직은 최소화한다.
- 상세 가격 제보/코멘트 접근성 복구
  - `/place/:id` 진입 시 `place-price-report-form`과 `place-comments-section`이 기본 검증 흐름에서 접근 가능해야 한다.
  - 현재 접힘 UI를 유지하더라도 test/사용자 기준으로 폼이 mount되지 않는 문제는 제거한다.
  - 비회원 댓글 등록, 같은 visitor 삭제, rate limit 안내가 기존 테스트 기준으로 동작해야 한다.
  - 가격 제보 제출 후 admin 가격 검토 큐에 노출되는 흐름을 복구한다.
- admin 가격/신고 큐 parity 복구
  - 가격 제보 큐에 `admin-price-report-list`, `admin-price-report-card`, `admin-ai-review-panel`, `admin-price-reject-button` contract를 복구한다.
  - 신고 큐에 `admin-report-list`, `admin-report-card`, `admin-ai-review-panel`, `admin-report-status-*`, `admin-report-status-badge`, `admin-report-filter-*` contract를 복구한다.
  - AI 1차 검수 패널은 단순 placeholder가 아니라 기존 moderation suggestion 데이터가 있으면 해당 내용을 우선 표시하고, 없을 때만 안전한 fallback 문구를 표시한다.
  - Worker/admin API 응답에 가격 제보와 신고의 moderation suggestion contract가 포함되는지 확인하고, 기존 데이터가 없을 때의 fallback 기준을 문서화한다.
  - 서버 보안 경계는 계속 `/api/admin/*`의 `requireAdmin`에 둔다. UI route 보호만 보안으로 간주하지 않는다.
- 가격 필터 spec 정리
  - `map-price-filter` 테스트는 실제 기능 회귀가 아니라 MVP 범위 결정 확인용 spec으로 판정했다.
  - 이번 회귀 복구 범위에서는 기존 의도대로 가격 필터를 미노출하고, 대표 가격 노출을 MVP 기준으로 유지한다.
  - PRD/TRD/테스트 기대를 “가격 필터 미노출, 대표 가격 노출”로 일관되게 맞춘다.
- 디자인/지도 품질 복구
  - 실제 Naver 지도 렌더링이 운영 환경에서 `지도 설정이 아직 준비되지 않아 임시 미리보기` 상태로 떨어지지 않는지 확인한다.
  - 숫자 클러스터는 지도 위에서 숫자가 읽히는 마커로 표시되어야 하고, 클릭 시 클러스터 bounds로 확대/이동해야 한다.
  - 클러스터 클릭 또는 충분한 줌인 이후에는 새 viewport 기준으로 `/api/places/map`을 재조회해 클러스터가 개별 장소 마커로 분할되어야 한다.
  - 클러스터 클릭 경로는 실제 Naver 지도와 임시 preview fallback 모두에서 최소한의 동작이 보존되어야 한다.
  - 주요 public 화면(`/`, `/map`, `/place/:id`, `/submit`, `/login`, `/bookmarks`)과 admin 화면(`/admin`, `/admin/prices`, `/admin/reports`, `/admin/places`)의 정보 밀도, 여백, 버튼 위계, 모바일 터치 타겟을 점검한다.
  - 디자인 수정은 기능 contract를 바꾸지 않고, Next 시절보다 빈약해진 UI를 복구하는 범위로 제한한다.

## 검증 계획
- 기본 검증:
  - `npm run lint`
  - `npm run typecheck`
  - `git diff --check`
- 회귀 재현/수정 검증:
  - `npm run test:e2e:full`
  - 필요 시 실패 범위 선별:
    - `npx playwright test tests/e2e/map.mobile.spec.ts --project mobile-chromium`
    - `npx playwright test tests/e2e/comments.spec.ts tests/e2e/price-review.spec.ts tests/e2e/report-admin.spec.ts`
    - `npx playwright test tests/e2e/map-price-filter.spec.ts tests/e2e/map-price-filter.mobile.spec.ts`
- 배포 전 검증:
  - `npm run verify`
  - `npm run deploy:check`
  - `npm run smoke:vite:local`
- 배포 후 검증:
  - `npm run deploy`
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev npm run smoke:remote`
- 수동 QA:
  - 실제 모바일 폭에서 지도, 목록 바텀시트, 상세 바텀시트, 장소 상세 페이지, 제보/신고/댓글 흐름을 확인한다.
  - 운영 URL에서 Naver/Kakao OAuth live callback, credentials 로그인, 로그아웃, 세션 유지, admin 접근 차단을 확인한다.
  - admin에서 가격 제보 승인/반려, 신고 상태 변경, AI 1차 검수 패널 표시, 권한 없는 `/api/admin/*` 접근 차단을 확인한다.
  - 주요 화면의 디자인 parity를 캡처 없이 눈으로 점검하고, 빈약하거나 누락된 UI는 같은 작업 안에서 수정한다.

## 완료 기준
- 위 Review Finding 1~4가 모두 해결된다.
- Next parity 기준표에서 public/admin/API/auth/SEO/static/mobile/design 항목이 `복구 완료` 또는 `후속 분리 사유 명시` 상태가 된다.
- 가격 제보/신고 AI 검수는 UI test id뿐 아니라 Worker/admin API data contract와 fallback 표시 기준까지 확인된다.
- `npm run test:e2e:full`이 통과한다.
- 가격 필터 관련 spec의 기대 동작이 코드/문서와 일치한다.
- 실제 Naver 지도 렌더링, OAuth live callback, admin 처리 플로우, 주요 화면 디자인 수동 QA가 완료된다.
- 숫자 클러스터 표시, 클릭 확대, viewport 재조회, 개별 장소 마커 분할이 자동/수동 검증된다.
- 운영 배포와 remote smoke가 통과한다.
- 완료 후 `docs/PROGRESS.md` 결과를 `docs/COMPLETED.md`에 archive하고, `PLAN.md`, `PROGRESS.md`는 `현재 active 작업 없음`으로 정리한다.
