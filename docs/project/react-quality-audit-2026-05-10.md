# React Doctor식 코드 품질 기준선

## 개요
- 작성일: 2026-05-10
- 목적: `millionco/react-doctor`를 설치하거나 실행하지 않고, 공개 README 기준 평가 축을 참고해 현재 Vite + React 코드베이스의 개선 기준선을 고정한다.
- 범위: React client, shared feature component, Worker/BFF와 연결되는 frontend-facing route, lint/type/build hygiene.
- 비범위: 신규 기능, DB schema 변경, API contract 변경, Cloudflare 배포 구조 변경.

## 평가 방식
- 참고 축:
  - State & Effects
  - Architecture
  - Performance
  - Security
  - Accessibility
  - Dead Code / Hygiene
- 점수 해석:
  - `80+`: Great 목표권
  - `50-79`: Needs work
  - `<50`: Critical
- 이 문서는 실제 `react-doctor` 산출물이 아니라, 해당 접근법을 현재 저장소 맥락에 맞게 수동 적용한 기준선이다.

## 기준 점수
- 총점: `74/100`
- State & Effects: `15/20`
- Architecture: `14/20`
- Performance: `15/20`
- Security: `16/20`
- Accessibility: `13/20`
- Dead Code / Hygiene: `11/20`

## 개선 후 점수
- 총점: `85/100`
- State & Effects: `17/20`
- Architecture: `18/20`
- Performance: `17/20`
- Security: `18/20`
- Accessibility: `17/20`
- Dead Code / Hygiene: `15/20`

## 개선 후 주요 결과
- React Hooks, JSX a11y, React Refresh lint 감시망을 추가했다.
- Admin UI는 1324줄 단일 route 파일에서 19줄 route assembly와 page/API/hook/access/frame 모듈로 분리됐다.
- shell session fetch와 bookmarks loading을 route-specific hook으로 분리했다.
- `PlaceCard`, `MobilePlaceListSheet`의 clickable `article role="button"` 패턴을 실제 button/link 중심 구조로 바꿨고, ESLint a11y warning은 8건에서 0건이 됐다.
- Naver SDK marker HTML 문자열의 inline style 5건을 CSS class 기반으로 이동해 CSP inventory findings는 12건에서 7건으로 줄었다.
- `knip` 기반 `npm run hygiene:dead-code` preview를 추가했고, 저위험 unused file/export 일부를 정리했다.
- `npm run perf:client` Playwright baseline을 추가해 client interaction timing을 기록한다.

## 남은 리스크
- `src/features/map/naver-map-preview.tsx`에는 로컬 fallback preview의 동적 좌표 style 7건이 남아 strict CSP 전환 전 추가 설계가 필요하다.
- `npm run hygiene:dead-code`에는 Tailwind devDependency false positive와 compatibility 성격의 unused export 후보가 남아 있다.
- performance baseline은 아직 임계값을 강제하지 않는다. 최소 3회 이상 측정 후 p95 기준을 별도 작업으로 정해야 한다.
- 현재 fixture viewport에서는 cluster marker가 없어 `perf:client`의 cluster click 항목은 skipped note로 남는다.

## 주요 근거

### State & Effects
- 강점:
  - 지도 viewport fetch는 debounce, abort, stale path guard를 갖고 있다.
  - Turnstile widget은 cleanup effect를 갖고 있다.
  - 운영 smoke가 auth/session 흐름을 확인한다.
- 리스크:
  - `src/client/App.tsx`는 session fetch를 직접 수행한다.
  - `src/client/routes/MapRoute.tsx`는 map fetch, bookmark fetch, viewport fetch를 한 route 안에서 관리한다.
  - `src/client/routes/admin/AdminRoutes.tsx`는 session gate와 data loading hook을 route/component와 함께 갖고 있다.
- 개선 방향:
  - session/bookmark/admin data loading을 공용 hook 또는 route-specific hook으로 분리한다.
  - map viewport fetch는 domain-specific 로직이므로 무리하게 공용화하지 않고 명확한 hook 경계만 만든다.

### Architecture
- 강점:
  - Worker route는 `health`, `static`, `auth`, `public-config`, `bookmarks`, `places-read`, `public-write`, `admin`, `telemetry`로 분리되어 있다.
  - 지도 UI는 `PlaceCard`, `MapCategoryTray`, `TrendingPlacesSection`, `MobilePlaceListSheet`, `PlaceDetailSheet`, Naver map hook 계층으로 상당 부분 분리됐다.
- 리스크:
  - `src/client/routes/admin/AdminRoutes.tsx`가 1324줄로 가장 큰 frontend 파일이다.
  - admin type, API helper, access gate, layout, page, card/filter component가 한 파일에 있다.
  - 큰 route 파일은 AI agent 변경 시 import/API/data-testid 회귀 위험이 높다.
- 개선 방향:
  - Admin UI를 type/API/hook/access shell/page/card 순으로 작은 slice로 분리한다.
  - 최종적으로 `AdminRoutes.tsx`는 route assembly만 담당하게 한다.

### Performance
- 강점:
  - Vite build 산출물은 현재 deploy check 기준 Worker entry 약 594KB다.
  - 지도 API 측정과 remote smoke는 이미 별도 script가 있다.
  - 지도 cluster/viewport 관련 회귀 테스트가 존재한다.
