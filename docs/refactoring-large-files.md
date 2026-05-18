# Large File Refactoring Plan

## Purpose
- 이 문서는 pre-mortem 하드닝 이후 진행할 동작 보존형 리팩터링 계획이다.
- 목표는 큰 파일을 작게 만드는 것이 아니라, AI agent와 1인 개발자가 회귀 없이 수정할 수 있는 경계를 만드는 것이다.
- 이 계획은 신규 기능, API shape 변경, DB schema 변경, env 이름 변경, route path 변경, Cloudflare 배포 방식 변경을 포함하지 않는다.

## Current Hotspots
- `src/worker/places-read-repository.ts`: 77 lines
  - public read entry point와 DB/mock fallback gating만 남아 있다.
  - map list query, place detail query, pure mapper, response type, marker/cluster helper, mock fallback은 `src/worker/places-read-map-repository.ts`, `src/worker/places-read-detail-repository.ts`, `src/worker/places-read-mappers.ts`, `src/worker/places-read-types.ts`, `src/worker/places-read-markers.ts`, `src/worker/places-read-mock.ts`로 분리되었다.
- `src/worker/admin-prices-repository.ts`: 162 lines
  - price review queue와 admin place price detail read가 repository에 남아 있다.
  - pricing summary refresh, moderation suggestion mapping, admin price item mapping은 `src/worker/admin/admin-price-helpers.ts`로 분리되었다.
  - price report moderation transaction은 `src/worker/admin/admin-price-review-repository.ts`로 분리되었다.
  - price item update transaction은 `src/worker/admin/admin-price-items-repository.ts`로 분리되었다.
- `src/client/routes/MapRoute.tsx`: 169 lines
  - top-level map composition remains in the route component.
  - 현재 경로 기반 login callback href 생성은 `src/lib/auth-navigation.ts`의 `createCurrentLoginHref`로 분리되었다.
  - query/category/scope 해석과 map/list/trending/count view model 계산은 `src/client/features/map/use-map-route-view-model.ts`로 분리되었다.
  - desktop/mobile layout media query hook은 `src/client/features/map/use-map-desktop-layout.ts`로 분리되었다.
  - mobile list/detail sheet composition은 `src/client/features/map/MapMobileSurfaces.tsx`로 분리되었다.
  - 탐색 header, 검색 form, 검색 범위 segmented control, category tray wrapper는 `src/client/features/map/MapSearchControls.tsx`로 분리되었다.
  - selected place, bookmark fetch/update, reaction optimistic update는 `src/client/features/map/use-map-route-interactions.ts`로 분리되었다.
  - desktop result rail rendering은 `src/client/features/map/MapDesktopResultsRail.tsx`로 분리되었다.
  - initial fetch, viewport debounce fetch, manual refresh, cluster focus fetch는 `src/client/features/map/use-map-route-places.ts`로 분리되었다.
  - map marker, selected place merge, trending places 파생 계산은 `src/client/features/map/map-route-derived.ts`로 분리되었다.
- `src/worker/routes/public-write.ts`: 30 lines
  - public write route hub now only wires focused route modules.
  - price report route handler moved to `src/worker/routes/public-write-price-reports.ts`.
  - comments create/delete route handlers moved to `src/worker/routes/public-write-comments.ts`.
  - reaction route handler moved to `src/worker/routes/public-write-reactions.ts`.
  - place submission route handler moved to `src/worker/routes/public-write-submissions.ts`.
  - report submission route handler moved to `src/worker/routes/public-write-reports.ts`.
  - rate limit/Turnstile/mock write helpers have been moved to `src/worker/routes/public-write-support.ts`.
- `src/worker/routes/admin.ts`: 24 lines
  - admin route hub now only wires focused route modules.
  - admin place route registration moved to `src/worker/routes/admin-places.ts`.
  - admin price route registration moved to `src/worker/routes/admin-prices.ts`.
  - admin report route registration moved to `src/worker/routes/admin-reports.ts`.
  - shared admin route types and session guard moved to `src/worker/routes/admin-support.ts`.
- `src/worker/routes/auth.ts`: 18 lines
  - auth route hub now only wires focused route modules.
  - csrf/session/signout and provider discovery route wiring moved to `src/worker/routes/auth-session.ts`.
  - OAuth signin/callback route wiring and helper logic moved to `src/worker/routes/auth-oauth.ts`.
  - credentials callback and signup route wiring moved to `src/worker/routes/auth-credentials.ts`.
  - shared auth route binding/dependency types moved to `src/worker/routes/auth-support.ts`.
- Public write repository split:
  - place submission repository logic moved to `src/worker/places-write-submissions-repository.ts`.
  - price report repository logic moved to `src/worker/places-write-price-reports-repository.ts`.
  - reaction repository logic moved to `src/worker/places-write-reactions-repository.ts`.
  - comment create/delete repository logic moved to `src/worker/places-write-comments-repository.ts`.
  - shared active place lookup and write repository DB executor types moved to `src/worker/places-write-support.ts`.
