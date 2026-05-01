# Next.js to Vite + React Migration

기준일: 2026-05-01

## 목적
알뜰맵을 Next.js + OpenNext 기반 구조에서 Vite + React SPA + Cloudflare Worker API 구조로 이관한다. 이관의 목적은 기능 추가가 아니라 운영 구조를 단순화하고, 1인 개발자가 AI agent와 함께 유지보수하기 쉬운 경계를 만드는 것이다.

## 보존할 계약
- API path와 response JSON shape
- DB schema와 migration history
- env variable 이름과 운영 credential 의미
- 사용자 플로우와 route path
- credentials, Kakao, Naver 인증 의미
- public write, bookmark, admin moderation 정책

## Baseline 필수 산출물
마이그레이션 구현 전에 현재 동작을 먼저 고정한다.

### API contract inventory
각 endpoint별로 아래 항목을 이 문서에 기록한다.
- method
- path
- request body 또는 query string
- success response shape
- error response shape
- auth requirement
- rate limit 또는 visitor cookie requirement

대상 범위:
- `/api/categories`
- `/api/places`
- `/api/places/map`
- `/api/places/[id]`
- `/api/places/[id]/prices`
- `/api/places/[id]/comments`
- `/api/places/[id]/comments/[commentId]`
- `/api/places/[id]/reaction`
- `/api/bookmarks`
- `/api/bookmarks/[id]`
- `/api/reports`
- `/api/telemetry/visit`
- `/api/auth/*`
- `/api/admin/*`

## Current API Contract Inventory

이 섹션은 Next.js route handler 기준 baseline이다. Vite/Worker 이관 후에도 path, status, body shape, auth requirement를 유지한다.

### 공통 응답 규칙
- JSON API는 `content-type: application/json`을 반환한다.
- Zod validation 실패는 보통 `{ ok: false, message: string, error: flattenedZodError }`와 `400`을 반환한다.
- rate limit 실패는 `{ ok: false, message: string, retryAfterMs: number }`와 `429`를 반환하고 `X-RateLimit-*`, 필요 시 `Retry-After` header를 포함한다.
- 공개 쓰기 API는 비회원이면 `altteulmap_visitor_id` cookie를 `HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000`로 설정한다. HTTPS에서는 `Secure`가 붙는다.
- `source`는 `"database"` 또는 `"mock"`, `mock`은 `source === "mock"` boolean이다.

### Public read APIs
| Method | Path | Request | Success | Error | Auth |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/categories` | none | `200 { groups: CategoryGroup[], categories: CategoryOption[] }` | none defined | public |
| `GET` | `/api/places/map` | query: `category?`, `query?`, `scope?=viewport\|global`, `minLat?`, `maxLat?`, `minLng?`, `maxLng?`, `zoom?` | `200 { items, mapMarkers, markerMode, count, returnedCount, mapMarkerCount, truncated, bounds, filters, source, mock }`, headers: `Cache-Control: no-store, max-age=0`, `X-Altteulmap-Map-Cache` | repository/runtime failure currently bubbles | public |
| `GET` | `/api/places/[id]` | path `id` | `200 { item: PlaceRecord, source, mock }`, `Cache-Control: no-store, max-age=0` | `404 { error: { code: "NOT_FOUND", message: "Place not found" } }` | public, viewer context from session or `altteulmap_visitor_id` |

### Public write APIs
| Method | Path | Request body | Success | Error | Auth |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/api/places` | `{ name, businessName?, categorySlug, roadAddress, district, note?, priceItems: [{ label, amount, unitLabel? }] }` | `200 PlaceSubmissionResult { ok, message, mock, source, preview }` | `400` validation, `429` rate limit | public; session user id or visitor cookie |
| `POST` | `/api/places/[id]/prices` | `{ label, amount, unitLabel?, comment? }` | `200 PlacePriceReportSubmissionResult { ok, message, source, mock, item }` | `400` validation, `404` when repository returns `ok:false`, `429` rate limit | public; session user id or visitor cookie |
| `POST` | `/api/places/[id]/comments` | `{ body }` | `200 PlaceCommentActionResult { ok, message, source, mock, item }` | `400` validation, `404` when repository returns `ok:false`, `429` rate limit | public; session user or visitor cookie |
| `DELETE` | `/api/places/[id]/comments/[commentId]` | none | `200 PlaceCommentDeleteResult { ok, message, source, mock, deletedCommentId }` | `403 { ok:false, message:"삭제 권한이 없습니다." }`, `404` not found | owner visitor/user or admin |
| `PUT` | `/api/places/[id]/reaction` | `{ reaction: "like" \| "dislike" \| null }` | `200 PlaceReactionActionResult { ok, message, source, reaction, likeCount, dislikeCount, placeId }` | `400` validation, `404` when repository returns `ok:false`, `429` rate limit | public; session user or visitor cookie |
| `POST` | `/api/reports` | `{ placeId, placeName, reasonType, detail }` | `200 ReportSubmissionResult { ok, message, mock, source, preview }` | `400` validation, `429` rate limit | public; session user id or visitor cookie |
| `POST` | `/api/telemetry/visit` | `{ path, ref?, scope?, source? }`; `ref` is `"share"` when `source` is set; `scope` defaults to `"public"` | `200 { ok:true, tracked:boolean, source }` | `400 { ok:false, message }`, `400` validation, `500 { ok:false, message:"방문 이벤트를 기록하지 못했습니다." }` | public; creates visitor cookie |

### Bookmark APIs
| Method | Path | Request | Success | Error | Auth |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/bookmarks` | none | `200 { items, count, source, userLabel, mock }` | `401 { ok:false, message:"로그인이 필요합니다." }` | required session |
| `PUT` | `/api/bookmarks/[id]` | `{ bookmarked: boolean }` | `200 BookmarkToggleResult { ok, source, bookmarked, message, placeId, requiresAuth? }` | `400` validation, `401 { ok:false, message:"로그인이 필요합니다.", requiresAuth:true }`, `404` place not found | required session |

### Auth APIs
| Method | Path | Request | Success | Error | Auth |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/auth/csrf` | none | `200 { csrfToken }`; sets `next-auth.csrf-token`, `next-auth.callback-url` | NextAuth default | public |
| `GET` | `/api/auth/session` | session cookie optional | unauthenticated: `200 {}`; authenticated: `200 { user: { name, email, id, role }, expires }` | NextAuth default | public |
| `GET` | `/api/auth/providers` | none | `200` provider map. Local mock baseline only includes `credentials` when social env/DB unavailable | NextAuth default | public |
| `POST` | `/api/auth/callback/credentials` | form-urlencoded `csrfToken`, `email`, `password`, `callbackUrl`, optional `json=true` | `200 { url }`; sets `next-auth.session-token`, `next-auth.callback-url` | bad credentials with `json=true`: `401 { url:".../api/auth/error?error=CredentialsSignin&provider=credentials" }` | public |
| `GET/POST` | `/api/auth/*` | NextAuth built-in routes | NextAuth default | NextAuth default | public |
| `POST` | `/api/auth/signup` | `{ email, nickname?, password }` | `201 CredentialsSignupResult { ok:true, message, item }` | `400` validation, `409` duplicate email, `429` rate limit, `500/503` repository failure | public, rate-limited by forwarded IP fallback |

