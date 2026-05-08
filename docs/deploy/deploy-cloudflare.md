# Cloudflare 배포 가이드

기준일: 2026-05-08

## 현재 운영 기준
- 운영 URL: `https://altteulmap.altteul-lab.workers.dev`
- 관리자 URL: `https://altteulmap.altteul-lab.workers.dev/admin`
- 구조: Vite React SPA + Hono/Cloudflare Worker API 단일 Worker
- 운영 DB: Supabase PostgreSQL
- 배포 방식: 로컬 또는 CI에서 Vite 산출물을 만든 뒤 `dist/altteulmap/wrangler.json`으로 Worker 배포
- `altteulmap-admin` 별도 Worker는 legacy 링크를 통합 Worker로 보내는 redirect 전용 Worker이며, 실제 admin 기능은 통합 Worker의 `/admin`이 담당한다.

## 필수 Secret/Var
Cloudflare Worker `altteulmap`에는 최소한 아래 binding이 있어야 한다.

```text
DATABASE_URL
AUTH_SECRET
NEXTAUTH_URL
SITE_URL
AUTH_DEMO_PASSWORD
AUTH_ADMIN_PASSWORD
AUTH_KAKAO_CLIENT_ID
AUTH_KAKAO_CLIENT_SECRET
AUTH_NAVER_CLIENT_ID
AUTH_NAVER_CLIENT_SECRET
NEXT_PUBLIC_NAVER_MAP_KEY_ID
USE_MOCK_DATA=false
```

운영 URL 기준:

```text
NEXTAUTH_URL=https://altteulmap.altteul-lab.workers.dev
SITE_URL=https://altteulmap.altteul-lab.workers.dev
```

OAuth callback:

```text
https://altteulmap.altteul-lab.workers.dev/api/auth/callback/kakao
https://altteulmap.altteul-lab.workers.dev/api/auth/callback/naver
```

## 배포 전 검증
```bash
npm run typecheck
npm run lint
npm run cf:build:vite
npm run deploy:check:vite
npm run smoke:vite:local
git diff --check
```

`npm run build`는 아래 산출물을 만든다.

```text
dist/altteulmap/wrangler.json
dist/altteulmap/index.mjs
dist/client/index.html
dist/client/assets/*
```

Cloudflare Workers Builds의 build command는 아래를 사용한다.

```bash
npm run cf:build:vite
```

이 명령은 canonical output인 `dist/altteulmap/*`를 만든 뒤, 이전 Dashboard deploy command가 참조하던 `dist/altteulmap_vite_migration/*` alias도 함께 만든다. 올바른 deploy command는 아래 canonical 경로다.

```bash
npx wrangler deploy --config dist/altteulmap/wrangler.json --name altteulmap
```

Cloudflare Dashboard 설정 기준:

```text
Build command: npm run cf:build:vite
Deploy command: npx wrangler deploy --config dist/altteulmap/wrangler.json --name altteulmap
Non-production branch deploy command: 비워둠
Build cache: Enabled
Path: 비워둠
```

현재 Dashboard에 이전 command가 남아 있으면 아래도 동작하도록 alias를 유지한다.

```bash
npx wrangler deploy --config dist/altteulmap_vite_migration/wrangler.json --name altteulmap
```

## 배포
Cloudflare Dashboard Builds 저장 폼이 불안정할 수 있으므로, 현재 기준 운영 배포는 Wrangler 직접 배포를 기본 경로로 둔다.

```bash
npm run deploy
```

실행되는 핵심 명령:

```bash
npm run build
wrangler deploy --config dist/altteulmap/wrangler.json
```

## DB Migration 포함 배포 순서
DB migration이 포함된 변경은 code deploy보다 migration을 먼저 적용한다.

이번 pre-mortem 하드닝 변경에는 아래 migration이 포함된다.

```text
drizzle/0011_wise_mantis.sql
drizzle/0012_woozy_thunderbolt.sql
```

운영 배포 순서:

```bash
PRODUCTION_DATABASE_URL=<production-database-url> npm run db:migrate
npm run deploy
SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev \
SMOKE_ADMIN_EMAIL=<admin-email> \
SMOKE_ADMIN_PASSWORD=<admin-password> \
npm run smoke:remote
```

