# PLAN.md

## Active 작업

### 작업명
React Doctor식 코드베이스 품질 개선 계획

### 배경
- `millionco/react-doctor`를 설치하거나 실행하지 않고, 해당 도구의 공개 README 기준 평가 축을 참고해 현재 Vite + React 코드베이스를 수동 진단했다.
- 진단 기준은 React 프로젝트의 `state/effects`, `performance`, `architecture`, `security`, `accessibility`, `dead code/hygiene`를 종합해 0-100점으로 보는 방식이다.
- 현재 알뜰맵은 운영 smoke, Cloudflare 배포, Turnstile, 관리자 QA, Worker route 분리, 지도 회귀 테스트가 강화되어 운영 안정성은 개선됐지만, React 전용 정적 분석과 프론트엔드 구조 품질 하네스는 아직 얕다.
- 수동 진단 점수는 `74/100`으로, `Needs work` 상단이다. 목표는 기능 변경 없이 `80+ Great` 수준으로 올리는 것이다.

### 현재 기준 점수
- 총점: `74/100`
- State & Effects: `15/20`
- Architecture: `14/20`
- Performance: `15/20`
- Security: `16/20`
- Accessibility: `13/20`
- Dead Code / Hygiene: `11/20`

### 목표 점수
- 1차 목표: `80/100` 이상
- 2차 목표: `85/100` 이상
- 목표 달성 조건:
  - React 전용 lint/a11y/hook 검사가 CI와 local verify에 포함된다.
  - `src/client/routes/admin/AdminRoutes.tsx`가 route shell, type, API, hook, page component 단위로 분리된다.
  - 반복되는 `useEffect + fetch + mounted flag` 패턴이 공용 async/data hook 또는 route-specific hook으로 정리된다.
  - 클릭 가능한 `article role="button"` 패턴이 실제 semantic button/link 또는 명확한 접근성 보강 패턴으로 줄어든다.
  - CSP blocker inventory가 감소하고 strict CSP 전환 판단이 더 쉬워진다.
  - dead-code/hygiene 검사가 최소 preview 또는 opt-in 스크립트로 추가된다.

### 비목표
- 신규 기능 추가
- UI/디자인 대규모 변경
- API path, response shape 변경
- DB schema 변경
- 인증/session cookie contract 변경
- Cloudflare 배포 구조 변경
- React Query/TanStack Query 즉시 도입
- `react-doctor` 자체 설치 또는 실행

### 적용 원칙
- 동작 보존형 리팩터링만 수행한다.
- 기존 E2E `data-testid`, route path, API contract, admin 권한 경계는 유지한다.
- 자동 검사 도입은 먼저 `warn` 또는 별도 script로 시작하고, 기존 코드 수정이 끝난 뒤 CI 필수 검사로 승격한다.
- 접근성 수정은 시각 디자인을 흔들지 않는 범위에서 semantic HTML과 keyboard behavior를 우선한다.
- `useMemo`/`useCallback`은 무조건 제거하지 않는다. React Compiler 관점에서 불필요한 곳만 줄이고, 지도/marker처럼 identity 안정성이 필요한 곳은 유지한다.
- Cloudflare Worker runtime 호환성을 유지한다. Node-only 검사 도구는 devDependency와 local/CI 검사에만 사용한다.

## 우선순위

### P0. React 품질 하네스 기준선 고정
- 상태: 완료.
- 목적:
  - 이후 리팩터링이 주관적 판단에 머물지 않도록 현재 점수와 검사 공백을 문서/스크립트 기준으로 고정한다.
- 작업:
  - `docs/project/react-quality-audit-2026-05-10.md`를 생성한다.
  - 현재 수동 점수 `74/100`과 카테고리별 점수, 근거 파일, 주요 리스크를 기록한다.
  - `react-doctor` 설치/실행 없이 참고한 평가 축을 명시한다.
  - 현재 통과 검증을 기준선으로 기록한다:
    - `npm run lint`
    - `npm run typecheck`
    - `npm run deploy:check:vite`
    - `npm run csp:inventory`
  - `docs/PROGRESS.md`에는 기준선 점수와 이번 작업의 active 상태를 짧게 남긴다.
