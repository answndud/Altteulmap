# 운영 신뢰성 하드닝 결과 보고서

작성일: 2026-05-08 14:07 KST  
대상 커밋: `6134070 chore: harden production reliability`  
운영 배포 URL: `https://altteulmap.altteul-lab.workers.dev`  
배포 Version ID: `68eb066e-3fcc-4993-ba9d-7343b4711bc8`

## 요약
- 오늘 작업은 신규 기능 개발이 아니라, 출시/운영 전에 실패 가능성이 높은 구멍을 막는 pre-mortem 기반 운영 하드닝이었다.
- 핵심 개선은 운영 DB 신뢰성, public/admin 쓰기 무결성, 익명 쓰기 abuse 방어, Cloudflare 배포 신뢰성, OAuth/DB/static 관측성, 지도 API 성능 대비다.
- 운영 DB migration 적용, Worker 배포, 관리자 credentials 포함 remote smoke까지 완료했다.
- `docs/PLAN.md`, `docs/PROGRESS.md`는 `현재 active 작업 없음`으로 정리했고, 상세 archive는 `docs/COMPLETED.md`의 `051`에 남겼다.

## 변경 규모
- 커밋: `6134070 chore: harden production reliability`
- 변경 파일: 25개
- 변경량: 7,148 insertions, 600 deletions
- 신규 주요 파일:
  - `drizzle/0011_wise_mantis.sql`
  - `drizzle/0012_woozy_thunderbolt.sql`
  - `public/_headers`
  - `scripts/measure-map-api.mjs`
  - `scripts/migrate-production.mjs`
  - `src/worker/rate-limit-repository.ts`
  - `docs/refactoring-large-files.md`

## 무엇이 바뀌었나

### 운영 DB 신뢰성
- 이전:
  - production DB 장애, Supabase pause, credential 문제, timeout이 발생해도 mock fallback이 성공 응답처럼 보일 수 있었다.
  - 사용자는 실제 운영 데이터가 아닌 fallback 데이터를 정상 서비스로 오인할 수 있었다.
- 이후:
  - production DB read 실패 시 mock fallback을 금지했다.
  - public map/detail API는 운영 DB unavailable 상태를 명시적인 503/degraded response로 드러낸다.
  - remote smoke가 map/detail/admin API의 `source=database`를 확인한다.
- 개선 효과:
  - 운영 데이터 장애가 조용히 숨겨지는 리스크를 제거했다.
  - “서비스가 정상처럼 보이지만 실제 DB가 죽어 있는 상태”를 smoke에서 잡을 수 있다.

### Public/Admin write 무결성
- 이전:
  - 장소 등록, 가격 제보 승인/반려, 가격 항목 수정, 신고 처리의 여러 DB write가 중간 실패 시 partial state로 남을 수 있었다.
- 이후:
  - 장소 등록 흐름을 transaction으로 묶었다.
  - 장소 승인/반려, 가격 제보 승인/반려, price item 생성/갱신, pricing summary refresh, admin action 기록을 transaction으로 묶었다.
  - 신고 상태 변경과 admin action 기록도 같은 transaction으로 묶었다.
- 개선 효과:
  - 중간 insert/update 실패 시 반쪽짜리 데이터가 남을 가능성을 크게 줄였다.
  - 운영자 처리 결과와 audit action 기록의 정합성이 좋아졌다.

### 익명 쓰기 abuse 방어
- 이전:
  - rate limit이 Worker isolate 메모리 기반이라 cold start, 다른 edge isolate, cookie reset에 약했다.
- 이후:
  - `public_write_rate_limits` 테이블을 추가했다.
  - public write route가 DB-backed persistent rate limit을 우선 사용한다.
  - DB 비활성 mock/local 모드에서만 기존 memory fallback을 사용한다.
- 측정/검증:
  - 같은 visitor cookie로 댓글 9회 제출 시 9번째 요청에서 `429`, `Retry-After`, `X-RateLimit-Remaining: 0` 확인.
- 개선 효과:
  - edge isolate가 바뀌어도 같은 actor의 과도한 쓰기를 서버 기준으로 제한할 수 있다.

### Cloudflare 배포 신뢰성
- 이전:
  - Cloudflare Dashboard build/deploy path mismatch로 latest build failed가 발생할 수 있었다.
  - main 직접 push 운영 방식과 GitHub Actions trigger가 완전히 맞지 않았다.
- 이후:
  - canonical deploy output을 `dist/altteulmap/wrangler.json`으로 고정했다.
  - legacy alias `dist/altteulmap_vite_migration`도 유지해 Dashboard stale command와의 호환성을 남겼다.
  - main push CI에서 verify, Vite Worker build, deploy output check, migration drift check, whitespace check를 수행하도록 했다.