- `src/db/schema.ts`: 557 lines
  - all table definitions and relations remain in one schema module.
- 이미 줄어든 파일:
  - `src/worker/index.ts`: 190 lines. Route registration hub 역할만 남았다.
  - `src/features/map/naver-map-panel.tsx`: 408 lines. Local fallback tile logic is already split into focused helpers.

## Non-Negotiable Contracts
- Public routes must keep the same paths and response shape:
  - `/api/categories`
  - `/api/config/public`
  - `/api/places/map`
  - `/api/places/:id`
  - `/api/places/:id/prices`
  - `/api/places/:id/comments`
  - `/api/places/:id/reaction`
  - `/api/places`
  - `/api/reports`
  - `/api/bookmarks`
- Auth routes must keep current session/cookie semantics:
  - `/api/auth/csrf`
  - `/api/auth/session`
  - `/api/auth/providers`
  - `/api/auth/signin/:provider`
  - `/api/auth/callback/:provider`
  - `/api/auth/callback/credentials`
  - `/api/auth/signout`
  - `/api/auth/signup`
- Admin API security boundary remains server-side:
  - `/api/admin/*` must call admin authorization on the Worker/API side.
  - `/admin/*` UI route protection is UX only and must not be treated as the security boundary.
- Static/SEO routes must not fall through to SPA `index.html`:
  - `/robots.txt`
  - `/manifest.webmanifest`
  - `/sitemap.xml`
  - `/api/*` unmatched routes
- Production DB failure must not fall back to mock data.
- Anonymous public write rate limit must continue to use persistent DB-backed rate limit in DB mode.
- Existing E2E `data-testid` contracts must be preserved unless tests and product contract are intentionally updated in the same change.

## Refactoring Rules
- Work in thin vertical slices. One slice should move one responsibility and prove parity before the next slice starts.
- Do not mix refactor with behavior changes. If a bug fix is discovered, either add a failing test first or split it into a separate clearly named change.
- Keep exported route registration order stable while moving code. Static routes and `/api/*` fallback must remain after concrete routes.
- Keep transaction boundaries in write paths unchanged when moving repository functions.
- Keep CSP/security header behavior identical. Static asset headers in `public/_headers` and Worker-generated headers must stay aligned.
- Run the protection checks listed for each slice before moving to the next slice.

## Worker Split Sequence

### Worker Slice 1: HTTP Utilities
상태: 완료됨. 현재 `src/worker/http/*`로 security headers, cookies, responses, URL/public config helpers가 분리되어 있다.

- Extract from `src/worker/index.ts`:
  - security header construction and `applySecurityHeaders`
  - cookie read/write helpers
  - origin and callback URL normalization helpers
  - generic JSON/error helpers
- Candidate files:
  - `src/worker/http/security-headers.ts`
  - `src/worker/http/cookies.ts`
  - `src/worker/http/responses.ts`
  - `src/worker/http/urls.ts`
- Protection:
  - `npm run smoke:vite:local`
  - `npm run deploy:check:vite`
  - Verify `/`, `/api/config/public`, `/robots.txt`, `/manifest.webmanifest` still include expected security headers.

### Worker Slice 2: Health and Static Routes
상태: 완료됨. 현재 `src/worker/routes/health.ts`, `src/worker/routes/static.ts`, `src/worker/routes/not-found.ts`로 분리되어 있다.

- Extract:
  - `/api/health`
  - `/robots.txt`
  - `/manifest.webmanifest`
  - `/sitemap.xml`
  - `/api/*` fallback response
- Candidate files:
  - `src/worker/routes/health.ts`
  - `src/worker/routes/static.ts`
  - `src/worker/routes/not-found.ts`
- Protection:
  - `npm run smoke:vite:local`
  - `npm run smoke:remote` only after the extracted code is deployed
  - Manual curl check that static/SEO routes do not return HTML fallback.

### Worker Slice 3: Auth Routes
상태: 완료. auth route hub는 session/providers, OAuth, credentials route module 등록만 담당한다.

- Extract:
  - CSRF/session/signout/providers
  - credentials signin/signup
  - Kakao/Naver OAuth signin/callback
  - signed session encode/decode helpers if they are not already in a focused module
- Candidate files:
  - `src/worker/auth/session.ts`
  - `src/worker/auth/oauth.ts`
  - `src/worker/routes/auth-session.ts`
  - `src/worker/routes/auth-oauth.ts`
  - `src/worker/routes/auth-credentials.ts`
  - `src/worker/routes/auth-support.ts`
  - `src/worker/routes/auth.ts`
