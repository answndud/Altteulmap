# PLAN.md

## Active 작업

### 작업명
운영 하드닝 후속 과제 계획

### 배경
- `docs/project/production-hardening-report-2026-05-08.md`의 남은 후속 과제를 실행 가능한 순서로 정리한다.
- 오늘 완료한 pre-mortem 하드닝은 운영 배포와 remote smoke까지 완료됐지만, 보안/운영 성숙도와 유지보수성 측면에서 남은 과제가 있다.
- 이번 계획은 모든 후속 과제를 한 번에 구현하겠다는 의미가 아니라, 우선순위와 완료 기준을 고정해 다음 개발 세션에서 바로 이어가기 위한 active 계획이다.

### 목표
- 운영 리스크가 큰 항목부터 작은 단위로 처리한다.
- DB schema/API/auth/deploy 변경이 필요한 작업은 별도 검증과 rollback 기준을 둔다.
- 외부 설정이 필요한 작업은 코드 변경과 dashboard/provider 설정을 분리해 진행한다.
- 큰 파일 분리는 기능 변경이 아니라 회귀 방지 테스트를 먼저 둔 동작 보존형 리팩터링으로 진행한다.

### 범위
- 포함:
  - 가격 제보 동시 승인 DB-level idempotency 강화
  - Turnstile 기반 public write bot 방어 도입 계획 및 적용
  - Supabase 직접 연결 안정성 평가와 Hyperdrive 도입 판단
  - Sentry 또는 Cloudflare Logs/Logpush 기반 운영 알림
  - strict CSP 전환을 위한 inline style/marker 구조 개선 계획
  - global search 성능 악화 대비 `pg_trgm` 또는 full-text index 도입 기준
  - `docs/refactoring-large-files.md` 기준 큰 파일 분리 리팩터링 실행 계획
- 제외:
  - 신규 사용자 기능
  - 지도 UX/디자인 재작업
  - DB destructive migration
  - Next.js 구조 복원
  - Cloudflare Workers 이외의 배포 플랫폼 전환

## 우선순위

### P0. 가격 제보 동시 승인 DB-level idempotency
- 상태: 구현 및 로컬 검증 완료.
- 이유:
  - 현재 transaction은 partial write를 막지만, 같은 가격 제보가 동시에 승인될 때 검증 count/대표 가격이 중복 반영될 가능성은 남아 있다.
- 작업:
  - 현재 `price_reports`, `price_items`, `price_histories`, `admin_actions` 흐름을 다시 추적한다.
  - 동시 승인 재현 테스트 또는 targeted API smoke를 먼저 만든다.
  - `select ... for update`가 필요한지, status 조건부 update가 충분한지 판단한다.
  - 필요한 경우 DB-level unique/index 또는 optimistic guard migration을 추가한다.
  - 이미 처리된 report 재승인은 기존 response shape를 유지하면서 idempotent하게 처리한다.
- 완료 기준:
  - 같은 가격 제보를 동시에 승인해도 대표 가격, verified count, price history, admin action이 중복 반영되지 않는다.
  - 관련 migration이 있다면 운영 적용 순서가 문서화된다.
- 검증:
  - `npm run typecheck`
  - `npm run lint`
  - targeted API concurrency smoke
  - `tests/e2e/price-review.spec.ts`
  - `git diff --check`

### P1. Turnstile public write bot 방어
- 상태: 코드 구현 및 로컬/E2E 검증 완료. 운영 Dashboard site key/secret 설정과 production 수동 QA 필요.
- 이유:
  - DB-backed rate limit은 abuse 방어를 강화하지만 bot proof는 아니다.
  - 장소 등록, 가격 제보, 댓글, 신고는 공개 쓰기 표면이다.
- 작업:
  - 보호 대상 route를 확정한다: 장소 등록, 가격 제보, 댓글, 신고.
  - Cloudflare Turnstile site key/secret 운영 설정 방식을 정리한다.
  - client form에 Turnstile token을 붙이고 Worker에서 token 검증을 수행한다.
  - local/test 환경에서는 명시 mock bypass를 두되 production bypass는 금지한다.
  - token 실패 response와 UX copy를 정리한다.
- 완료 기준:
  - production public write는 Turnstile 검증 없이 성공하지 않는다.
  - local/test에서는 자동화 검증 가능한 안전한 bypass가 있다.
  - 기존 API response shape와 UX flow가 불필요하게 깨지지 않는다.
- 검증:
  - `npm run typecheck`
  - `npm run lint`
  - public write targeted E2E/API smoke
  - `npm run smoke:vite:local`
  - 운영 Turnstile 수동 QA

### P1. 운영 알림과 에러 추적
- 상태: 1차 구현 및 로컬 검증 완료.
- 이유:
  - `/api/health?deep=1`과 remote smoke는 상태 확인 도구지만, 아직 실패를 자동으로 알려주는 경로가 없다.
- 작업:
  - Sentry Free와 Cloudflare Logs/Logpush 중 MVP 운영에 맞는 1차 도입안을 선택한다.
  - Worker error boundary 또는 `app.onError`에서 request id, route, status, error class를 기록한다.
  - smoke 실패 알림은 GitHub Actions schedule 또는 Cloudflare Cron Trigger 중 하나로 계획한다.
  - secret redaction 기준을 문서화한다.
- 완료 기준:
  - 운영 5xx/DB unavailable/auth failure를 최소 하나의 외부 관측 채널에서 확인할 수 있다.
  - 알림이 없더라도 scheduled remote smoke 실패를 확인할 수 있는 자동 루틴이 있다.
- 검증:
  - `npm run typecheck`
  - `npm run lint`
  - forced error local smoke
  - remote smoke scheduled/manual run