- 완료 기준:
  - 기준선 문서가 있어 다음 세션에서 점수 변화와 개선 근거를 비교할 수 있다.
  - 현재 리스크가 파일/라인 단위로 추적 가능하다.
- 검증:
  - `git diff --check`

### P1. React 전용 lint/a11y/hook 검사 도입
- 상태: 구현 완료. React Hooks error, JSX a11y warning, React Refresh warning 감시망을 추가했다. 남은 a11y warning 8건은 P2 semantic cleanup에서 처리한다.
- 목적:
  - 현재 ESLint는 JS/TS recommended 중심이라 React Hooks, JSX accessibility, React DOM anti-pattern을 충분히 잡지 못한다.
- 현재 근거:
  - `eslint.config.mjs`는 `@eslint/js`, `typescript-eslint`, `globals` 중심이다.
  - `react-hooks/exhaustive-deps`, `jsx-a11y/*`, React refresh/compiler 친화 rule이 없다.
- 작업:
  - devDependency 후보를 검토한다:
    - `eslint-plugin-react-hooks`
    - `eslint-plugin-jsx-a11y`
    - 필요 시 `eslint-plugin-react-refresh`
  - Flat config 방식으로 `eslint.config.mjs`에 React client 파일 대상 rule set을 추가한다.
  - Worker/server-only 파일에 browser/JSX rule이 과도하게 적용되지 않도록 scope를 분리한다.
  - 초기 도입에서는 회귀 위험이 큰 rule만 `warn`으로 시작한다.
  - lint 결과를 보고 실제 버그성 warning과 스타일성 warning을 분리한다.
  - false positive가 많으면 rule별 disable이 아니라 파일 scope 또는 rule level을 조정한다.
- 완료 기준:
  - `npm run lint`가 React hook/a11y 최소 검사까지 포함한다.
  - 새 lint 설정이 기존 lint 우회를 만들지 않는다.
  - warning이 남는다면 `docs/PROGRESS.md`에 남은 warning과 처리 방침이 명시된다.
- 검증:
  - `npm run lint`
  - `npm run typecheck`
  - `git diff --check`
- 예상 점수 개선:
  - Accessibility `+2~3`
  - State & Effects `+1~2`
  - Dead Code / Hygiene `+1`

### P1. Admin UI 큰 파일 분리
- 상태: 완료. type, API helper, `useAdminData`, access gate, shared frame, dashboard, places, prices, place price editor, reports page/card/filter를 분리했다.
- 목적:
  - `src/client/routes/admin/AdminRoutes.tsx` 1324줄 파일을 작은 모듈로 나눠 AI agent 작업 회귀 위험을 줄인다.
- 현재 근거:
  - 같은 파일에 admin type, API helper, `useAdminData`, access gate, layout, dashboard, place queue, price queue, report queue, card component가 함께 있다.
  - 이전 `PLAN.md`의 P3 다음 작업도 Admin UI Slice 1이었다.