### Admin APIs
모든 admin API는 session이 없으면 `401 { ok:false, message:"로그인이 필요합니다." }`, session role이 `admin`이 아니면 `403 { ok:false, message:"운영자 권한이 필요합니다." }`를 반환한다. 이 서버 측 권한 검사가 실제 보안 경계다.

| Method | Path | Request | Success | Error after auth | Auth |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/admin/places` | none | `200 { items, count, source, mock }` | repository/runtime failure currently bubbles | admin |
| `GET` | `/api/admin/places/[id]` | path `id` | `200 { item, source, mock }` | `404 { item:null, source, mock }` | admin |
| `PATCH` | `/api/admin/places/[id]` | `{ decision:"approve"\|"reject", latitude?, longitude? }`; approve requires coordinates | `200 PlaceModerationResult { ok, message, source, item }` | `400` validation, `404` when repository returns `ok:false` | admin |
| `GET` | `/api/admin/prices` | none | `200 { items, count, source, mock }` | repository/runtime failure currently bubbles | admin |
| `PATCH` | `/api/admin/prices/[id]` | `{ decision:"approve"\|"reject" }` | `200 PriceReportModerationResult { ok, message, source, item }` | `400` validation, `404` when repository returns `ok:false` | admin |
| `PATCH` | `/api/admin/price-items/[id]` | `{ label, amount, unitLabel?, verificationStatus, isRepresentative, isActive }` | `200 AdminPriceItemUpdateResult { ok, message, source, item, placeId }` | `400` validation or duplicate label, `404` not found | admin |
| `GET` | `/api/admin/reports` | none | `200 { items, count, source, mock }` | repository/runtime failure currently bubbles | admin |
| `PATCH` | `/api/admin/reports/[id]` | `{ status:"open"\|"reviewing"\|"resolved"\|"dismissed" }` | `200 ReportModerationResult { ok, message, source, item }` | `400` validation, `404` when repository returns `ok:false` | admin |

### Vite Worker admin API status
Phase 5에서 admin API의 서버 보안 경계를 먼저 Worker로 이관했다.

구현한 범위:
- `GET /api/admin/places`
- `GET /api/admin/places/:id`
- `PATCH /api/admin/places/:id`
- `GET /api/admin/prices`
- `PATCH /api/admin/prices/:id`
- `GET /api/admin/prices/places/:id`
- `PATCH /api/admin/price-items/:id`
- `GET /api/admin/reports`
- `PATCH /api/admin/reports/:id`

보존한 경계:
- session 없음: `401 { ok:false, message:"로그인이 필요합니다." }`
- non-admin session: `403 { ok:false, message:"운영자 권한이 필요합니다." }`
- validation 실패: 기존 endpoint별 `400 { ok:false, message, error }`
- not found: 기존 moderation/update 결과 기준 `404`
- DB schema, migration, env 이름 변경 없음
- admin UI route 보호는 UX 경계로 남겨두고, 실제 보안 경계는 `/api/admin/*` Worker route의 `requireAdmin` 검사로 둔다.

의도적으로 제외한 범위:
- 기존 `server-only` admin/places repository 직접 import
- moderation suggestion persistence/import
- `/admin/*` SPA 화면 통합

검증 결과:
- unauthenticated `GET /api/admin/places`: `401`
- demo user session `GET /api/admin/places`: `403`
- admin session `GET /api/admin/places`: `200 { items, count, source:"database", mock:false }`
- admin session `GET /api/admin/prices`: `200 { items, count, source:"database", mock:false }`
- admin session `GET /api/admin/reports`: `200 { items, count, source:"database", mock:false }`
- invalid `PATCH /api/admin/places/not-found`: `400`
- valid not-found `PATCH /api/admin/places/not-found`: `404`
- local DB pending 장소/가격 제보/신고 생성 후 admin 처리 성공:
  - `PATCH /api/admin/places/:id` reject: `200`
  - `PATCH /api/admin/prices/:id` reject: `200`
  - `PATCH /api/admin/reports/:id` reviewing: `200`
- smoke 후 `npm run db:seed`로 로컬 DB seed 상태 복구

### Vite admin SPA status
Phase 5에서 `/admin/*` placeholder를 React Router 기반 admin SPA로 교체했다.

구현한 route:
- `/admin`
- `/admin/places`
- `/admin/prices`
- `/admin/prices/places/:id`
- `/admin/reports`

보존한 경계:
- 화면 접근 전 `/api/auth/session`으로 UX 상태를 분기한다.
- 비로그인 사용자는 로그인 안내와 `/login?callbackUrl=/admin` CTA를 본다.
- 일반 사용자는 권한 부족 안내를 본다.
- 운영자 화면 데이터와 모든 mutation은 `/api/admin/*`만 호출한다.
- 실제 보안 경계는 UI route가 아니라 `/api/admin/*` Worker route의 `requireAdmin` 검사다.

의도적으로 제외한 범위:
- 기존 Next admin page/component 직접 import
- admin overview의 방문 지표/최근 가입자 전체 parity
- admin overview의 방문 지표/최근 가입자 전체 parity

검증 결과:
- unauthenticated `/admin`: `로그인이 필요합니다` 렌더링
- demo user 로그인 후 `/admin`: `운영자 권한이 필요합니다` 렌더링
- admin 로그인 후 `/admin`: `운영 대시보드` 렌더링
- admin 로그인 후 `/admin/places`: `신규 장소 승인 큐` 렌더링
- admin 로그인 후 `/admin/prices`: `가격 제보 검토 큐` 렌더링
- admin 로그인 후 `/admin/prices/places/goodprice-157`: `장소 가격 관리` 렌더링, 저장 버튼 확인
- admin 로그인 후 `/admin/reports`: `신고 검토 큐` 렌더링
- admin SPA 추가 후 client JS `434.95 kB`, gzip `128.56 kB`
- 가격 관리 route 추가 후 client JS `439.50 kB`, gzip `129.21 kB`

### Vite local smoke automation status
Phase 5/6의 수동 smoke를 반복 가능한 로컬 명령으로 고정했다.

추가 명령:
```bash
npm run smoke:vite:local
```

검증 범위:
- `npm run cf:build:vite`
- generated Worker를 `wrangler dev --local`로 실행
- `/api/health`
- `/api/categories`
- `/api/places/map`
- `/api/places/:id`
- `/api/telemetry/visit`
- admin API auth boundary: unauth `401`, user `403`, admin `200`
- admin SPA route: `/admin`, `/admin/places`, `/admin/prices`, `/admin/reports`, `/admin/prices/places/:id`

발견 및 수정:
- smoke 첫 실행에서 admin API 병렬 요청 중 DB 연결 실패가 발생했다.
- 원인은 Worker DB client가 global singleton으로 공유될 수 있는 구조였다.
- `src/worker/db.ts`를 `AsyncLocalStorage` 기반 request-local DB context로 바꿨다.
- `getWorkerDb`는 이제 `withWorkerDatabaseConnection`/`withWorkerDatabaseReadTimeout` 안에서만 사용할 수 있다.
- Worker route의 DB-backed action은 `runWorkerDatabaseRoute(c.env, ...)`를 통해 요청 종료 시 client를 닫는다.

검증 결과:
- `npm run smoke:vite:local`: 통과
- Worker bundle `561.58 kB`, gzip `119.81 kB`
- client JS `439.50 kB`, gzip `129.21 kB`

### Auth baseline
인증 이관 전에 현재 NextAuth/Auth.js 동작을 고정한다.
- session cookie 이름
- cookie attributes
- `/api/auth/session` response shape
- credentials csrf/callback request shape
- credentials success/failure redirect 동작
- Kakao/Naver OAuth callback URL
- OAuth success/failure redirect 동작
- admin session 판정 기준

## Current Auth Baseline

기준 실행:
```bash
USE_MOCK_DATA=true AUTH_SECRET=local-test-secret NEXTAUTH_URL=http://127.0.0.1:3108 SITE_URL=http://127.0.0.1:3108 npx next dev --webpack -p 3108
```

### Cookie baseline
- CSRF cookie: `next-auth.csrf-token=<csrf>|<hash>; Path=/; HttpOnly; SameSite=Lax`
- Callback URL cookie: `next-auth.callback-url=<encoded-url>; Path=/; HttpOnly; SameSite=Lax`
- Session cookie in local HTTP: `next-auth.session-token=<jwt>; Path=/; Expires=<30 days>; HttpOnly; SameSite=Lax`
- Secure production deployments may use NextAuth secure cookie naming/attributes depending on `NEXTAUTH_URL`/HTTPS. Migration must verify production-like HTTPS before cutover.
- Public visitor cookie: `altteulmap_visitor_id=<uuid>; Max-Age=31536000; Path=/; HttpOnly; SameSite=Lax`; `Secure` only on HTTPS non-localhost.

### Session shape
Unauthenticated `/api/auth/session`:
```json
{}
```

Authenticated credentials session:
```json
{
  "user": {
    "name": "근처 주민",
    "email": "demo@altteulmap.local",
    "id": "local-demo-user",
    "role": "user"
  },
  "expires": "2026-05-31T06:45:28.363Z"
}
```

Admin authorization uses `session.user.role === "admin"`.

### Credentials callback
Success request:
```text
POST /api/auth/callback/credentials
Content-Type: application/x-www-form-urlencoded

csrfToken=<csrf>&email=demo@altteulmap.local&password=demo1234&callbackUrl=/&json=true
```

Success response:
```json
{
  "url": "http://127.0.0.1:3108/"
}
```

Failure response with `json=true`:
```json
{
  "url": "http://127.0.0.1:3108/api/auth/error?error=CredentialsSignin&provider=credentials"
}
```

Failure status is `401`.

### OAuth baseline
- Provider ids: `kakao`, `naver`.
- Providers are enabled only when DB is available and each provider has both client id and client secret.
- Callback paths are NextAuth defaults:
  - `/api/auth/callback/kakao`
  - `/api/auth/callback/naver`
- Sign-in start paths are NextAuth defaults:
  - `/api/auth/signin/kakao`
  - `/api/auth/signin/naver`
- OAuth sign-in callback sync failure redirects:
  - missing email: `/login?error=OAuthEmailRequired`
  - account sync failure: `/login?error=OAuthAccountSyncFailed`
- Local mock baseline with DB/social env unavailable exposes only credentials in `/api/auth/providers`; requesting `/api/auth/signin/kakao?callbackUrl=/` redirects to `/login?...&error=kakao`.

### SPA fallback baseline
Cloudflare SPA fallback은 Phase 1에서 직접 검증한다.
- `/api/*`는 `index.html`이 아니라 JSON/API response를 반환해야 한다.
- `/sitemap.xml`은 `application/xml`을 반환해야 한다.
- `/robots.txt`는 `text/plain`을 반환해야 한다.
- `/manifest.webmanifest`는 `application/manifest+json`을 반환해야 한다.
- 알 수 없는 client route는 SPA `index.html`을 반환해야 한다.

검증 결과:
- `GET /api/health`: `200 application/json`
- `GET /api/categories`: `200 application/json`, 기존 Next contract인 `{ groups, categories }`로 수정 완료
- `GET /api/not-migrated-yet`: `501 application/json`, `index.html`로 fallback되지 않음
- `GET /sitemap.xml`: `200 application/xml; charset=utf-8`
- `GET /robots.txt`: `200 text/plain; charset=utf-8`
- `GET /manifest.webmanifest`: `200 application/manifest+json; charset=utf-8`
- `GET /place/test-route`: `200 text/html; charset=utf-8`, SPA fallback 정상

### Vite auth scaffold baseline
Phase 2에서 Vite SPA route의 `/login`, `/signup`을 추가하고, Worker에 NextAuth baseline을 흉내 내는 local credentials scaffold를 붙였다.

목적:
- 로그인/회원가입 UI route를 placeholder에서 실제 form으로 전환한다.
- Next 전용 `next-auth/react`, `next/link` import가 Vite client bundle에 섞이지 않게 분리한다.
- Phase 4의 실제 Auth.js/OAuth 이관 전에 cookie 이름, session shape, credentials success/failure shape를 smoke 가능하게 만든다.

제약:
- 이 scaffold는 운영 인증 최종 구현이 아니다.
- credentials는 local demo/admin 계정만 처리한다.
- 회원가입은 기존 local baseline처럼 DB 연결 없음 상태에서 `503 { ok:false, message:"회원가입은 데이터 연결 후 사용할 수 있습니다.", item:null }`을 반환한다.
- Kakao/Naver OAuth callback 보존 구현은 Phase 4에서 진행한다.

검증 결과:
- `GET /login`: `200 text/html`, SPA fallback 정상
- `GET /api/auth/csrf`: `200 application/json`, `next-auth.csrf-token`, `next-auth.callback-url` cookie 설정
- `POST /api/auth/callback/credentials` with `demo@altteulmap.local/demo1234`: `200 { url:"/bookmarks" }`, `next-auth.session-token` cookie 설정
- authenticated `GET /api/auth/session`: `200 { user:{ id,email,name,role }, expires }`
- invalid credentials callback: `401 { url:".../api/auth/error?error=CredentialsSignin&provider=credentials" }`
- `GET /api/auth/providers`: `200`, local baseline과 같이 `credentials` provider map 반환
- `GET /api/auth/signin/kakao?callbackUrl=/`: `302 /login?callbackUrl=%2F&error=kakao`
- invalid `POST /api/auth/signup`: `400 { ok:false, message, item:null, error }`
- valid local `POST /api/auth/signup`: `503 { ok:false, message:"회원가입은 데이터 연결 후 사용할 수 있습니다.", item:null }`

### Vite map panel baseline
Phase 2에서 `/` route의 임시 placeholder를 기존 `NaverMapPanel`로 교체했다.

보존한 경계:
- `NaverMapPanel`은 React/browser 전용 컴포넌트로 유지한다.
- 기존 `MapExplorer` 전체는 아직 가져오지 않는다. 해당 컴포넌트는 bookmark/session/detail sheet까지 함께 포함하므로 Phase 4 전에는 범위를 넓힌다.
- Naver Map SDK key는 기존 env 이름인 `NEXT_PUBLIC_NAVER_MAP_KEY_ID`, `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`를 유지한다.
- SDK key가 없거나 SDK load가 실패하면 기존 preview fallback을 사용한다.
- viewport refresh는 기존 `/api/places/map` bounds query contract를 사용한다.

검증 결과:
- `GET /`: `200 text/html`
- `GET /api/places/map?query=김밥&scope=global`: `200 application/json`
- `GET /api/places/map?minLat=37.4&maxLat=37.7&minLng=126.8&maxLng=127.2&zoom=13`: `200 application/json`
- Vite build after map panel:
  - Worker bundle `1,805.85 kB`, gzip `236.67 kB`
  - client JS `397.45 kB`, gzip `121.33 kB`
  - client CSS `51.14 kB`, gzip `10.06 kB`

### Vite place detail interaction baseline
Phase 2에서 `/place/:id` route에 public 상세 상호작용을 붙였다.

보존한 경계:
- 가격 제보 form은 기존 `PlacePriceReportForm`을 재사용한다.
- 댓글 form/list는 기존 `PlaceCommentsSection`을 재사용한다.
- 기존 `PlaceReactionButtons`는 `next/navigation` 의존성이 있어 Vite route에서 직접 사용하지 않는다.
- Vite route에는 `VitePlaceReactionButtons`를 두고, request/response contract는 기존 `PUT /api/places/:id/reaction`과 맞춘다.
- Worker mock API는 실제 DB write가 아니라 contract/smoke 검증용이다.
- visitor owner 판단은 `altteulmap_visitor_id` cookie 기준으로 유지한다.

검증 결과:
- `GET /place/:id`: `200 text/html`
- `GET /api/places/:id`: `200 application/json`
- `POST /api/places/:id/prices`: `200 { ok:true, message, source:"mock", mock:true, item }`
- `POST /api/places/:id/comments`: `200 { ok:true, message, source:"mock", mock:true, item }`
- `PUT /api/places/:id/reaction`: `200 { ok:true, source:"mock", reaction, likeCount, dislikeCount, message, placeId }`
- `DELETE /api/places/:id/comments/:commentId`: `200 { ok:true, message, source:"mock", mock:true, deletedCommentId }`
- Vite build after detail interaction:
  - Worker bundle `1,814.17 kB`, gzip `238.02 kB`
  - client JS `411.23 kB`, gzip `124.13 kB`
  - client CSS `51.11 kB`, gzip `10.05 kB`

### Vite bookmarks baseline
Phase 2에서 `/bookmarks` route와 bookmark API scaffold를 붙였다.

보존한 경계:
- `GET /api/bookmarks`는 기존 contract인 `{ items, count, source, userLabel, mock }`을 유지한다.
- unauthenticated request는 `401 { ok:false, message:"로그인이 필요합니다." }`를 반환한다.
- `PUT /api/bookmarks/:id`는 기존 `BookmarkToggleResult` shape를 유지한다.
- 기존 `BookmarkToggleButton`은 `next/navigation` 의존성이 있어 Vite route에서 직접 쓰지 않는다.
- Vite route는 `ViteBookmarkToggleButton`으로 같은 API contract를 호출한다.
- bookmark page는 `/api/bookmarks`로 place id 목록을 받은 뒤 `/api/places/:id`를 호출해 화면용 상세 데이터를 합친다.
- 실제 DB-backed bookmark persistence는 Phase 3/4 이후 기존 session 이관과 함께 검증한다.

검증 결과:
- `GET /bookmarks`: `200 text/html`
- unauthenticated `GET /api/bookmarks`: `401 { ok:false, message:"로그인이 필요합니다." }`
- credentials login 후 `GET /api/bookmarks`: `200 { items, count, source:"mock", userLabel, mock:true }`
- authenticated `PUT /api/bookmarks/goodprice-14501` with `{ bookmarked:true }`: `200 { ok:true, source:"mock", bookmarked:true, message, placeId }`
- authenticated `GET /api/bookmarks` after add: added place id 포함
- authenticated `PUT /api/bookmarks/goodprice-14501` with `{ bookmarked:false }`: `200 { ok:true, source:"mock", bookmarked:false, message, placeId }`
- Vite build after bookmarks:
  - Worker bundle `1,816.42 kB`, gzip `238.41 kB`
  - client JS `418.82 kB`, gzip `125.88 kB`
  - client CSS `51.11 kB`, gzip `10.05 kB`

## Phase 2 Closure: Route Parity Gap

Phase 2는 "Vite SPA에서 사용자 흐름이 클릭 가능한가"를 검증하는 단계로 닫는다. 이 단계의 Worker API는 대부분 mock/query 기반이며, 운영 DB persistence는 Phase 3 이후 범위다.

### Client route parity
| Route | Existing Next route | Vite route | Phase 2 status | Remaining gap |
| --- | --- | --- | --- | --- |
| `/` | `src/app/page.tsx` | `MapRoute` | connected | DB-backed map API, trending section, full mobile sheet behavior |
| `/place/:id` | `src/app/place/[id]/page.tsx` | `PlaceDetailRoute` | connected | detail SSR/OG intentionally excluded, DB-backed mutation persistence pending |
| `/submit` | `src/app/submit/page.tsx` | `SubmitRoute` | connected | DB-backed place submission pending |
| `/report` | `src/app/report/page.tsx` | `ReportRoute` | connected | DB-backed report submission pending |
| `/login` | `src/app/login/page.tsx` | `LoginRoute` | connected | real Auth.js/OAuth/session pending Phase 4 |
| `/signup` | `src/app/signup/page.tsx` | `SignupRoute` | connected | DB-backed signup pending Phase 4 |
| `/bookmarks` | `src/app/bookmarks/page.tsx` | `BookmarksRoute` | connected | DB-backed bookmarks and final session pending |
| `/admin/*` | `src/app/admin/**` | placeholder | deferred | Phase 5 scope; UI protection and `/api/admin/*` server auth tests required |

### Worker API parity
| API | Vite status | Phase 3 action |
| --- | --- | --- |
| `GET /api/categories` | contract matched, static catalog | keep as-is unless category source changes |
| `GET /api/places/map` | mock/query based | move to DB-backed `listMapPlaces` equivalent first |
| `GET /api/places/:id` | mock/query based | move to DB-backed `getPlaceDetail` equivalent with viewer context |
| `POST /api/places` | mock validation/preview | move to DB-backed public submission with visitor/session actor |
| `POST /api/places/:id/prices` | mock validation/preview | move to DB-backed pending price report write |
| `POST /api/places/:id/comments` | in-memory mock | move to DB-backed comment write |
| `DELETE /api/places/:id/comments/:commentId` | in-memory owner mock | move to DB-backed owner/admin permission check |
| `PUT /api/places/:id/reaction` | in-memory mock | move to DB-backed reaction write |
| `POST /api/reports` | mock validation/preview | move to DB-backed content report write |
| `GET /api/bookmarks` | session scaffold + in-memory mock | keep contract; final DB persistence depends on Phase 4 session |
| `PUT /api/bookmarks/:id` | session scaffold + in-memory mock | keep contract; final DB persistence depends on Phase 4 session |
| `POST /api/telemetry/visit` | not yet implemented in Vite Worker | implement in Phase 3 after public read/write API |
| `/api/auth/*` | local scaffold only | Phase 4 |
| `/api/admin/*` | not yet implemented in Vite Worker | Phase 5 |

### Phase 3 DB-backed API order
1. Public read: `GET /api/places/map`, `GET /api/places/:id`
2. Public anonymous actor helper: session-or-visitor extraction, `altteulmap_visitor_id` cookie compatibility
3. Public writes: `POST /api/places`, `POST /api/places/:id/prices`, `POST /api/places/:id/comments`, `DELETE /api/places/:id/comments/:commentId`, `PUT /api/places/:id/reaction`, `POST /api/reports`
4. Telemetry: `POST /api/telemetry/visit`
5. Bookmark DB persistence only after Phase 4 session compatibility is stable

### Phase 3 constraints
- Do not change Drizzle schema or migration files.
- Do not rename env variables; if a Worker-specific binding is required, add compatibility alias first.
- Do not remove Next/OpenNext/apps/admin during Phase 3.
- Keep existing API status/body shape and document any unavoidable runtime-only difference before changing code.
- Prefer extracting Worker-safe helper modules over importing `server-only`, `next/*`, or revalidation modules into Worker code.

## 목표 구조
```text
src/client/
  React SPA
  React Router routes

src/worker/
  Cloudflare Worker entry
  Hono API routes
  robots/sitemap/manifest routes

src/shared/
  client/worker 공용 type, schema, constants

src/db/
  Drizzle schema and repository layer
```

## Phase
1. 기준선 문서화, API/Auth baseline 고정, 병렬 Vite/Worker 스캐폴드 추가
2. public UI route 이관
3. API route 이관과 contract 비교
4. 인증과 session 이관
5. admin 통합
6. Cloudflare 배포 설정 전환
7. Next/OpenNext 제거
8. archive와 회고 정리

## 구현 규칙
- 기존 Next 앱은 parity가 확인될 때까지 제거하지 않는다.
- 새 Vite/Worker 스크립트는 기존 `dev`, `build`, `deploy`를 즉시 대체하지 않는다.
- Cloudflare Vite plugin은 ESM-only이므로 Vite 설정 파일은 `vite.config.mts`를 사용한다.
- `wrangler.jsonc`는 production OpenNext 설정이므로, 병렬 검증 단계에서는 `wrangler.vite.jsonc`를 사용한다.
- Vite deploy는 root `wrangler.jsonc`가 아니라 build output의 generated Wrangler config를 명시적으로 사용한다.
- Cloudflare plugin/Wrangler 버전은 현재 Node 20.20.2 환경과 호환되는 버전으로 고정한다.
- 동작 변경이 필요한 버그 수정은 별도 후속 작업으로 분리한다.
- Vite build output인 `dist/`는 repo-tracked source가 아니므로 git과 lint 대상에서 제외한다.
- DB schema, Drizzle migration, 운영 데이터, env variable 이름은 변경하지 않는다.
- env 이름 변경이 필요하면 기존 이름을 compatibility alias로 먼저 지원한 뒤 별도 작업으로 정리한다.
- Next/OpenNext/apps/admin 제거는 새 Vite/Worker 경로의 staging smoke와 기존 E2E parity가 통과한 뒤에만 수행한다.

## SEO 범위
이번 마이그레이션 1차 범위에서 보존하는 SEO는 아래로 제한한다.
- `sitemap.xml`
- `robots.txt`
- `manifest.webmanifest`
- 기본 `title`
- 기본 `description`
- 기본 canonical

이번 1차 범위에서 보존하지 않는다.
- 장소 상세 SSR
- 장소별 OG meta
- 장소별 crawler 전용 HTML

장소별 OG가 운영상 중요해지면 Worker-generated HTML route를 별도 Phase로 분리한다.

## Admin 보안 검증 원칙
- `/admin/*` UI 접근 차단은 UX 검증으로 본다.
- `/api/admin/*`의 서버 측 `requireAdmin` 검사를 실제 보안 경계로 본다.
- admin 통합 Phase에서는 UI route 접근 차단과 API 권한 차단을 별도 테스트로 둔다.

## 검증 명령
```bash
npm run lint
npm run typecheck
npm run cf:build:vite
git diff --check
```

Phase별로 public/admin E2E와 Cloudflare staging smoke를 추가한다.

## 산출물 비교
완료 기준에 아래 측정치를 기록한다.
- 기존 `.next` 크기
- 기존 `.open-next` 크기
- 새 `dist/client` 크기
- 새 Worker bundle 크기
- 기존 Cloudflare build 시간
- 새 Vite/Worker build 시간
- 첫 로드 JS 크기

## Phase 3 Start: Worker DB Read Boundary
`GET /api/places/map`과 `GET /api/places/:id`는 Worker-safe DB read repository를 별도로 추가해 이관을 시작했다.

기존 `src/features/places/repository.ts`는 아래 이유로 Worker entry에서 직접 import하지 않는다.
- `server-only` import가 있다.
- admin moderation helper와 Next 서버 경계가 같은 파일에 섞여 있다.
- Auth/session viewer, write repository, admin repository까지 함께 묶여 있어 public read API만 안전하게 분리하기 어렵다.

새 경계는 아래와 같다.
- `src/worker/db.ts`: Worker binding의 기존 env 이름 `DATABASE_URL`, `USE_MOCK_DATA`를 읽어 Drizzle/PostgreSQL client를 만든다.
- `src/worker/places-read-repository.ts`: public read API만 담당한다.
- DB가 비활성화되어 있거나 read timeout/failure가 발생하면 기존 mock catalog fallback을 유지한다.
- route handler는 기존 response shape를 유지한다.

현재 추가된 DB-backed 대상:
- `GET /api/places/map`
- `GET /api/places/:id`

아직 남은 Phase 3 대상:
- `POST /api/telemetry/visit`

측정값:
- Worker entry: `480.81 kB`, gzip `105.63 kB`
- Worker fallback query chunk: `1,614.04 kB`, gzip `192.93 kB`
- client JS: `418.82 kB`, gzip `125.88 kB`
- client CSS: `51.11 kB`, gzip `10.05 kB`

해석:
- DB read repository를 Worker entry로 분리하면서 main Worker entry는 작아졌다.
- 다만 fallback query chunk에는 아직 mock catalog가 남아 있다.
- Next/OpenNext 제거 전까지 fallback은 유지하되, DB-backed route parity가 충분히 쌓이면 fallback catalog를 production path에서 더 줄일 수 있다.

## Phase 3 Public Write Boundary
public write API의 Worker-safe DB helper를 추가했다.

추가된 파일:
- `src/worker/public-write-actor.ts`
- `src/worker/places-write-repository.ts`
- `src/worker/reports-write-repository.ts`

DB-backed helper를 연결한 endpoint:
- `POST /api/places`
- `POST /api/places/:id/prices`
- `POST /api/places/:id/comments`
- `DELETE /api/places/:id/comments/:commentId`
- `PUT /api/places/:id/reaction`
- `POST /api/reports`

보존한 계약:
- validation 실패 shape
- rate-limit header
- visitor cookie `altteulmap_visitor_id`
- action response의 `ok`, `message`, `source`, `mock`, `item` 또는 `preview`
- 대상 없음 `404`
- 댓글 삭제 권한 없음 `403`

중요한 제약:
- DB schema와 migration은 변경하지 않았다.
- env 이름은 `DATABASE_URL`, `USE_MOCK_DATA`를 그대로 사용한다.
- local auth scaffold의 user id는 UUID가 아니므로 DB `user_id`로 저장하지 않는다.
- 실제 Auth.js/OAuth session user id 보존은 Phase 4에서 처리한다.
- 현재 route는 DB binding이 있으면 DB helper를 우선 사용하고, DB binding이 없을 때 mock fallback을 사용한다.

측정값:
- Worker entry: `502.02 kB`, gzip `109.06 kB`
- Worker fallback query chunk: `1,614.04 kB`, gzip `192.93 kB`
- client JS: `418.82 kB`, gzip `125.88 kB`
- client CSS: `51.11 kB`, gzip `10.05 kB`

## Phase 3 Telemetry Route
`POST /api/telemetry/visit`를 Worker API로 이관했다.

추가된 파일:
- `src/worker/telemetry-repository.ts`

보존한 계약:
- request body: `{ path, ref?, scope?, source? }`
- `source`는 `ref=share`와 함께 보낼 때만 허용
- invalid JSON은 `400 { ok:false, message:"방문 이벤트 입력값을 읽지 못했습니다." }`
- validation 실패는 `400 { ok:false, message:"방문 이벤트 입력값 검증에 실패했습니다.", error }`
- 성공은 `200 { ok:true, tracked, source }`
- visitor cookie는 기존 `altteulmap_visitor_id`를 유지

DB write 보존:
- `visit_activity` table 사용
- 30분 bucket 단위 dedupe
- route group `public|admin`
- `/api`와 `/_next` path는 tracked false로 무시
- 120일 retention prune 로직 유지

측정값:
- Worker entry: `507.26 kB`, gzip `110.39 kB`
- Worker fallback query chunk: `1,614.04 kB`, gzip `192.93 kB`
- client JS: `418.82 kB`, gzip `125.88 kB`
- client CSS: `51.11 kB`, gzip `10.05 kB`

남은 Phase 3 검증:
- 실제 DB binding 환경의 read/write/telemetry smoke
- 기존 Next route와 DB response contract 비교

## Phase 3 Contract Harness
Next/Vite API shape 비교를 위해 `scripts/compare-vite-contract.mjs`를 추가했다.

실행 명령:
```bash
npm run migration:contract
```

기본 환경 변수:
```bash
CONTRACT_NEXT_BASE_URL=http://localhost:3000
CONTRACT_VITE_BASE_URL=http://localhost:3118
```

Vite Worker만 검사할 때:
```bash
CONTRACT_SKIP_NEXT=1 CONTRACT_VITE_BASE_URL=http://localhost:3119 npm run migration:contract
```

Vite response source까지 강제할 때:
```bash
CONTRACT_EXPECT_VITE_SOURCE=database CONTRACT_VITE_BASE_URL=http://localhost:3121 npm run migration:contract
```

검사 범위:
- `GET /api/categories`
- `GET /api/places/map?scope=global&query=김밥`
- `GET /api/places/goodprice-14501`
- `GET /api/places/not-found`
- unauthenticated `GET /api/bookmarks`
- public write validation failures
- telemetry valid/validation responses

의도적으로 제외한 것:
- 실제 장소 등록 성공
- 실제 가격 제보 성공
- 실제 댓글 생성 성공
- 실제 신고 생성 성공

이유:
- contract 비교는 반복 가능해야 한다.
- 성공 mutation은 운영/스테이징 DB에 데이터를 생성할 수 있으므로 별도 DB smoke 플래그 또는 전용 테스트 데이터 정책이 생긴 뒤 실행한다.
- `CONTRACT_EXPECT_VITE_SOURCE`는 DB binding을 넣었는데도 mock fallback으로 조용히 통과하는 상황을 잡기 위한 guard다.

## Phase 3 Contract Comparison Result
mock/fallback 조건에서 Next와 Vite Worker의 public API contract 비교를 실행했다.

실행 조건:
```bash
USE_MOCK_DATA=true npx next dev --webpack -p 3000
npm run cf:build:vite
npx wrangler dev --config dist/altteulmap_vite_migration/wrangler.json --port 3120 --local
CONTRACT_NEXT_BASE_URL=http://localhost:3000 CONTRACT_VITE_BASE_URL=http://localhost:3120 npm run migration:contract
```

최초 발견한 drift:
- `GET /api/places/map`의 Vite mock fallback이 map preview item이 아니라 detail item shape를 반환했다.
- 불필요한 `priceItems`, `history`, `comments`가 `items`와 `mapMarkers`에 포함됐다.

수정:
- `src/worker/places-read-repository.ts`의 mock map fallback을 Next와 같은 `PlacePreviewRecord` shape로 좁혔다.

결과:
- Next/Vite contract comparison 통과
- verified endpoints:
  - `GET /api/categories`
  - `GET /api/places/map?scope=global&query=김밥`
  - `GET /api/places/goodprice-14501`
  - `GET /api/places/not-found`
  - unauthenticated `GET /api/bookmarks`
  - public write validation routes
  - telemetry valid/validation routes

측정값:
- Worker entry: `507.95 kB`, gzip `110.51 kB`
- Worker fallback query chunk: `1,614.04 kB`, gzip `192.93 kB`
- client JS: `418.82 kB`, gzip `125.88 kB`
- client CSS: `51.11 kB`, gzip `10.05 kB`

남은 비교:
- Vite Worker에 실제 DB binding을 주입한 DB-backed read/write/telemetry smoke
- DB-backed Vite response와 기존 Next response contract 비교

## Phase 3 DB-Backed Smoke Attempt
Vite Worker에 `DATABASE_URL`/`USE_MOCK_DATA=false` binding을 주입해 DB-backed smoke를 시도했다.

실행 조건:
```bash
npm run cf:build:vite
npx wrangler dev --config dist/altteulmap_vite_migration/wrangler.json --port 3121 --local
```

확인한 환경:
- `.env.local`의 `DATABASE_URL`은 운영 Supabase가 아니라 `127.0.0.1:5432/altteulmap` 로컬 DB를 가리킨다.
- 해당 시점에 로컬 Postgres listener가 없어 Node 직접 접속은 `ECONNREFUSED 127.0.0.1:5432`로 실패했다.
- Worker 로그도 `proxy request failed, cannot connect to the specified address`를 기록한 뒤 mock fallback으로 내려갔다.

결과:
- `GET /api/places/map?scope=global&query=김밥` -> `200`, `source:"mock"`
- `GET /api/places/goodprice-14501` -> `200`, `source:"mock"`
- valid telemetry payload -> `200 { ok:true, tracked:false, source:"mock" }`
- invalid write validation은 기존대로 `400`

추가한 guard:
```bash
CONTRACT_SKIP_NEXT=1 CONTRACT_VITE_BASE_URL=http://localhost:3121 CONTRACT_EXPECT_VITE_SOURCE=database npm run migration:contract
```

현재 결과:
- 의도대로 실패한다.
- 실패 메시지: `map search expected Vite source 'database' but received 'mock'`

mock fallback 조건의 비교:
```bash
CONTRACT_NEXT_BASE_URL=http://localhost:3000 CONTRACT_VITE_BASE_URL=http://localhost:3121 CONTRACT_EXPECT_VITE_SOURCE=mock npm run migration:contract
```

결과:
- Next/Vite contract comparison 통과
- 이는 API shape parity 통과이며, DB-backed parity 통과가 아니다.

다음 DB 검증 조건:
- 로컬 Docker Postgres가 정상 기동되어 `127.0.0.1:5432/altteulmap`에 접속 가능해야 한다.
- 또는 Supabase/Hyperdrive 등 실제 Worker에서 접근 가능한 `DATABASE_URL` binding으로 staging smoke를 실행해야 한다.
- DB-backed 검증은 `CONTRACT_EXPECT_VITE_SOURCE=database`를 함께 사용해 mock fallback 통과를 막는다.

## Phase 3 DB-Backed Contract Result
로컬 Docker Postgres를 기동하고 기존 schema/seed를 넣은 뒤 DB-backed Worker route를 검증했다.

준비:
```bash
docker compose up -d postgres
npm run db:push
npm run db:seed
```

로컬 DB 기준:
- `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap`
- active places: `1000`

발견한 Worker runtime 이슈:
- 첫 DB 요청은 성공했지만, telemetry/write 성공 요청 뒤 다음 request에서 `Cannot perform I/O on behalf of a different request` 오류가 발생했다.
- 원인: Postgres.js client가 global state에 남아 request 간 socket을 재사용했다.
- Cloudflare Workers에서는 request handler 간 I/O 객체 재사용이 금지된다.

수정:
- `src/worker/db.ts`에 `closeWorkerDatabaseConnection()`을 추가하고 read timeout helper가 client close를 await하도록 수정했다.
- `src/worker/telemetry-repository.ts`는 DB 기록 후 client를 닫도록 수정했다.
- `src/worker/index.ts`는 DB-backed public write route를 `runWorkerDatabaseRoute()`로 감싸 성공/실패 후 client를 닫도록 수정했다.

DB-backed read/telemetry smoke:
- `GET /api/places/map?scope=global&query=김밥` -> `200`, `source:"database"`, `mock:false`, count `55`
- `GET /api/places/:id` -> `200`, `source:"database"`, `mock:false`, price items 포함
- valid `POST /api/telemetry/visit` -> `200 { ok:true, tracked:true, source:"database" }`
- invalid `POST /api/places` -> `400`

DB-backed contract comparison:
```bash
CONTRACT_NEXT_BASE_URL=http://localhost:3000 CONTRACT_VITE_BASE_URL=http://localhost:3122 CONTRACT_EXPECT_VITE_SOURCE=database npm run migration:contract
```

결과:
- Next/Vite contract comparison 통과
- Vite response source guard도 통과
- 검증 범위:
  - `GET /api/categories`
  - `GET /api/places/map?scope=global&query=김밥`
  - `GET /api/places/goodprice-14501`
  - `GET /api/places/not-found`
  - unauthenticated `GET /api/bookmarks`
  - public write validation routes
  - telemetry valid/validation routes

로컬 DB write smoke:
- `POST /api/places/:id/prices` -> `200`, `source:"database"`, `ok:true`
- `POST /api/places/:id/comments` -> `200`, `source:"database"`, `ok:true`
- `PUT /api/places/:id/reaction` -> `200`, `source:"database"`, `ok:true`
- `POST /api/reports` -> `200`, `source:"database"`, `ok:true`
- `DELETE /api/places/:id/comments/:commentId` -> `200`, `source:"database"`, `ok:true`

후처리:
- 성공 write smoke는 로컬 DB에만 실행했다.
- smoke 후 `npm run db:seed`를 다시 실행해 로컬 DB를 seed 기준 상태로 복구했다.

측정값:
- Worker entry: `508.41 kB`, gzip `110.58 kB`
- Worker fallback query chunk: `1,614.04 kB`, gzip `192.93 kB`
- client JS: `418.82 kB`, gzip `125.88 kB`
- client CSS: `51.11 kB`, gzip `10.05 kB`

Phase 3 결론:
- public read/write/telemetry Worker API는 DB-backed 로컬 기준으로 1차 parity를 통과했다.
- 성공 mutation의 운영/staging 검증은 전용 테스트 데이터 정책 또는 staging DB에서만 실행한다.
- 다음 phase는 실제 Auth.js/OAuth/session 보존이다.

## Phase 4 Credentials Session Batch
Worker auth scaffold를 DB-backed credentials/session 기준으로 교체했다.

추가된 파일:
- `src/worker/auth-repository.ts`

수정된 경로:
- `GET /api/auth/providers`
- `POST /api/auth/callback/credentials`
- `GET /api/auth/session`
- `POST /api/auth/signup`
- session-aware public routes that call `getSessionFromRequest`

보존한 계약:
- session cookie name: `next-auth.session-token`
- csrf cookie name: `next-auth.csrf-token`
- callback URL cookie name: `next-auth.callback-url`
- credentials callback success: `200 { url }`
- credentials callback failure: `401 { url:".../api/auth/error?error=CredentialsSignin&provider=credentials" }`
- session shape: authenticated `200 { user:{ id, email, name, role }, expires }`, unauthenticated `200 {}`
- signup validation/duplicate/status 의미: validation `400`, duplicate `409`, success `201`

구현 결정:
- Worker session cookie 값은 `v1.<payload>.<signature>` 형식의 signed payload로 저장한다.
- 기존 NextAuth cookie 이름은 유지하지만, Worker 병렬 경로에서는 Worker가 검증 가능한 signed cookie를 사용한다.
- `AUTH_SECRET` binding이 있으면 서명에 사용하고, local smoke fallback만 `vite-local-auth-secret`를 사용한다.
- DB credentials login은 기존 `auth_accounts`의 `credentials` provider row와 `password_hash`를 검증한다.
- demo/admin 계정은 기존 env password override 의미를 유지한다.
- signup은 기존 `users`, `auth_accounts` schema를 그대로 사용한다.
- DB 작업 후 Worker Postgres client를 닫는 Phase 3 원칙을 auth route에도 적용한다.

로컬 smoke:
- `GET /api/auth/csrf` -> `200`, csrf token 있음
- `GET /api/auth/providers` -> `200`, credentials + configured social provider keys
- invalid credentials -> `401`, `CredentialsSignin` error URL
- valid credentials `demo@altteulmap.local/demo1234` -> `200 { url:"/bookmarks" }`
- session cookie starts with `v1.`
- `GET /api/auth/session` -> DB user id, email, name, role 포함
- authenticated `GET /api/bookmarks` -> `200`, session user label 유지
- signup unique email -> `201 { ok:true, item }`
- signup duplicate email -> `409 { ok:false }`

후처리:
- signup smoke가 만든 로컬 테스트 계정은 `npm run db:seed`로 정리했다.

남은 Phase 4:
- Kakao OAuth authorization redirect
- Kakao OAuth callback token/profile exchange
- Naver OAuth authorization redirect
- Naver OAuth callback token/profile exchange
- OAuth account sync parity
- OAuth 실패 redirect parity
- admin authorization boundary 재검증

## Phase 4 OAuth Redirect/Callback Batch
Kakao/Naver OAuth route를 Worker에 추가했다.

수정된 경로:
- `GET /api/auth/signin/kakao`
- `GET /api/auth/signin/naver`
- `GET /api/auth/callback/kakao`
- `GET /api/auth/callback/naver`

보존한 계약:
- provider ids: `kakao`, `naver`
- sign-in start path: `/api/auth/signin/:provider`
- callback path: `/api/auth/callback/:provider`
- OAuth sync failure redirect:
  - missing email -> `/login?error=OAuthEmailRequired`
  - account sync failure -> `/login?error=OAuthAccountSyncFailed`
  - callback/token/profile failure -> `/login?error=OAuthCallback`
- account sync는 기존 `users`, `auth_accounts` schema를 사용한다.
- 성공 시 Worker signed `next-auth.session-token` cookie를 설정한다.

구현 세부:
- OAuth state는 `next-auth.state` cookie와 query `state`에 같은 signed payload로 넣는다.
- state payload는 provider, callbackUrl, nonce, expires를 포함한다.
- Kakao authorization endpoint: `https://kauth.kakao.com/oauth/authorize`
- Kakao token endpoint: `https://kauth.kakao.com/oauth/token`
- Kakao profile endpoint: `https://kapi.kakao.com/v2/user/me`
- Naver authorization endpoint: `https://nid.naver.com/oauth2.0/authorize`
- Naver token endpoint: `https://nid.naver.com/oauth2.0/token`
- Naver profile endpoint: `https://openapi.naver.com/v1/nid/me`

로컬 smoke:
- `GET /api/auth/providers` -> `200`, configured env 기준 `credentials`, `kakao`, `naver`
- `GET /api/auth/signin/kakao?callbackUrl=/bookmarks` -> `302`, host `kauth.kakao.com`, `response_type=code`, redirect URI `/api/auth/callback/kakao`, state 있음
- `GET /api/auth/signin/naver?callbackUrl=/` -> `302`, host `nid.naver.com`, `response_type=code`, redirect URI `/api/auth/callback/naver`, state 있음
- missing code callback -> `/login?callbackUrl=%2F&error=OAuthCallback`
- bad state callback -> `/login?callbackUrl=%2F&error=OAuthCallback`
- synthetic `syncWorkerOAuthUser` smoke -> user/account sync 성공

후처리:
- synthetic OAuth account sync smoke가 만든 로컬 테스트 계정은 `npm run db:seed`로 정리했다.

남은 Phase 4:
- 실제 Kakao/Naver 계정으로 live callback smoke
- OAuth 성공 후 `/api/auth/session` shape 확인
- admin authorization boundary 재검증