- 개선 효과:
  - “실제 서비스는 배포됐는데 Dashboard latest build는 failed” 같은 운영 혼선을 줄였다.
  - deploy command 기준이 문서, script, CI에 맞춰졌다.

### 운영 DB migration 경로
- 이전:
  - 배포 문서가 `DATABASE_URL=<production> npm run db:push`를 안내하고 있었다.
  - `db:push`는 로컬 개발 편의용이라 운영 migration 원본 원칙과 맞지 않았다.
- 이후:
  - `scripts/migrate-production.mjs`와 `npm run db:migrate`를 추가했다.
  - 운영 적용은 Drizzle migration folder 기준으로 수행한다.
  - 로컬 DB에는 기본적으로 실행을 거부하는 guard를 추가했다.
- 검증:
  - 로컬 `DATABASE_URL=127.0.0.1`에서는 `npm run db:migrate` 실행 거부 확인.
  - Supabase pooler 운영 DB URL 기준 `npm run db:migrate` 실행 통과.
- 개선 효과:
  - 운영 migration 절차가 더 명확하고 재현 가능해졌다.
  - 로컬 DB URL을 실수로 운영 migration 경로로 쓰는 사고를 방지한다.

### OAuth/Auth smoke 기준
- 이전:
  - OAuth live 동작은 수동 확인 의존도가 컸고, remote smoke가 provider redirect/state/session contract를 충분히 보지 못했다.
- 이후:
  - Kakao/Naver signin redirect와 state cookie 일치를 확인한다.
  - session cookie의 `HttpOnly`, `SameSite=Lax`, `Secure` 속성을 확인한다.
  - credentials 로그인 후 `/api/auth/session` shape와 admin API 접근을 확인한다.
  - signout 후 session clearing을 확인한다.
- 개선 효과:
  - OAuth와 credentials auth의 기본 contract 회귀를 remote smoke에서 더 빨리 잡을 수 있다.

### DB timeout 안정화
- 이전:
  - DB timeout race 후 실제 query가 백그라운드에서 계속될 수 있고, Worker response timeout과 DB query timeout 기준이 분리되어 있었다.
- 이후:
  - Worker와 서버/스크립트 DB client에 같은 timeout baseline을 적용했다.
  - `connect_timeout=5s`, `statement_timeout=4500ms`, `lock_timeout=2000ms`, `idle_in_transaction_session_timeout=5000ms` 기준을 추가했다.
- 측정/검증:
  - `pg_sleep(10)` 기반 local DB timeout smoke에서 약 4538ms에 query 실패 확인.
- 개선 효과:
  - 느린 DB query가 Worker 응답 지연이나 mock fallback으로 가려질 가능성을 줄였다.

### Security headers
- 이전:
  - Worker-generated response와 Cloudflare Assets response의 browser security baseline이 명확히 고정되어 있지 않았다.
- 이후:
  - Worker middleware와 `public/_headers`에 보안 헤더를 추가했다.
  - CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS를 적용했다.
- 개선 효과:
  - SPA HTML, API JSON, Worker-generated static response의 보안 baseline이 고정됐다.
  - clickjacking, content sniffing, referrer leak 같은 기본 브라우저 보안 리스크를 줄였다.

### Observability/Health
- 이전:
  - DB 장애, Supabase pause, OAuth 설정, static asset 문제를 한 번에 확인하는 endpoint가 부족했다.
- 이후:
  - `/api/health`와 `/api/health?deep=1`을 추가했다.
  - deep health가 runtime, public config, auth providers, DB `select 1`, static assets를 확인한다.
  - remote smoke 시작 시 deep health를 먼저 확인한다.
- 개선 효과:
  - 장애 발생 시 Cloudflare/Supabase/OAuth/static 중 어디가 문제인지 빠르게 좁힐 수 있다.

### Map API 성능 대비
- 이전:
  - 1,000개 seed 기준에서는 충분해도 장소 수 증가 시 bbox query와 clustering 비용이 커질 수 있었다.
- 이후:
  - `places_status_lat_lng_idx`를 추가했다.
  - `places_status_category_lat_lng_idx`를 추가했다.
  - `scripts/measure-map-api.mjs`와 `npm run map:measure`를 추가했다.
  - 1k/10k/100k P95 목표를 문서화했다.
- 측정:
  - `seoul-viewport-z11`: count 502, p95 4ms
  - `seoul-category-food-z13`: count 140, p95 5ms
  - `global-query-kimbap`: count 55, p95 34ms