- 작업 순서:
  - Slice 1: 타입 분리
    - `src/client/routes/admin/types.ts` 생성
    - `AdminSessionUser`, `AdminSession`, `AdminListResponse`, `AdminActionResult`, `ModerationSuggestion`, `PendingPlace`, `PendingPriceReport`, `AdminReport`, `AdminPriceItem`, `AdminPlacePriceDetail`, `LoadState` 이동
  - Slice 2: API helper 분리
    - `src/client/routes/admin/api.ts` 생성
    - `fetchJson`, `loadAdminSession`, admin list/action fetcher 이동
    - response shape와 error message는 변경하지 않음
  - Slice 3: data hook/access shell 분리
    - `src/client/routes/admin/useAdminData.ts` 생성
    - `src/client/routes/admin/AdminAccessGate.tsx` 생성
    - unauthenticated/forbidden/loading/error UI 의미와 copy 유지
  - Slice 4: layout/nav 분리
    - `src/client/routes/admin/AdminFrame.tsx` 생성
    - `adminNavItems`, `DataBadge`, `EmptyPanel`, common formatter 이동
  - Slice 5: page 단위 분리
    - `AdminDashboardRoute.tsx`
    - `AdminPlacesRoute.tsx`
    - `AdminPricesRoute.tsx`
    - `AdminReportsRoute.tsx`
  - Slice 6: card/filter component 분리
    - `PlaceSubmissionCard.tsx`
    - `PriceReportCard.tsx`
    - `ReportCard.tsx`
    - `ReportFilterBar.tsx`
    - `ModerationSuggestionPanel.tsx`
  - Slice 7: 최종 route file 축소
    - `AdminRoutes.tsx`는 `Routes` 조립만 담당하도록 축소
- 완료 기준:
  - `AdminRoutes.tsx`가 250줄 이하가 된다.
  - 각 page/card 파일은 350줄 이하를 목표로 한다.
  - `admin-ai-review-panel`, `admin-price-report-list`, `admin-price-reject-button`, `admin-report-list`, report filter/status test id가 유지된다.
  - `/api/admin/*` 서버 권한 경계는 변경하지 않는다.
- 검증:
  - 각 slice 후 `npm run typecheck`
  - 각 slice 후 `npm run lint`
  - admin slice 완료 후 `USE_MOCK_DATA=true NEXTAUTH_URL=http://127.0.0.1:3130 npx playwright test tests/e2e/report-admin.spec.ts tests/e2e/submission-admin.spec.ts tests/e2e/price-review.spec.ts --project chromium`
  - 최종 `npm run smoke:vite:local`
  - 최종 `git diff --check`
- 예상 점수 개선:
  - Architecture `+3~4`
  - Dead Code / Hygiene `+1`
  - State & Effects `+1`

### P1. Async data/loading/error 패턴 정리
- 상태: 완료. public shell session fetch와 bookmarks route loading을 route-specific hook으로 분리했다. 지도 viewport fetch와 Turnstile lifecycle은 domain-specific effect로 유지했다.
- 목적:
  - 반복되는 `useEffect + fetch + mounted flag + local state` 패턴을 줄여 state/effects 점수를 올리고 회귀 가능성을 낮춘다.
- 현재 근거:
  - `src/client/App.tsx`는 session fetch를 직접 수행한다.
  - `src/client/routes/MapRoute.tsx`는 map fetch, bookmark fetch, viewport fetch를 직접 관리한다.
  - `src/client/routes/PlaceDetailRoute.tsx`, `BookmarksRoute.tsx`, admin route도 유사 패턴을 반복한다.
- 작업:
  - 먼저 범위를 public shell/session과 admin data hook으로 제한한다.
  - `src/client/lib/async-state.ts` 또는 `src/client/lib/useAsyncResource.ts`를 추가할지 판단한다.
  - AbortController가 필요한 fetch와 단순 mounted guard fetch를 구분한다.
  - session은 `useSession()` hook으로 분리한다.
  - bookmark loading은 `useBookmarks()` 또는 map route 내부 hook으로 분리한다.
  - map viewport fetch는 이미 특수 로직이 많으므로 공용 hook에 억지로 넣지 않는다.
  - Turnstile widget lifecycle은 외부 script/widget id cleanup이 핵심이므로 현 구조 유지 여부를 먼저 검토한다.
- 완료 기준:
  - 단순 fetch route는 route-specific hook 패턴을 따른다.
  - 지도 viewport fetch처럼 domain-specific한 effect는 별도 hook 또는 명확한 이름으로 유지된다.
  - Abort/cancel 동작이 약해지지 않는다.