주의:
- `0011_wise_mantis.sql`은 `public_write_rate_limits` 테이블을 만든다.
- `0012_woozy_thunderbolt.sql`은 지도 bbox 조회용 `places(status, latitude, longitude)` 계열 인덱스를 만든다.
- 이 migration 없이 새 Worker code를 먼저 배포하면 public write route가 해당 테이블을 찾지 못해 실패하거나, 지도 API가 데이터 증가 시 불필요하게 느려질 수 있다.
- `db:migrate`는 `drizzle/` migration folder를 기준으로 아직 적용되지 않은 migration만 적용한다.
- 로컬 `.env`의 `DATABASE_URL`은 개발 DB를 가리킬 수 있으므로 운영 적용 시 `PRODUCTION_DATABASE_URL`을 shell env로 직접 주입한다.
- `db:push`는 로컬 개발 편의용이며 운영 반영 경로로 사용하지 않는다.

## DB Timeout 기준
Worker와 서버/스크립트 DB client는 같은 timeout baseline을 사용한다.

```text
postgres max connections per isolate: 1
connect_timeout: 5s
idle_timeout: 5s
max_lifetime: 60s
statement_timeout: 4500ms
lock_timeout: 2000ms
idle_in_transaction_session_timeout: 5000ms
read response timeout: 5000ms
temporary unavailable TTL: 60000ms
```

운영 정책:
- DB read timeout은 mock 성공으로 fallback하지 않는다.
- public read API는 DB unavailable 상태를 `503` JSON으로 드러낸다.
- timeout 이후 같은 isolate는 60초 동안 DB를 temporarily unavailable로 보고 빠르게 실패한다.
- `postgres` driver의 `statement_timeout`이 서버 측 long-running query를 중단하고, response timeout은 Worker 응답 지연을 제한한다.
- 현재 `wrangler.jsonc`에는 Hyperdrive binding이 없다. Supabase 직접 연결이 반복적으로 timeout되거나 connection churn이 늘면 Hyperdrive 도입을 별도 작업으로 진행한다.

## Security Headers 기준
SPA 정적 asset은 `public/_headers`가 Vite build 때 `dist/client/_headers`로 복사되어 Cloudflare Assets에 적용된다.
API/Worker-generated response는 Worker middleware에서 같은 baseline을 적용한다.

공통 보안 헤더:
- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), payment=(), usb=(), geolocation=(self)`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`

CSP allowlist 기준:
- 기본 출처는 `default-src 'self'`다.
- `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`를 고정한다.
- Naver Maps SDK 로딩을 위해 `script-src`에 `https://oapi.map.naver.com`, `https://openapi.map.naver.com`, `https://*.pstatic.net`을 허용한다.
- React inline style과 Naver marker HTML style을 위해 `style-src 'unsafe-inline'`은 현재 필요하다.
- 지도 타일/이미지 로딩을 위해 `img-src`는 `https:`, `data:`, `blob:`을 허용한다.
- 지도 API/타일 호출을 위해 `connect-src`에 Naver/Carto 관련 host를 허용한다.

검증:
```bash
npm run smoke:vite:local
```

`smoke:vite:local`은 `/` HTML과 주요 API response의 CSP, frame 차단, nosniff, referrer, permissions policy가 유지되는지 확인한다.

## Map API 성능 기준
지도 API는 현재 seed 1k 수준에서는 아래 목표를 기준으로 본다.

```text
1k places: p95 <= 300ms
10k places: p95 <= 500ms
100k places: p95 <= 800ms
```

측정 명령:

```bash
MAP_MEASURE_URL=https://altteulmap.altteul-lab.workers.dev npm run map:measure
```

측정 시나리오:
- 서울 전체 viewport + zoom 11
- 서울 일부 viewport + category + zoom 13
- global keyword search

현재 스키마 기준:
- `places_status_lat_lng_idx`: 일반 viewport bbox 조회용
- `places_status_category_lat_lng_idx`: category + viewport bbox 조회용
- 검색어가 있는 global query는 `ILIKE '%query%'` 기반이라 데이터가 커지면 별도 full-text/trigram index가 필요할 수 있다.

운영 판단:
- viewport 시나리오가 목표를 넘으면 bbox 인덱스 적용 여부와 query plan을 먼저 확인한다.
- global keyword search가 목표를 넘으면 `pg_trgm` 또는 full-text search 도입을 별도 migration으로 분리한다.
- 100k 이상에서 clustering 비용이 커지면 서버 clustering을 grid/pre-aggregation 또는 PostGIS 기반으로 분리한다.

