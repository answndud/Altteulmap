# PLAN.md

## Goal

모바일 환경·모바일 브라우저·모바일 접근성은 제품 품질 목표에서 제외하고, 데스크톱 웹과 서버 운영 품질에 집중한다. 실제 운영 증거, 대규모 PostgreSQL 성능, 복구·알림·배포 안전성을 확보해 현재 `READY WITH RISKS`를 근거 기반 `READY`에 가깝게 끌어올린다.

## Active

### P1 - 운영 승인 조건 확정

1. P1.1 - staging OAuth·credentials·권한 smoke를 실제 계정으로 실행한다.
   - 파일: `scripts/smoke-remote.mjs`, `scripts/qa-production-admin-flows.ts`, `.github/workflows/ci.yml`, `docs/09-운영-가이드/배포-절차.md`
   - 변경: Kakao/Naver sandbox authorization-code·PKCE 성공 callback, state mismatch, code 재사용, provider error, 미검증 email, credentials CSRF, 일반 사용자 관리자 API 403, 관리자 role 강등, signout을 실제 HTTP 흐름으로 실행한다. `SMOKE_*` secret을 CI에 등록하고 로그에는 token/password/cookie/PII를 출력하지 않는다.
   - 검증: `SMOKE_REQUIRE_ADMIN=true SMOKE_REQUIRE_USER=true npm run smoke:remote`, CI scheduled/manual remote-smoke artifact 확인
   - 완료: 관리자·일반 사용자·OAuth provider별 성공/거부 결과와 requestId가 artifact에 있고, 미실행은 실패/보류로 명시되며 모두 통과해야 배포 승인을 진행한다.

2. P1.2 - backup/PITR 복구와 rollback rehearsal을 측정한다.
   - 파일: `scripts/backup-restore-rehearsal.mjs`, `scripts/migrate-production.mjs`, `docs/09-운영-가이드/백업-복구.md`, `docs/09-운영-가이드/롤백.md`
   - 변경: 공급자 backup/PITR 시점, 암호화·보존, staging clone restore, migration 전후 schema, 핵심 row count/checksum/invariant, 이전 Worker 호환성, 복구 후 read-only smoke를 기록한다. source/target 동일 DB·명시적 승인 없는 destructive restore는 계속 거부한다.
   - 검증: `BACKUP_REHEARSAL_CONFIRM=I_UNDERSTAND_RESTORE_REHEARSAL npm run db:rehearse:backup`, 별도 restore DB의 `npm run db:check:contract`, `npm run smoke:remote`
   - 완료: `evidence.json`에 RPO·RTO·backup hash·복구 시각·무결성 결과가 있고, 운영 승인자가 rollback/forward-fix 결정을 재현할 수 있다.

3. P1.3 - telemetry를 실제 로그 수집·알림 채널과 연결한다.
   - 파일: `src/worker/http/errors.ts`, `src/worker/routes/telemetry.ts`, `scripts/check-telemetry-alerts.mjs`, `docs/09-운영-가이드/장애-대응.md`
   - 변경: Cloudflare Logpush 또는 Sentry에 `requestId`, path, status, durationMs, DB/OAuth/telemetry failure event를 전달하고 5xx·p95·429·OAuth 실패 threshold, deduplication, 담당자, runbook 링크를 설정한다. synthetic 5xx/timeout을 발생시켜 알림 전달과 중복 억제를 확인한다.
   - 검증: `npm run ops:check-alerts -- worker-logs.jsonl`, staging synthetic failure, 알림 수신 확인
   - 완료: API 응답→구조화 로그→집계→알림→runbook이 하나의 requestId로 추적되고, 운영자와 담당자가 정해진 시간 안에 알림을 받는다.

### P2 - 성장 규모와 데이터 생명주기 증명

5. P2.1 - 10만·100만 staging dataset 성능 예산을 측정한다.
   - 파일: `scripts/measure-search-benchmark.mjs`, `scripts/measure-map-api.mjs`, `scripts/analyze-global-search-query.mjs`, `docs/09-운영-가이드/성능-예산.md`
   - 변경: production 데이터를 복제하지 않고 익명 synthetic staging DB에 10만/100만 fixture를 생성해 지도 bbox·global search·category·admin queue를 반복 측정한다. p50/p95/p99, DB execution/planning time, rows read, shared blocks, payload, timeout, connection 사용량을 비교하고 FTS/trigram 선택 근거를 기록한다.
   - 검증: `BENCHMARK_DATABASE_URL="$STAGING_DATABASE_URL" BENCHMARK_ITERATIONS=20 npm run search:benchmark`, `MAP_MEASURE_URL="$STAGING_URL" npm run map:measure`, `SEARCH_ANALYZE_EXECUTE=1 npm run search:analyze`
   - 완료: 각 규모의 p95/p99·rows-read 예산이 통과하거나, 초과 시 bounded API response·인덱스·쿼리 개선과 운영 alert가 함께 반영된다.