- 검증:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test:e2e:smoke`
  - `git diff --check`
- 예상 점수 개선:
  - State & Effects `+2~3`
  - Architecture `+1`

### P2. Accessibility semantic cleanup
- 상태: 완료. `PlaceCard`와 `MobilePlaceListSheet`의 clickable `article role="button"` 패턴을 제거하고 실제 button/link 중심 구조로 정리했다.
- 목적:
  - 클릭 가능한 비의미 요소를 줄이고 keyboard/screen reader contract를 더 명확하게 만든다.
- 현재 근거:
  - `PlaceCard`와 `MobilePlaceListSheet`는 `article role="button"` 패턴을 사용한다.
  - 현재 Enter/Space 처리는 있으나, 실제 `<button>` 또는 링크보다 유지보수와 접근성 검사에서 불리하다.
- 작업:
  - `PlaceCard` 전체 클릭 영역을 실제 `<button type="button">` 내부 구조로 바꿀 수 있는지 검토한다.
  - 내부 북마크/공유/가격 보기 버튼과 nested interactive element 충돌이 생기면 카드 전체 클릭을 제거하고 명시 버튼/링크 중심으로 바꾼다.
  - `MobilePlaceListSheet`도 동일하게 `button` 또는 `li > button` 구조를 검토한다.
  - 접근성 label, focus ring, touch target 44px 이상을 유지한다.
  - `eslint-plugin-jsx-a11y` 도입 후 남는 경고를 우선순위화한다.
- 완료 기준:
  - 클릭 가능한 `article role="button"` 사용이 0건이거나, 불가피한 경우 문서화된 예외만 남는다.
  - keyboard Enter/Space, focus visible, nested button 충돌이 없다.
  - 모바일 목록 열기/선택 E2E가 통과한다.
- 검증:
  - `npm run lint`
  - `npm run typecheck`
  - `USE_MOCK_DATA=true NEXTAUTH_URL=http://127.0.0.1:3107 npx playwright test tests/e2e/map.mobile.spec.ts --project mobile-chromium`
  - `npm run test:e2e:smoke`
- 예상 점수 개선:
  - Accessibility `+3~4`
  - Architecture `+1`

### P2. CSP blocker와 marker inline style 축소
- 상태: 대기.
- 목적:
  - strict CSP 전환을 막는 inline style blocker를 줄이고 security 점수를 올린다.
- 현재 근거:
  - `npm run csp:inventory` 기준 total findings는 12건이다.
  - `src/features/map/naver-map-preview.tsx` 7건
  - `src/features/map/naver-map-marker-visuals.ts` 5건
  - `public/_headers`는 `unsafe-inline`을 유지 중이다.
- 작업:
  - Preview map tile 위치 style은 CSS custom property 또는 transform class 방식으로 대체 가능한지 PoC한다.
  - Naver marker HTML은 다음 중 하나를 선택한다:
    - 사전 정의 class + CSS variables
    - SVG data URL marker
    - Canvas-generated data URL marker
  - Naver SDK marker content가 style attribute 없이 동일한 hitbox/anchor를 유지하는지 확인한다.
  - marker visual parity를 깨지 않도록 cluster/place marker size, anchor, z-index, focus 동작을 테스트한다.
  - `public/_headers`의 `unsafe-inline` 제거는 마지막 단계에서만 시도한다.
- 완료 기준:
  - `npm run csp:inventory` findings가 12건에서 5건 이하로 줄어든다.
  - strict CSP 전환에 필요한 남은 blocker가 명확하다.
  - 지도 marker click, cluster click, preview fallback이 깨지지 않는다.
- 검증:
  - `npm run csp:inventory`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run smoke:vite:local`
  - `USE_MOCK_DATA=true NEXTAUTH_URL=http://127.0.0.1:3107 npx playwright test tests/e2e/map.spec.ts tests/e2e/map.mobile.spec.ts --project chromium`
  - 실제 Naver map browser QA
- 예상 점수 개선:
  - Security `+2~3`
  - Performance `+1` 가능