### P2. Hyperdrive 도입 판단
- 상태: 도입 보류 판단 및 optional binding 호환 코드 준비 완료.
- 이유:
  - 현재는 Supabase 직접 연결이다. timeout baseline은 생겼지만 connection churn이 반복되면 Hyperdrive가 필요할 수 있다.
- 작업:
  - 현재 운영 DB latency, connection error, timeout 발생 빈도를 Cloudflare logs/smoke 기준으로 본다.
  - Hyperdrive binding 추가 시 env/secret/connection string 영향 범위를 정리한다.
  - PoC Worker 또는 staging-like local config로 Hyperdrive 연결 가능성을 검증한다.
- 완료 기준:
  - 당장 도입/보류 판단 근거가 문서화된다.
  - 도입한다면 rollback 가능한 binding/env 변경 순서가 있다.
- 검증:
  - deep health DB check
  - map API measure
  - admin credentials remote smoke

### P2. Strict CSP 전환 준비
- 상태: inventory 작성 및 단순 inline style 일부 제거 완료. Enforcement 전환은 marker SVG/data URL PoC 이후 진행.
- 이유:
  - 현재 CSP는 React inline style과 Naver marker HTML style 때문에 `style-src 'unsafe-inline'`을 허용한다.
- 작업:
  - inline style 사용처를 inventory로 만든다.
  - Naver marker HTML을 class 기반 또는 precomputed stylesheet 기반으로 바꿀 수 있는지 확인한다.
  - CSP report-only 모드를 먼저 검토한다.
- 완료 기준:
  - `unsafe-inline` 제거 가능 여부와 필요한 코드 변경량이 명확하다.
  - strict CSP 전환이 지도 marker와 OAuth 흐름을 깨지 않는 검증 계획이 있다.
- 검증:
  - browser smoke
  - Naver map live QA
  - CSP violation 확인

### P2. Global search index 기준
- 상태: 도입 보류 판단, query plan 분석 스크립트, pg_trgm 도입 기준 문서화 완료.
- 이유:
  - 현재 global keyword search는 `ILIKE '%query%'` 기반이다.
  - 데이터가 커지면 p95가 목표를 넘을 수 있다.
- 작업:
  - `npm run map:measure` 운영/로컬 측정 결과를 기록한다.
  - `pg_trgm` index와 full-text search 중 MVP에 맞는 방식을 비교한다.
  - 데이터 10k/100k synthetic 또는 query plan 기준으로 도입 시점을 정한다.
- 완료 기준:
  - global search p95 목표 초과 시 적용할 migration 전략이 문서화된다.
  - 아직 필요 없다면 보류 기준도 수치로 남긴다.
- 검증:
  - `npm run map:measure`
  - `EXPLAIN ANALYZE` 또는 synthetic query plan

### P3. 큰 파일 분리 리팩터링
- 상태: Worker Slice 1~11, Map Slice 1~5, Naver Map Slice 1~19 진행 중. HTTP utilities, health/static route, auth, public config/bookmark route, places read route, public write route, admin route, telemetry route, admin reports/prices/places repository, map query helper, place card, category tray, trending section, mobile place list sheet, place detail sheet, naver map display marker helper, local fallback tile helper, naver panel helper, preview map fallback component, naver map error fallback wrapper, naver map marker renderer, naver map key state hook, naver map viewport emitter, naver map geolocation helper, naver map focus helper, naver map container size hook, naver map window resize sync hook, naver map initialization hook, naver map marker rendering hook, naver map runtime error hook, naver map pending action hook, naver map viewport focus hook, naver map cleanup hook, transient map message hook, 모바일 바텀시트 visual viewport 터치 안정화 완료.
- 이유:
  - `src/worker/index.ts`, `src/client/routes/MapRoute.tsx`, `src/features/map/naver-map-panel.tsx`, `src/worker/admin-repository.ts`는 AI agent 작업 시 회귀 위험이 크다.
- 작업:
  - `docs/refactoring-large-files.md` 순서를 따른다.
  - Worker HTTP utilities/health/static route부터 분리한다.
  - auth route, public route, admin route, admin repository, map route, Naver map panel 순으로 작은 slice를 진행한다.
  - 각 slice는 기능 변경 없이 보호 테스트를 통과해야 한다.
  - 리팩터링 검증 중 반복 재현되는 flaky E2E는 해당 slice의 신뢰도를 떨어뜨리므로 원인을 확인해 작은 안정화 패치로 함께 처리한다.
- 완료 기준:
  - 각 큰 파일의 책임이 route/domain/component 단위로 분리된다.
  - 기존 E2E data-testid, API path, auth/session contract가 유지된다.
- 검증:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run smoke:vite:local`
  - targeted E2E specs
  - `npm run deploy:check:vite`
  - `git diff --check`

## 실행 순서 제안
- 먼저 P0 idempotency를 처리한다.
- 그 다음 P1 Turnstile과 운영 알림 중 외부 설정 준비가 쉬운 항목부터 진행한다.
- Hyperdrive, strict CSP, global search index는 수치와 로그를 보고 도입 여부를 판단한다.
- 큰 파일 분리는 위 운영 안정성 과제가 막히거나 완료된 뒤 별도 리팩터링 세션으로 진행한다.

## 전체 완료 기준
- P0/P1 항목은 구현 또는 명확한 보류 사유가 archive된다.
- P2 항목은 수치 기반 도입/보류 판단이 문서화된다.
- P3는 최소 첫 Worker split slice까지 진행하거나 별도 리팩터링 active 계획으로 분리된다.
- 완료 시 `docs/PROGRESS.md`를 `docs/COMPLETED.md`로 archive하고, `docs/PLAN.md`, `docs/PROGRESS.md`는 `현재 active 작업 없음`으로 정리한다.