- Protection:
  - `tests/e2e/login.spec.ts`
  - `tests/e2e/signup.spec.ts`
  - `SMOKE_ADMIN_EMAIL=... SMOKE_ADMIN_PASSWORD=... npm run smoke:remote` after deploy
  - Manual Kakao/Naver live login QA when OAuth callback code changes.

### Worker Slice 4: Public Read and Write Routes
상태: 완료. Public read route는 `src/worker/routes/places-read.ts`로 분리되어 있고, `places-read-repository`의 mapper/type/marker helper도 별도 module로 분리되었다. public write route는 support helper, price report route, comments create/delete route, reaction route, place submission route, report submission route가 모두 분리된 상태다.

- Extract:
  - categories/config/bookmarks
  - map and place detail reads
  - price reports, comments, reactions, place submissions, reports
  - public write rate limit wiring
- Candidate files:
  - `src/worker/routes/public-config.ts`
  - `src/worker/routes/bookmarks.ts`
  - `src/worker/routes/places-read.ts`
  - `src/worker/routes/places-write.ts`
  - `src/worker/routes/reports.ts`
- Protection:
  - `tests/e2e/map.spec.ts`
  - `tests/e2e/map.mobile.spec.ts`
  - `tests/e2e/comments.spec.ts`
  - `tests/e2e/bookmarks.spec.ts`
  - `npm run smoke:vite:local`
  - Targeted API smoke for price report, comment, report, place submission.

### Worker Slice 5: Admin Routes
상태: 완료. repository는 place/price/report로 나뉘었고 place/price/report route registration은 `src/worker/routes/admin-places.ts`, `src/worker/routes/admin-prices.ts`, `src/worker/routes/admin-reports.ts`로 분리되었다. `src/worker/routes/admin.ts`는 route hub 역할만 남았다.

- Extract:
  - pending place queue
  - place moderation
  - price report queue and moderation
  - admin place price detail and price item update
  - report queue and moderation
- Candidate files:
  - `src/worker/routes/admin-places.ts`
  - `src/worker/routes/admin-prices.ts`
  - `src/worker/routes/admin-reports.ts`
  - `src/worker/routes/admin.ts`
- Protection:
  - `tests/e2e/admin-dashboard.spec.ts`
  - `tests/e2e/submission-admin.spec.ts`
  - `tests/e2e/price-review.spec.ts`
  - `tests/e2e/report-admin.spec.ts`
  - Remote smoke with admin credentials after deploy.

## Admin Repository Follow-up Split Sequence

### Repository Slice 1: Shared Admin Mappers
상태: 부분 완료. client/server admin response contract는 `src/shared/admin-contracts.ts`로 공유되기 시작했다. 다음 단계는 repository 내부 mapper를 별도 pure helper로 빼고 unit test를 붙이는 것이다.

- Extract pure mapping and formatting helpers:
  - date formatting
  - moderation suggestion mapping
  - pending place record mapping
  - admin price item mapping
- Candidate file:
  - `src/worker/admin/admin-mappers.ts`
- Protection:
  - `npm run typecheck`
  - Admin E2E specs if any rendered shape changes.

### Repository Slice 2: Place Review Repository
상태: 완료됨. 현재 place review repository는 `src/worker/admin-places-repository.ts`다.

후속 후보:
- category map loading과 pending place row mapper를 순수 helper로 분리한다.
- place moderation transaction boundary는 유지한다.

Candidate file:
  - `src/worker/admin/admin-place-mappers.ts`
- Protection:
  - `tests/e2e/submission-admin.spec.ts`
  - Targeted API smoke for approve/reject.

### Repository Slice 3: Price Review Repository
상태: 완료됨. 현재 price review repository는 `src/worker/admin-prices-repository.ts`고, mapper/summary helper는 `src/worker/admin/admin-price-helpers.ts`, price report moderation transaction은 `src/worker/admin/admin-price-review-repository.ts`, price item update transaction은 `src/worker/admin/admin-price-items-repository.ts`로 분리되었다.

후속 후보:
- pending price report list query와 mapper
- price report moderation transaction
- price item update transaction
- pricing summary refresh

Candidate files:
  - `src/worker/admin/admin-price-mappers.ts`
  - `src/worker/admin/admin-price-review-repository.ts`
  - `src/worker/admin/admin-price-items-repository.ts`
- Protection:
  - `tests/e2e/price-review.spec.ts`
  - Targeted API smoke for approve/reject and duplicate approval/idempotency.

### Repository Slice 4: Report Repository
상태: 완료됨. 현재 report repository는 `src/worker/admin-reports-repository.ts`다.

후속 후보:
- report moderation suggestion mapping을 shared admin mapper와 맞춘다.

Candidate file:
  - `src/worker/admin/admin-report-mappers.ts`
- Protection:
  - `tests/e2e/report-admin.spec.ts`
  - Targeted API smoke for status update.

## Map Route Split Sequence