### P2. Dead-code/hygiene 검사 추가
- 상태: 대기.
- 목적:
  - 사용하지 않는 파일/export/legacy artifact를 사람이 추적하는 상태에서 자동 검출 가능한 상태로 바꾼다.
- 현재 근거:
  - `react-doctor`식 평가에서는 dead code가 별도 축이다.
  - 현재 `npm run lint`는 unused local variable 중심이고 unused exports/files를 강하게 잡지 않는다.
  - `next-env.d.ts`, legacy alias, migration 중 남은 호환 파일처럼 사람이 판단해야 하는 항목이 있다.
- 작업:
  - `knip` 또는 동등한 dead-code checker를 설치하지 않고 먼저 dry-run 후보를 조사한다.
  - devDependency 추가가 적절하면 `knip`을 optional script로 도입한다.
  - 초기 script 이름은 `hygiene:dead-code`로 두고 CI 필수에는 바로 넣지 않는다.
  - false positive가 예상되는 entrypoints를 config에 명시한다:
    - `src/client/main.tsx`
    - `src/worker/index.ts`
    - `scripts/*.mjs`
    - `tests/**/*.ts`
    - Cloudflare/Vite generated entry
  - 실제 삭제는 별도 커밋으로만 진행한다.
- 완료 기준:
  - dead-code 검사 명령이 생긴다.
  - false positive 기준이 문서화된다.
  - 삭제 가능한 후보와 보존해야 하는 compatibility 후보가 분리된다.
- 검증:
  - `npm run hygiene:dead-code` 또는 preview command
  - `npm run typecheck`
  - `npm run lint`
  - `git diff --check`
- 예상 점수 개선:
  - Dead Code / Hygiene `+3~4`

### P3. Performance 측정 하네스 보강
- 상태: 대기.
- 목적:
  - 지도 전환, 클러스터, 모바일 바텀시트, admin queue 렌더링이 느려지는 문제를 감으로 판단하지 않도록 한다.
- 현재 근거:
  - API 측정은 `npm run map:measure`가 있으나 React render/interaction 측정은 약하다.
  - 지도 UX는 이전에 클러스터/전환 성능 이슈가 반복됐다.
- 작업:
  - Playwright 기반 interaction timing smoke를 추가할지 검토한다.
  - 최소 측정 대상:
    - `/map` 초기 렌더 후 marker/cluster 표시까지
    - 지도 viewport change 후 `검색중` 해제까지
    - cluster click 후 place marker 또는 상세 선택 가능 상태까지
    - `/admin/prices` 목록 표시까지
  - 결과를 절대값 pass/fail로 바로 고정하지 말고 baseline JSON으로 기록한다.
  - 임계값은 3회 이상 측정 후 p95 기준으로 잡는다.
- 완료 기준:
  - 성능 회귀를 감지할 수 있는 최소 smoke 또는 측정 스크립트가 있다.
  - 지도 UX 성능 수치가 `docs/PROGRESS.md`에 남는다.
- 검증:
  - 새 performance smoke
  - `npm run test:e2e:smoke`
  - `npm run map:measure`
- 예상 점수 개선:
  - Performance `+2~3`

## 실행 순서
- 먼저 P0 기준선 문서를 만든다.
- 다음으로 P1 React lint/a11y/hook 검사를 도입한다.
- 이어서 P1 Admin UI 큰 파일 분리를 진행한다.
- 그 다음 P1 async data/loading/error 패턴을 정리한다.
- 이후 P2 accessibility semantic cleanup과 CSP blocker 축소를 진행한다.
- 마지막으로 P2 dead-code/hygiene 검사와 P3 performance 측정 하네스를 추가한다.

## 검증 매트릭스
- 모든 코드 변경 후 기본 검증:
  - `npm run lint`
  - `npm run typecheck`
  - `git diff --check`
- Worker 또는 build output 영향이 있으면:
  - `npm run cf:build:vite`
  - `npm run deploy:check:vite`
  - `npm run smoke:vite:local`
