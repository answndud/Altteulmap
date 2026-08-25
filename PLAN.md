# PLAN.md

## Goal

실제 사용자 증가를 전제로 애플리케이션을 10점 수준으로 끌어올린다. 운영 환경 계약·복구·알림을 증명하고, 대규모 조회·동시성·브라우저 호환성·유지보수성의 수치와 회귀 테스트를 확보해 `READY` 승인 근거를 만든다.

## Active

### P2 - 성장·동시성·데이터 정합성 증명

4. P2.1 - 검색·관리자 조회의 규모별 성능 예산을 고정한다.
   - 파일: `scripts/measure-map-api.mjs`, `scripts/analyze-global-search-query.mjs`, `scripts/measure-search-benchmark.mjs`, `src/worker/places-read-map-repository.ts`, `src/worker/admin-repository.ts`, `docs/09-운영-가이드/성능-예산.md`
   - 변경: 1만/10만/100만 장소 fixture를 재현하고 bbox·검색어·카테고리·관리자 큐의 p50/p95/p99, rows read, response size, DB time, timeout 비율을 측정한다. FTS/trigram 선택 근거와 query timeout·pagination·result cap을 수치로 고정한다.
   - 검증: `npm run search:analyze`, `npm run map:measure`, benchmark의 `--dataset-size 10000 --dataset-size 100000`, `EXPLAIN (ANALYZE, BUFFERS)` 비교
   - 완료: 핵심 조회가 p95/p99 예산을 만족하고 초과 시 429/400/503 중 올바른 bounded response와 operator signal을 낸다.

5. P2.2 - 모든 mutation의 중복·동시 실행·재시작 안전성을 회귀 테스트로 고정한다.
   - 파일: `src/worker/places-write-submissions-repository.ts`, `src/worker/places-write-price-reports-repository.ts`, `src/worker/bookmarks-repository.ts`, `src/worker/admin/admin-price-review-repository.ts`, `tests/integration/*`, `scripts/smoke-price-report-concurrency.ts`
   - 변경: 같은 요청 재전송, 동일 unique key 경쟁, 가격 검증 count 경쟁, bookmark toggle 경쟁, admin merge/review 동시 실행, deadlock·serialization failure·process restart 중 commit 경계를 검증한다. 재시도 가능한 작업과 안전하지 않은 작업을 분리하고 idempotency key 또는 unique constraint 기반으로만 중복을 제거한다.
   - 검증: `npm run test:integration`, `npm run smoke:price-concurrency`, PostgreSQL isolation/deadlock regression test, 실패 주입 후 row-count·audit invariant 확인
   - 완료: 성공 응답은 실제 commit 이후에만 반환되고, 중복 요청은 데이터 1회 반영, 경쟁 요청은 명확한 결과와 rollback을 보장한다.

6. P2.3 - migration·제약·자원 한도를 CI gate로 강화한다.
   - 파일: `.github/workflows/ci.yml`, `drizzle/*.sql`, `scripts/check-production-db.mjs`, `docker-compose.yml`, `docs/09-운영-가이드/배포-절차.md`
   - 변경: 빈 DB·기존 데이터 migration, forward-only/rollback 판정, foreign key·unique·check constraint, connection pool·statement timeout·body limit·worker duration을 CI에서 검증한다. migration 중 앱 배포 중단에도 안전한 expand/contract 순서를 강제한다.
   - 검증: `npm run db:local:setup`, `npm run test:integration`, `npm run build`, CI workflow 및 migration contract 비교
   - 완료: 깨진 schema·무제한 query·oversized body·connection exhaustion이 merge 전에 실패하고 호환 가능한 이전/이후 앱 버전이 문서화된다.

### P3 - 유지보수성과 사용자 품질의 마지막 결함 제거

7. P3.1 - 인증·권한·소유권 matrix와 고가치 API 계약을 단일 테스트로 유지한다.
   - 파일: `src/worker/auth/session.ts`, `src/worker/routes/admin.ts`, `src/worker/routes/bookmarks.ts`, `src/worker/routes/public-write.ts`, `tests/integration/authorization.test.ts`, `tests/e2e/*`
   - 변경: authentication과 authorization/resource ownership을 별도 assertion으로 분리한다. 익명·일반·관리자·다른 사용자·숨김 리소스 조합의 read/create/update/delete matrix를 고정하고 IDOR/BOLA, role 강등, soft-delete 누출을 회귀 테스트한다.
   - 검증: `npm run test:integration && npm run test:e2e:full:ci`, 다른 actor가 교차 요청하는 API contract test
   - 완료: 허용되지 않은 actor는 리소스 존재 여부와 무관하게 일관된 응답을 받고, owner/admin만 의도된 변경을 수행한다.

8. P3.2 - 브라우저 장애와 접근성·모바일 핵심 여정을 검증한다.
   - 파일: `tests/e2e/accessibility.spec.ts`, `tests/e2e/map.mobile.spec.ts`, `tests/e2e/comments.spec.ts`, `src/client/routes/MapRoute.tsx`, `src/client/routes/SubmitRoute.tsx`, `src/client/components/*`
   - 변경: 모바일 Safari 대체 검증, 네트워크 단절·429·401/403·422·500·stale response에서 오류 안내·입력 보존·중복 제출 방지·재시도 UX를 검증한다. 키보드 focus, screen reader label, 44px target, 지도 대체 목록과 overflow를 점검한다.
   - 검증: `npm run test:e2e:full:ci`, `npm run test:e2e:performance:ci`, Playwright network interception, axe artifact
   - 완료: 핵심 여정이 실패해도 입력과 현재 상태를 잃지 않고 모바일·키보드·스크린리더에서 완료 가능하다.

9. P3.3 - 중복 추상화·의존성·문서 계약을 정리하고 최종 평가를 갱신한다.
   - 파일: `package.json`, `package-lock.json`, `knip.json`, `src/worker/*`, `src/client/*`, `docs/audits/production-readiness-review-2026-08-25.md`, `README.md`
   - 변경: import·runtime convention·routing/config/build-time 사용을 확인한 뒤 dead code, 중복 API helper, single-use wrapper, unused dependency만 제거한다. dependency는 사용 근거·runtime/dev 분류·transitive risk를 기록하고 불필요한 패키지만 삭제한다. 모든 감사·운영 문서를 한국어로 일치시킨다.
   - 검증: `npm run verify`, `npm run verify:quality`, `npm audit --omit=dev --audit-level=moderate`, `npm run build`, `npm run test:e2e:all:ci`, `git diff --check`
   - 완료: lint/typecheck/unit/integration/e2e/build/dependency/hygiene가 통과하고 최종 문서가 각 10점의 수치 근거·외부 증거·잔여 위험을 정확히 반영한다.

## Backlog

- 이메일 provider sandbox의 bounce·재전송 멱등성 계약과 실제 운영 검증
- PostgreSQL connection latency·동시 연결 지표에 따른 Hyperdrive 도입 재평가
- 장소 merge mutation의 대량 데이터 이전·중단 복구 정책
- 실제 iOS Safari·스크린리더 기기와 저사양 네트워크 매트릭스 확대
- 24시간 soak test와 장애 주입을 포함한 운영 부하 리허설