### Map Slice 1: Query and Viewport State
- Extract:
  - Seoul bootstrap bounds and viewport creation
  - map API path builder
  - viewport snap/debounce helpers
  - route search param parsing
- Candidate files:
  - `src/client/features/map/map-query.ts`
  - `src/client/features/map/use-map-viewport-fetch.ts`
- Protection:
  - `tests/e2e/map.spec.ts`
  - `tests/e2e/map.mobile.spec.ts`
  - Manual cluster QA: pan, zoom in, zoom out, cluster click.

### Map Slice 2: List and Cards
- Extract:
  - category tray
  - place card
  - trending section
  - desktop list panel
- Candidate files:
  - `src/client/features/map/MapCategoryTray.tsx`
  - `src/client/features/map/PlaceCard.tsx`
  - `src/client/features/map/TrendingPlacesSection.tsx`
  - `src/client/features/map/PlaceListPanel.tsx`
- Protection:
  - `tests/e2e/map.spec.ts`
  - `tests/e2e/map-price-filter.spec.ts`
  - Visual/manual check that density and responsive layout did not regress.

### Map Slice 3: Sheets
- Extract:
  - place detail sheet
  - mobile place list sheet
  - mobile drag handling
- Candidate files:
  - `src/client/features/map/PlaceDetailSheet.tsx`
  - `src/client/features/map/MobilePlaceListSheet.tsx`
- Protection:
  - `tests/e2e/map.mobile.spec.ts`
  - `tests/e2e/comments.spec.ts`
  - Manual mobile QA on a real device or mobile viewport.

## Naver Map Panel Split Sequence

### Naver Slice 1: Pure Marker/Viewport Helpers
- Extract pure helpers:
  - display marker derivation
  - overlap offset calculation
  - cluster viewport calculation
  - map center/bounds utilities
- Candidate file:
  - `src/features/map/naver-map-markers.ts`
- Protection:
  - Add lightweight unit tests if test harness is available.
  - `tests/e2e/map.spec.ts`
  - Manual cluster QA.

### Naver Slice 2: Local Fallback Map
- Extract:
  - local fallback tile math
  - local fallback tile layer
  - preview map pointer/wheel handling
- Candidate files:
  - `src/features/map/local-fallback-map.tsx`
  - `src/features/map/local-fallback-tiles.ts`
- Protection:
  - `npm run smoke:vite:local`
  - Local host without Naver key must still show intentional fallback, not broken blank map.

### Naver Slice 3: SDK Lifecycle and Marker Layer
- Extract:
  - SDK boot/runtime key loading
  - map instance lifecycle
  - marker instance creation/removal
  - current location marker
  - viewport idle/zoom event emission
- Candidate files:
  - `src/features/map/naver-map-sdk.ts`
  - `src/features/map/naver-marker-layer.ts`
  - `src/features/map/naver-viewport-events.ts`
- Protection:
  - `tests/e2e/map.spec.ts`
  - `tests/e2e/map.mobile.spec.ts`
  - Manual live Naver map QA with production-like key.

## Required Regression Checklist
- Map movement fetches new `/api/places/map` data after debounce.
- Zoom in can convert clusters into place markers when server response changes.
- Zoom out can convert place markers back into clusters when appropriate.
- Cluster click focuses a useful viewport and does not leave cluster/place markers overlapped from stale data.
- Mobile map list bottom sheet keeps open/collapsed/hidden behavior and `data-testid` contracts.
- Place detail price report and comments remain reachable from direct `/place/:id`.
- Admin place, price, and report queues keep AI review panel data and fallback copy.
- Admin price/report queue keeps E2E DOM contracts.
- Credentials login, OAuth state cookies, signout, session shape, and admin authorization remain unchanged.
- Production DB unavailable returns explicit degraded/503 behavior, never silent mock success.
- Security headers remain present on SPA HTML, API JSON, and Worker-generated static responses.

## Standard Verification Per Slice
- `npm run typecheck`
- `npm run lint`
- `npm run smoke:vite:local`
- `npm run deploy:check:vite`
- `git diff --check`
- Targeted E2E specs listed in the slice.
- `npm run smoke:remote` only after deployment to an environment containing the same Worker code and required DB migrations.

## Suggested Order
1. Split `src/worker/routes/admin.ts` by place/price/report route registration.
2. Split `src/worker/routes/auth.ts` by session, credentials, and OAuth route registration.
3. Extract `MapRoute.tsx` query/list/sheet responsibilities.
4. Split `src/worker/places-write-repository.ts` by write domain. 완료됨.
5. Revisit `src/db/schema.ts` only after migration rules are refreshed, because schema splitting can increase migration drift risk if done casually.

This order keeps the strongest Worker/API protection checks near the highest-risk server-side files first. Map extraction remains later because regressions require browser and manual viewport QA.