## GitHub Actions 기준
`main` 직접 push와 PR 모두 CI를 실행한다.

CI에서 확인하는 항목:
- `npm run verify`
- `npm run cf:build:vite`
- `npm run deploy:check:vite`
- `npm run db:generate` 후 migration drift 확인
- `git diff --check`
- PostgreSQL service 기반 full E2E

수동 실행(`workflow_dispatch`)에서는 optional remote smoke job도 실행할 수 있다.
GitHub repository secrets에 아래 값을 넣으면 운영 URL smoke까지 확인한다.

```text
SMOKE_PUBLIC_URL
SMOKE_ADMIN_EMAIL
SMOKE_ADMIN_PASSWORD
```

## 배포 후 Smoke
```bash
SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev npm run smoke:remote
```

관리자 credentials까지 포함해 확인하려면 secret을 shell env로만 주입한다.

```bash
SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev \
SMOKE_ADMIN_EMAIL=<admin-email> \
SMOKE_ADMIN_PASSWORD=<admin-password> \
npm run smoke:remote
```

## 운영 Health와 장애 Runbook
가장 먼저 확인할 endpoint:

```bash
SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev npm run smoke:remote
```

단일 endpoint로 빠르게 볼 때:

```bash
curl -s https://altteulmap.altteul-lab.workers.dev/api/health?deep=1 | jq
```

`/api/health` 기본 응답은 런타임, public config, auth provider 설정, DB 설정 상태만 확인한다.
`/api/health?deep=1`은 추가로 DB `select 1`과 SPA static asset 응답을 확인한다.

health check 항목:
- `runtime`: Worker 런타임 응답 여부
- `public-config`: Naver Maps public key 노출 여부
- `auth-providers`: credentials, Kakao, Naver provider 설정 여부
- `database-config`: 기본 health에서 DB env/mock 상태 확인
- `database`: deep health에서 실제 DB 연결과 query 확인
- `static-assets`: deep health에서 Cloudflare Assets HTML 응답 확인

장애별 확인 순서:
- `database` 실패: Supabase project paused 여부, `DATABASE_URL` secret, DB password rotation, `drizzle/0011_wise_mantis.sql` 적용 여부, Supabase connection limit을 확인한다.
- `public-config` 실패: Cloudflare Worker var의 `NEXT_PUBLIC_NAVER_MAP_KEY_ID` 또는 호환 var를 확인한다.
- `auth-providers` degraded: `AUTH_KAKAO_CLIENT_ID/SECRET`, `AUTH_NAVER_CLIENT_ID/SECRET`, `AUTH_SECRET`, `NEXTAUTH_URL`, `SITE_URL`을 확인한다.
- `static-assets` 실패: Cloudflare deploy output의 `dist/client/index.html`, Dashboard deploy command, `dist/altteulmap/wrangler.json` asset binding을 확인한다.
- `smoke:remote`에서 map/place `source=database` 실패: production mock fallback 금지 정책 위반 또는 DB 장애다. `USE_MOCK_DATA=false`와 DB health를 먼저 확인한다.
- OAuth redirect 실패: Provider console callback URL과 Worker `NEXTAUTH_URL`/`SITE_URL`이 같은 origin인지 확인한다.

알림 운영 기준:
- 지금 단계에서는 별도 유료 모니터링을 추가하지 않고, GitHub Actions `workflow_dispatch`의 `remote-smoke` job과 수동 `npm run smoke:remote`를 1차 운영 점검으로 둔다.
- 실제 사용자 유입이 생기면 Cloudflare Workers Logs/Logpush 또는 Sentry Free 중 하나를 도입한다.
- Sentry를 도입할 때는 Worker server error, client runtime error, OAuth callback error, DB unavailable error를 우선 수집 대상으로 둔다.

