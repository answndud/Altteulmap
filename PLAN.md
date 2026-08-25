# PLAN.md

## Goal

운영 DB는 PostgreSQL로 유지하고 Docker PostgreSQL을 로컬·CI의 재현 가능한 기본 환경으로 고정한다. 실제 DB 기준의 정합성·동시성·장애·배포 검증을 완료하고 운영 승인 근거를 남긴다.

## Active

### P0 - 원격 seed 실행 영향 확인

1. P0.1 - 원격 DB 변경 영향과 복구 가능성 확인
   - 파일: `scripts/seed-production.mjs`, `src/db/seed.ts`, `docs/ops/backup-restore.md`, `docs/ops/incident-response.md`
   - 변경: 원격 seed 실행 범위를 read-only query·운영 로그·백업 시점으로 확인하고, backup/PITR 복구 가능성을 검토한다. production URL seed 실행을 local-only guard로 차단하고 영향·복구·재발 방지 내용을 기록한다.
   - 검증: 원격 read-only count/invariant query, backup restore rehearsal, `npm run db:check:production`, `git diff --check`
   - 완료: 영향 범위와 복구 결정이 근거와 함께 기록되고 production URL seed 명령이 사전 차단된다.

### P2 - 실제 PostgreSQL 기반 동작·장애 증명

2. P2.1 - 테스트 DB 격리와 fixture 수명주기 구축
   - 파일: `tests/integration/test-database.ts`, `tests/integration/fixtures.ts`, `tests/integration/README.md`, `package.json`
   - 변경: Docker DB readiness 확인, 테스트 schema 또는 unique fixture prefix, 자기 데이터 정리, connection 종료·leftover 감지를 구현한다. CI는 DB 미기동을 실패로 처리하고 unit-only 실행은 DB를 요구하지 않게 분리한다.
   - 검증: `npm run db:local:setup`, `npm run test:integration`, 동일 테스트 3회 반복, 중간 실패 cleanup 확인, `npm run typecheck`
   - 완료: 반복·병렬 실행 간 fixture 간섭이 없고 실패 후 stale row/open connection이 남지 않는다.

3. P2.2 - 가격 제보·검수의 불변조건과 동시성 회귀 고정
   - 파일: `tests/integration/price-lifecycle.test.ts`, `scripts/smoke-price-report-concurrency.ts`, `src/worker/admin/admin-price-review-repository.ts`, `src/db/schema-pricing.ts`
   - 변경: 승인·반려·중복·price item·place summary·snapshot·admin action 원자성을 검증하고, unique conflict·audit 실패·summary 실패 rollback과 운영자 동시 결정을 주입한다. advisory lock/CAS/isolation/deadlock 계약을 측정하며 자동 retry는 추가하지 않는다.
   - 검증: `npm run db:local:setup`, `npm run smoke:price-concurrency`, `npm run test:integration -- tests/integration/price-lifecycle.test.ts`, 20회 반복, `npm run db:check:production`
   - 완료: 모든 경쟁·실패 후 상태가 하나의 결정으로 수렴하고 orphan item·잘못된 summary·감사 누락이 없다.

4. P2.3 - API 오류·입력 상한·응답 계약을 통합 검증
   - 파일: `tests/integration/api-failure-paths.test.ts`, `tests/unit/http-and-rate-limit.test.ts`, `src/worker/routes/places-read.ts`, `src/worker/http/`
   - 변경: DB unavailable·query timeout·malformed/oversized body·429·외부 timeout을 재현하고 status·stable error code·requestId·Retry-After·no-store·redaction을 검증한다. 지도 2,000행과 관리자 100행 cap 및 count 계약도 실제 SQL로 확인한다.
   - 검증: `npm run test:unit`, `npm run test:integration -- tests/integration/api-failure-paths.test.ts`, `npm run map:measure`, 로그 redaction 검사
   - 완료: 장애가 bounded time에 종료되고 사용자 성공 오인이 없으며 운영자가 requestId로 원인을 추적한다.

### P3 - CI·배포·복구 승인 자동화

5. P3.1 - CI PostgreSQL service와 단계별 게이트 구성
   - 파일: `.github/workflows/ci.yml`, `package.json`, `playwright.config.ts`, `scripts/run-local-e2e.mjs`
   - 변경: CI service health 후 `db:migrate`·seed·integration·concurrency·E2E·performance 순서를 보장한다. drift 검사, timeout, DB/Worker/Playwright artifact, secret·dump 비포함, 실패 시 배포 차단을 고정한다.
   - 검증: `npm run verify`, `npm run db:local:setup`, `npm run test:integration`, `npm run test:e2e:all`, `npm run deploy:check`, `git diff --exit-code drizzle src/db/schema.ts`
   - 완료: 깨끗한 runner의 실제 PostgreSQL 전체 흐름과 실패 차단이 재현된다.

6. P3.2 - 배포 중단·rollback·백업 복구 리허설 추가
   - 파일: `scripts/migrate-production.mjs`, `scripts/check-production-db.mjs`, `docs/ops/backup-restore.md`, `docs/ops/incident-response.md`
   - 변경: migration preflight/post-smoke, staging backup/PITR restore, RPO/RTO, deployment interruption·Worker restart·DB reset 후 invariant를 실행 가능한 절차로 고정한다. destructive down migration 대신 forward-fix/restore 기준을 명시한다.
   - 검증: `npm run db:check:production`, staging restore/rehearsal, `npm run smoke:remote`, `git diff --check`
   - 완료: 복구 지점·시간·정합성·서비스 smoke가 기록되고 migration 실패가 승인되지 않는다.

7. P3.3 - 성능·관측·최종 readiness 증거 고정
   - 파일: `scripts/measure-map-api.mjs`, `tests/e2e/performance.spec.ts`, `docs/audits/production-readiness-review-2026-08-25.md`, `docs/ops/incident-response.md`
   - 변경: global/wide bbox/category/관리자 queue p50·p95·p99, rows·bytes·connection·timeout을 1천/1만/10만 dataset에서 측정한다. alert threshold·owner·runbook·requestId·redaction과 readiness BLOCKER/HIGH/MEDIUM/LOW를 갱신한다.
   - 검증: `npm run map:measure`, `npm run perf:client`, `npm run test:e2e:performance`, `npm run build`, `npm audit --omit=dev --audit-level=moderate`, `git diff --check`
   - 완료: 수치 예산·알림·복구 증거가 CI artifact/문서로 남고 READY 또는 READY WITH RISKS 판단을 재현할 수 있다.

## Backlog

- 실제 provider OAuth/PKCE sandbox와 이메일 발송 장애를 staging 계약 테스트에 연결
- PostgreSQL connection latency·동시 연결 지표 수집 후 Hyperdrive 도입 여부 재평가
- 장소 merge mutation의 데이터 이전·rollback 정책 확정 후 구현
- global search pg_trgm/전문 검색 도입 여부를 synthetic benchmark 후 결정
- 실제 iOS·스크린리더 호환성 매트릭스 재평가