- 리스크:
  - React render/interaction timing을 측정하는 하네스는 없다.
  - 지도 UX는 과거 cluster 전환과 `검색중` 지연 문제가 반복됐다.
  - admin queue rendering은 목록 수 증가 시 측정 기준이 없다.
- 개선 방향:
  - Playwright 기반 interaction timing smoke를 추가한다.
  - `/map`, cluster click, viewport fetch, `/admin/prices` 렌더링 baseline을 기록한다.

### Security
- 강점:
  - public write route는 Turnstile 검증을 적용했다.
  - Worker `/api/admin/*`는 서버 권한 경계를 갖고 있다.
  - `X-Request-Id`, health check, remote smoke가 운영 검증을 돕는다.
- 리스크:
  - `public/_headers`는 strict CSP 전환 전 단계로 `unsafe-inline`을 유지한다.
  - `src/features/map/naver-map-preview.tsx`에 React inline style 7건이 남아 있다.
  - `src/features/map/naver-map-marker-visuals.ts`에 Naver marker HTML inline style 5건이 남아 있다.
- 개선 방향:
  - marker HTML을 class/CSS variable 또는 SVG/canvas data URL 방식으로 전환할 수 있는지 PoC한다.
  - CSP inventory findings를 12건에서 5건 이하로 줄인다.

### Accessibility
- 강점:
  - 주요 button에는 `type="button"`과 `aria-label`이 일부 적용되어 있다.
  - mobile sheet drag handle과 floating control은 touch target 보강이 진행됐다.
- 리스크:
  - `PlaceCard`와 `MobilePlaceListSheet`는 `article role="button"` 패턴을 사용한다.
  - 현재 keyboard handler는 있지만, semantic button/link보다 lint와 screen reader 관점에서 취약하다.
  - `eslint-plugin-jsx-a11y`가 없어 자동 감시가 없다.
- 개선 방향:
  - React a11y lint를 도입한다.
  - nested interactive 충돌이 생기지 않는 범위에서 semantic element로 전환한다.
  - 카드 전체 클릭 UX가 접근성 비용을 키우면 명시 버튼 중심으로 정리한다.

### Dead Code / Hygiene
- 강점:
  - `npm run lint`, `npm run typecheck`, `git diff --check` 루틴은 안정적이다.
  - repo-local git hooks와 문서 운영 규칙이 있다.
- 리스크:
  - unused exports/files를 찾는 dead-code checker가 없다.
  - `next-env.d.ts`, legacy Vite migration alias, compatibility barrel 등은 사람이 판단해야 한다.
  - ESLint가 React 전용 rule과 a11y rule을 포함하지 않는다.
- 개선 방향:
  - React lint plugin을 먼저 추가한다.
  - 이후 `knip` 또는 동등한 dead-code checker를 optional script로 도입한다.
  - false positive가 많은 entrypoint는 config로 관리한다.

## 기준선 검증 결과
- `npm run lint`: 통과
- `npm run typecheck`: 통과
- `npm run deploy:check:vite`: 통과
  - Worker entry: `594451` bytes
  - legacy worker alias entry: `594451` bytes
  - client index: `633` bytes
- `npm run csp:inventory`: 통과
  - total findings: `12`
  - `src/features/map/naver-map-preview.tsx`: `7`
  - `src/features/map/naver-map-marker-visuals.ts`: `5`
  - `public/_headers`: `unsafe-inline` 유지

## 우선 개선 순서
- P1. React 전용 lint/a11y/hook 검사 도입
- P1. Admin UI 큰 파일 분리
- P1. Async data/loading/error 패턴 정리
- P2. Accessibility semantic cleanup
- P2. CSP blocker와 marker inline style 축소
- P2. Dead-code/hygiene 검사 추가
- P3. Performance 측정 하네스 보강

## 목표
- 1차 목표: `80/100` 이상
- 2차 목표: `85/100` 이상
- 점수 개선은 기능 변경이 아니라 자동 감시망, 모듈 경계, 접근성, CSP, hygiene 기준 개선으로 달성한다.

## 개선 후 검증 결과
- `npm run lint`: 통과, warning 0건
- `npm run typecheck`: 통과
- `npm run hygiene:dead-code`: 통과, preview findings 출력
- `npm run csp:inventory`: 통과, total findings 7
- `npm run perf:client`: 통과, 1 passed
  - `map.initial_place_list_visible`: 325ms
  - `map.refresh_to_place_list_visible`: 98ms
  - `map.cluster_click_to_detail_or_marker_visible`: skipped
  - `admin.price_queue_visible`: 175ms
- `npm run test:e2e:smoke`: 통과, 10 passed
  - 지도 map API cluster/marker mode
  - home bootstrap bounds
  - map refresh/search/detail/share
  - admin dashboard
  - signup
  - public submission/admin approval
- `USE_MOCK_DATA=true NEXTAUTH_URL=http://127.0.0.1:3107 npx playwright test tests/e2e/map.mobile.spec.ts --project mobile-chromium`: 통과, 2 passed
- `npm run deploy:check:vite`: 통과
- `git diff --check`: 통과