- Admin UI 영향이 있으면:
  - `USE_MOCK_DATA=true NEXTAUTH_URL=http://127.0.0.1:3130 npx playwright test tests/e2e/report-admin.spec.ts tests/e2e/submission-admin.spec.ts tests/e2e/price-review.spec.ts --project chromium`
  - 필요 시 `npm run qa:production:admin`은 운영 데이터 생성/cleanup이 있으므로 명시 판단 후만 실행한다.
- Map/mobile 영향이 있으면:
  - `USE_MOCK_DATA=true NEXTAUTH_URL=http://127.0.0.1:3107 npx playwright test tests/e2e/map.spec.ts tests/e2e/map.mobile.spec.ts --project chromium`
  - `USE_MOCK_DATA=true NEXTAUTH_URL=http://127.0.0.1:3107 npx playwright test tests/e2e/map.mobile.spec.ts --project mobile-chromium --repeat-each=3`
- Public write/auth 영향이 있으면:
  - `NEXTAUTH_URL=http://127.0.0.1:3130 npx playwright test tests/e2e/login.spec.ts tests/e2e/signup.spec.ts tests/e2e/comments.spec.ts tests/e2e/bookmarks.spec.ts --project chromium`
- CSP/marker 영향이 있으면:
  - `npm run csp:inventory`
  - 실제 Naver map browser QA
- 최종 검증:
  - `npm run verify`
  - `npm run test:e2e:full`
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev npm run smoke:remote`

## 완료 기준
- 수동 React Doctor식 점수가 `80/100` 이상으로 재평가된다.
- 점수 변경 근거가 `docs/project/react-quality-audit-2026-05-10.md`에 기록된다.
- active 작업 완료 시 `docs/PROGRESS.md` 내용을 요약해 `docs/COMPLETED.md`에 archive한다.
- 완료 후 `docs/PLAN.md`, `docs/PROGRESS.md`는 `현재 active 작업 없음`으로 정리한다.

## 자체 리뷰

### 강점
- 계획이 도구 설치에 의존하지 않고 현재 코드 근거를 기준으로 한다.
- 큰 위험인 Admin UI 파일 분리와 React lint 공백을 P1로 올렸다.
- 운영 contract 변경 금지, Worker runtime 호환성, E2E data-testid 유지 조건을 명시했다.
- 접근성, CSP, dead-code, performance를 각각 독립 slice로 나눠 검증 가능하게 만들었다.

### 리스크
- ESLint plugin 추가는 기존 코드에서 warning이 대량 발생할 수 있다. 초기에는 `warn`으로 시작하고 rule별 적용 범위를 좁혀야 한다.
- Admin UI 분리는 import 경로 변경만으로도 E2E fixture와 data-testid를 깨뜨릴 수 있다. slice별 커밋과 targeted admin E2E가 필요하다.
- `article role="button"`을 실제 button으로 바꾸면 nested interactive element 문제가 생길 수 있다. 이 경우 카드 전체 클릭 UX를 포기하고 명시 버튼 중심으로 정리하는 편이 안전하다.
- CSP marker 개선은 Naver SDK icon anchor/hitbox와 직접 맞물린다. 시각 동일성보다 click target과 cluster focus 동작 검증을 우선해야 한다.
- dead-code checker는 Cloudflare/Vite entrypoint와 script entrypoint에서 false positive가 많을 수 있다. 삭제 자동화는 금지하고 후보 분류까지만 1차 목표로 둔다.

### 보완 결정
- 첫 구현 배치는 P0 기준선 문서 + P1 lint rule 도입까지만 묶는다.
- Admin UI 분리는 별도 배치로 진행하고, 화면별 분리 전에 type/API/hook부터 이동한다.
- Map/CSP 작업은 Admin 분리와 같은 배치에 섞지 않는다.
- 운영 QA 스크립트는 기본 검증이 아니라 운영 반영 직전 선택 검증으로 둔다.