- 개선 효과:
  - viewport/category 지도 조회는 현재 seed 기준 매우 빠른 상태다.
  - 데이터 증가 후에도 같은 스크립트로 성능 악화를 측정할 수 있다.

### 큰 파일 리팩터링 준비
- 이전:
  - `src/worker/index.ts`, `MapRoute.tsx`, `naver-map-panel.tsx`, `admin-repository.ts`가 커서 AI agent 작업 시 회귀 위험이 높았다.
- 이후:
  - `docs/refactoring-large-files.md`를 추가했다.
  - Worker route, admin repository, map route, Naver map panel 분리 순서와 보호 테스트를 문서화했다.
- 현재 hotspot:
  - `src/worker/index.ts`: 3,000 lines
  - `src/client/routes/MapRoute.tsx`: 1,689 lines
  - `src/features/map/naver-map-panel.tsx`: 1,632 lines
  - `src/worker/admin-repository.ts`: 1,146 lines
- 개선 효과:
  - 바로 대규모 리팩터링을 시작하지 않고, 회귀 방지 테스트를 기준으로 후속 분리 순서를 고정했다.

## 배포 및 검증 결과
- 운영 DB migration:
  - `npm run db:migrate` 통과
- 운영 Worker 배포:
  - `npx wrangler deploy --config dist/altteulmap/wrangler.json --name altteulmap` 통과
  - Version ID: `68eb066e-3fcc-4993-ba9d-7343b4711bc8`
- remote smoke:
  - public smoke 통과
  - 관리자 credentials 포함 smoke 통과
  - deep health, home, robots, sitemap, public config, map API, place page/API, login, admin route, admin API boundary, Kakao/Naver provider redirect, credentials/admin smoke 확인
- 로컬 검증:
  - `npm run typecheck` 통과
  - `npm run lint` 통과
  - `npm run cf:build:vite` 통과
  - `npm run deploy:check:vite` 통과
  - `npm run smoke:vite:local` 통과
  - `git diff --check` 통과

## 개선 정도 요약
| 영역 | 이전 상태 | 이후 상태 | 개선 정도 |
| --- | --- | --- | --- |
| 운영 DB 장애 | mock fallback으로 정상처럼 보일 수 있음 | 503/degraded + database source smoke | 핵심 운영 리스크 제거 |
| Public/admin write | partial write 가능성 | 주요 mutation transaction 적용 | 데이터 정합성 강화 |
| 익명 rate limit | isolate memory 기준 | Postgres persistent bucket 기준 | edge/cold start 우회 난이도 상승 |
| DB timeout | Worker timeout과 query timeout 분리 | statement/lock/connect timeout baseline | 느린 query 통제 강화 |
| 배포 설정 | Dashboard path mismatch 가능 | canonical/legacy output 검증 | latest build failed 혼선 감소 |
| OAuth smoke | redirect 중심 | state/cookie/session/admin boundary 확인 | 인증 회귀 탐지 강화 |
| 보안 헤더 | 명시 baseline 부족 | CSP/HSTS/frame/nosniff 등 적용 | 브라우저 보안 baseline 확보 |
| 관측성 | 분산 확인 필요 | `/api/health?deep=1` 통합 확인 | 장애 원인 파악 속도 개선 |
| 지도 API | 성장 대비 측정 부족 | bbox index + p95 측정 스크립트 | 성능 추적 가능 |

## 남은 후속 과제
- 가격 제보 동시 승인에 대한 DB-level row lock 또는 idempotency constraint.
- Turnstile 도입으로 bot proof 강화.
- Supabase 직접 연결 timeout/connection churn이 반복될 경우 Hyperdrive 도입.
- Sentry 또는 Cloudflare Logs/Logpush 기반 실제 알림.
- Naver marker/React inline style 구조 개선 후 strict CSP로 전환.
- global keyword search가 커질 경우 `pg_trgm` 또는 full-text search index 도입.
- `docs/refactoring-large-files.md` 기준으로 큰 파일 분리 리팩터링.

## 결론
- 오늘 작업으로 “운영 DB가 죽었는데 정상처럼 보이는 문제”, “쓰기 중간 실패로 데이터가 꼬이는 문제”, “익명 쓰기 abuse를 edge memory에만 의존하는 문제”, “배포 상태가 Dashboard와 실제 운영에서 어긋나는 문제”를 크게 줄였다.
- 운영 배포와 smoke까지 완료했으므로 현재 운영 사이트는 오늘 하드닝 변경이 적용된 상태다.
- 남은 작업은 긴급 장애성 리스크보다는 보안/운영 성숙도와 유지보수성 개선에 가깝다.