6. P2.2 - 가격·장소·관리자 mutation의 실패 경계를 확장 검증한다.
   - 파일: `tests/integration/price-lifecycle.test.ts`, `tests/integration/authorization.test.ts`, `src/worker/admin/*`, `src/worker/places-write-*.ts`, `docs/audits/reliability-audit-2026-08-25.md`
   - 변경: duplicate request, concurrent approve/reject, unique conflict, deadlock/serialization failure, transaction rollback, process restart 전후 commit, admin merge/import 중단과 audit 보존을 검증한다. 작업별 재시도 가능 여부를 명시하고 unsafe operation에는 자동 retry를 추가하지 않는다.
   - 검증: `npm run test:integration`, `npm run smoke:price-concurrency`, PostgreSQL 장애 주입 test, rollback 후 row-count·audit invariant 확인
   - 완료: 모든 성공 응답이 commit 이후에만 발생하고, 실패·재시작·경쟁 요청에서 partial write·중복 audit·summary 불일치가 없다.

7. P2.3 - migration과 자원 제한을 release gate로 고정한다.
   - 파일: `.github/workflows/ci.yml`, `scripts/check-database-contract.mjs`, `scripts/migrate-production.mjs`, `drizzle/*.sql`, `docs/09-운영-가이드/배포-절차.md`
   - 변경: fresh DB·기존 데이터·migration replay·schema drift·expand/contract 호환성, foreign key/unique/check constraint, statement/lock/body/worker/connection limit을 CI에서 검사한다. migration 실패 시 앱 배포 중단과 forward-fix 절차를 artifact에 남긴다.
   - 검증: `npm run db:local:setup`, `npm run db:check:contract`, `ALLOW_LOCAL_MIGRATION=1 npm run db:migrate`, `npm run migration:contract`, CI 전체 workflow
   - 완료: schema drift·무제한 query·oversized body·connection exhaustion이 merge 전에 실패하고 이전/이후 앱 호환성이 증명된다.

### P3 - 데스크톱 품질과 장기 유지보수 마감

8. P3.1 - 데스크톱 핵심 오류·접근성·성능 여정을 유지한다.
   - 파일: `tests/e2e/accessibility.spec.ts`, `tests/e2e/comments.spec.ts`, `tests/e2e/submission-admin.spec.ts`, `tests/e2e/performance.spec.ts`
   - 변경: desktop Chromium 기준 401/403/422/429/500/503, 네트워크 단절, stale response, 중복 submit, 입력 보존, 키보드 focus와 screen reader semantics를 검증한다. 모바일/iOS 테스트와 모바일 전용 요구사항은 범위에서 제외한다.
   - 검증: `npm run test:e2e:all:ci`, `npm run test:e2e:performance:ci`, `npm run test:e2e:smoke:ci`
   - 완료: desktop 핵심 여정이 장애 후에도 복구 가능하고, 실패 메시지가 접근 가능한 상태 알림으로 전달된다.

9. P3.2 - dead code·dependency·중복 abstraction을 증거 기반으로 정리한다.
   - 파일: `package.json`, `package-lock.json`, `knip.json`, `src/worker/*`, `src/client/*`, `docs/audits/dependency-cleanup-2026-08-25.md`
   - 변경: import·entrypoint·routing·framework convention·build-time 사용을 확인한 뒤 실제 미사용 파일·타입·endpoint·dependency만 제거한다. 사용 중인 mock/production 경계와 단일-use abstraction은 삭제하지 않고 유지 비용을 문서화한다.
   - 검증: `npm run hygiene:dead-code`, `npm audit --omit=dev --audit-level=moderate`, `npm ci`, `npm run verify`, `npm run build`, `git diff --check`
   - 완료: 삭제 전 call site 검토 기록이 있고 Knip/audit/build/test가 통과하며 bundle·runtime dependency 변화가 설명 가능하다.

10. P3.3 - 최종 readiness 판정과 운영 문서를 동기화한다.
   - 파일: `docs/audits/production-readiness-review-2026-08-25.md`, `docs/audits/principal-engineer-final-review-2026-08-25.md`, `docs/audits/test-strategy-audit-2026-08-25.md`, `README.md`
   - 변경: P1~P3 artifact 링크, 실제 실행/미실행 조건, 점수 산식, BLOCKER/HIGH/MEDIUM/LOW 잔여 위험, rollback·backup·alert owner를 한국어로 갱신한다. 모바일 관련 점수·잔여 위험·목표는 보고서에서 제거한다.
   - 검증: `npm run verify`, `npm run test:integration`, `npm run test:e2e:all:ci`, `npm audit --omit=dev --audit-level=moderate`, 문서 내 모바일 잔여 항목 검색
   - 완료: 코드·CI·운영 증거와 문서가 일치하고, 외부 증거가 없으면 `READY WITH RISKS`로 남긴다.

## Backlog

- 이메일 provider sandbox의 bounce·재전송 멱등성 검증
- 장소 merge 대량 데이터 이전·중단 복구 정책
- 24시간 soak test와 다중 Worker 장애 주입
- Hyperdrive 도입 여부를 connection latency·동시 연결 지표로 재평가
