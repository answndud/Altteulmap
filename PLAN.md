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

### P3 - CI·배포·복구 승인 자동화

2. P3.1 - CI PostgreSQL service와 단계별 게이트 구성
   - 파일: `.github/workflows/ci.yml`, `package.json`, `playwright.config.ts`, `scripts/run-local-e2e.mjs`
   - 변경: CI service health 후 `db:migrate`·seed·integration·concurrency·E2E·performance 순서를 보장한다. drift 검사, timeout, DB/Worker/Playwright artifact, secret·dump 비포함, 실패 시 배포 차단을 고정한다.
   - 검증: `npm run verify`, `npm run db:local:setup`, `npm run test:integration`, `npm run test:e2e:all`, `npm run deploy:check`, `git diff --exit-code drizzle src/db/schema.ts`
   - 완료: 깨끗한 runner의 실제 PostgreSQL 전체 흐름과 실패 차단이 재현된다.

3. P3.2 - 배포 중단·rollback·백업 복구 리허설 추가
   - 파일: `scripts/migrate-production.mjs`, `scripts/check-production-db.mjs`, `docs/ops/backup-restore.md`, `docs/ops/incident-response.md`
   - 변경: migration preflight/post-smoke, staging backup/PITR restore, RPO/RTO, deployment interruption·Worker restart·DB reset 후 invariant를 실행 가능한 절차로 고정한다. destructive down migration 대신 forward-fix/restore 기준을 명시한다.
   - 검증: `npm run db:check:production`, staging restore/rehearsal, `npm run smoke:remote`, `git diff --check`
   - 완료: 복구 지점·시간·정합성·서비스 smoke가 기록되고 migration 실패가 승인되지 않는다.

4. P3.3 - 성능·관측·최종 readiness 증거 고정
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