원격 smoke가 자동으로 확인하는 OAuth/Auth 범위:
- `/api/auth/providers`가 credentials, Kakao, Naver provider를 노출한다.
- `/api/auth/signin/kakao`, `/api/auth/signin/naver`가 각 Provider host로 `302` redirect한다.
- Provider redirect의 `redirect_uri`가 운영 callback URL과 정확히 일치한다.
- OAuth signin response가 `next-auth.state` cookie를 만들고, redirect query의 `state`와 cookie 값이 일치한다.
- OAuth state cookie와 credentials session cookie가 `HttpOnly`, `SameSite=Lax`, `Secure` 속성을 가진다.
- 관리자 credentials 로그인은 `/admin` callback URL, `next-auth.session-token`, `/api/auth/session`의 `user.email`, `user.role=admin`, `expires` shape를 검증한다.
- credentials 세션으로 `/api/admin/places`가 database source를 반환한다.
- `/api/auth/signout`이 session cookie를 만료시키고, 이후 `/api/auth/session`이 빈 객체를 반환한다.

원격 smoke가 자동화하지 못하는 범위:
- Kakao/Naver Provider UI에서 실제 로그인 승인, 동의 철회, 계정 선택, 이메일 권한 누락 같은 live callback 흐름은 외부 계정/브라우저 상태가 필요하다.
- 이 범위는 아래 수동 OAuth QA 체크리스트로 배포 후 반드시 확인한다.

## OAuth 수동 QA 체크리스트
Provider 콘솔 설정:
- Kakao Redirect URI: `https://altteulmap.altteul-lab.workers.dev/api/auth/callback/kakao`
- Naver Callback URL: `https://altteulmap.altteul-lab.workers.dev/api/auth/callback/naver`
- Kakao 동의 항목에는 nickname과 account email 접근이 허용되어야 한다.
- Naver profile에는 id, email, nickname/name 접근이 허용되어야 한다.
- Cloudflare Worker var의 `NEXTAUTH_URL`, `SITE_URL`은 운영 origin과 같아야 하며 trailing slash를 붙이지 않는다.

Kakao live login:
- `/login`에서 Kakao 로그인을 누르면 Kakao 로그인/동의 화면으로 이동한다.
- 승인 후 원래 callback URL(`/bookmarks` 등)로 돌아온다.
- `/api/auth/session`이 `user.email`, `user.name`, `user.role`, `expires`를 포함한다.
- `next-auth.session-token` cookie가 `HttpOnly`, `Secure`, `SameSite=Lax`로 설정된다.
- 로그아웃 후 `/api/auth/session`은 `{}`를 반환하고 `/bookmarks`는 다시 로그인을 요구한다.

Naver live login:
- `/login`에서 Naver 로그인을 누르면 Naver 로그인/동의 화면으로 이동한다.
- 승인 후 원래 callback URL(`/bookmarks` 등)로 돌아온다.
- `/api/auth/session` shape와 session cookie 속성은 Kakao와 동일하게 확인한다.
- 로그아웃 후 session이 제거된다.

실패/권한 경계:
- OAuth 동의를 취소하면 로그인 에러 화면으로 돌아오고 session cookie가 생기지 않는다.
- Provider에서 email 권한이 빠지면 `OAuthEmailRequired` 실패로 처리되어야 한다.
- 일반 social user는 `/admin` UI에 접근하더라도 `/api/admin/*`에서 `401` 또는 `403`으로 차단되어야 한다.
- 관리자 권한은 Provider 계정이 아니라 DB `users.role=admin`이 실제 보안 기준이다.

수동 확인:
- `/`
- `/admin`
- `/api/health`
- `/api/categories`
- `/api/places/map?scope=global`
- `/api/auth/providers`
- `/api/auth/signin/kakao` provider redirect
- `/api/auth/signin/naver` provider redirect
- `/api/admin/places` 비로그인 `401`
- `/robots.txt`
- `/sitemap.xml`
- `/manifest.webmanifest`

legacy admin redirect 확인:

```bash
npm run deploy:admin-redirect
```

확인할 redirect:

```text
https://altteulmap-admin.altteul-lab.workers.dev/ -> https://altteulmap.altteul-lab.workers.dev/admin
https://altteulmap-admin.altteul-lab.workers.dev/admin/places -> https://altteulmap.altteul-lab.workers.dev/admin/places
```

## Rollback
문제가 생기면 GitHub에서 직전 정상 커밋으로 되돌린 뒤 다시 배포한다.

```bash
git revert <bad-commit>
npm run deploy
```

이전 Next/OpenNext split 구조는 Phase 7 cleanup 이후 코드에서 제거되므로, rollback 기준은 Git 이력이다.
