# Large File Refactoring Plan

## Purpose
- 이 문서는 pre-mortem 하드닝 이후 진행할 동작 보존형 리팩터링 계획이다.
- 목표는 큰 파일을 작게 만드는 것이 아니라, AI agent와 1인 개발자가 회귀 없이 수정할 수 있는 경계를 만드는 것이다.
- 이 계획은 신규 기능, API shape 변경, DB schema 변경, env 이름 변경, route path 변경, Cloudflare 배포 방식 변경을 포함하지 않는다.

## Current Hotspots
- `src/worker/index.ts`: 3,000 lines
  - security headers, health, cookie/session, OAuth, bookmarks, public places API, public write API, admin API, telemetry, static routes, SPA fallback이 한 파일에 섞여 있다.
- `src/client/routes/MapRoute.tsx`: 1,689 lines
  - route state, viewport fetch, map/list sync, category tray, place cards, detail sheet, mobile list sheet, bookmark/reaction update가 한 route component에 섞여 있다.
- `src/features/map/naver-map-panel.tsx`: 1,632 lines
  - Naver SDK boot, preview/fallback map, local tile fallback, viewport events, marker rendering, cluster focus, current location, resize handling이 한 컴포넌트에 섞여 있다.
- `src/worker/admin-repository.ts`: 1,146 lines
  - admin place review, price review, price item update, report queue, moderation suggestion mapping, pricing summary refresh, admin action write가 한 repository에 섞여 있다.

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
- Extract:
  - CSRF/session/signout/providers
  - credentials signin/signup
  - Kakao/Naver OAuth signin/callback
  - signed session encode/decode helpers if they are not already in a focused module
- Candidate files:
  - `src/worker/auth/session.ts`
  - `src/worker/auth/oauth.ts`
  - `src/worker/routes/auth.ts`
- Protection:
  - `tests/e2e/login.spec.ts`
  - `tests/e2e/signup.spec.ts`
  - `SMOKE_ADMIN_EMAIL=... SMOKE_ADMIN_PASSWORD=... npm run smoke:remote` after deploy
  - Manual Kakao/Naver live login QA when OAuth callback code changes.

### Worker Slice 4: Public Read and Write Routes
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

## Admin Repository Split Sequence

### Repository Slice 1: Shared Admin Mappers
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
- Move:
  - pending place list
  - place moderation transaction
  - category map loading used only by place review
- Candidate file:
  - `src/worker/admin/place-review-repository.ts`
- Protection:
  - `tests/e2e/submission-admin.spec.ts`
  - Targeted API smoke for approve/reject.

### Repository Slice 3: Price Review Repository
- Move:
  - pending price report list
  - price report moderation transaction
  - price item update transaction
  - pricing summary refresh
- Candidate file:
  - `src/worker/admin/price-review-repository.ts`
- Protection:
  - `tests/e2e/price-review.spec.ts`
  - Targeted API smoke for approve/reject and duplicate approval/idempotency.

### Repository Slice 4: Report Repository
- Move:
  - report queue list
  - report status transaction
  - report moderation suggestion mapping
- Candidate file:
  - `src/worker/admin/report-review-repository.ts`
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
1. Worker HTTP utilities and health/static routes.
2. Worker auth routes.
3. Worker public read/write routes.
4. Worker admin routes.
5. Admin repository split.
6. Map route query/list/sheet split.
7. Naver map panel pure helper and SDK lifecycle split.

This order reduces risk because Worker route extraction first improves server-side reviewability while existing E2E/smoke coverage is strongest. Map/Naver extraction should happen after route contracts are stable because map regressions have historically been harder to diagnose and require manual QA.
