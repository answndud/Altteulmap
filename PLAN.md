# PLAN.md

## Goal

모바일 환경·모바일 브라우저·모바일 접근성은 제품 품질 목표에서 제외하고, 데스크톱 웹과 서버 운영 품질에 집중한다. 실제 운영 증거, 대규모 PostgreSQL 성능, 복구·알림·배포 안전성을 확보해 현재 `READY WITH RISKS`를 근거 기반 `READY`에 가깝게 끌어올린다.

## Active

### P2 - 성장 규모와 데이터 생명주기 증명

1. P2.1 - 10만·100만 staging dataset 성능 예산을 측정한다.
   - 파일: `scripts/measure-search-benchmark.mjs`, `scripts/measure-map-api.mjs`, `scripts/analyze-global-search-query.mjs`, `docs/09-운영-가이드/성능-예산.md`
   - 변경: production 데이터를 복제하지 않고 익명 synthetic staging DB에 10만/100만 fixture를 생성해 지도 bbox·global search·category·admin queue를 반복 측정한다. p50/p95/p99, DB execution/planning time, rows read, shared blocks, payload, timeout, connection 사용량을 비교하고 FTS/trigram 선택 근거를 기록한다.
   - 검증: `BENCHMARK_DATABASE_URL="$STAGING_DATABASE_URL" BENCHMARK_ITERATIONS=20 npm run search:benchmark`, `MAP_MEASURE_URL="$STAGING_URL" npm run map:measure`, `SEARCH_ANALYZE_EXECUTE=1 npm run search:analyze`
   - 완료: 10만 규모는 p95/p99·rows-read·payload 예산을 통과했다. 100만 규모는 Docker PostgreSQL 저장소 부족으로 중단되어 실제 증거가 생성될 때까지 이 slice를 완료로 처리하지 않는다.

### P3 - 데스크톱 품질과 장기 유지보수 마감

2. P3.1 - 데스크톱 핵심 오류·접근성·성능 여정을 유지한다.
   - 파일: `tests/e2e/accessibility.spec.ts`, `tests/e2e/comments.spec.ts`, `tests/e2e/submission-admin.spec.ts`, `tests/e2e/performance.spec.ts`
   - 변경: desktop Chromium 기준 401/403/422/429/500/503, 네트워크 단절, stale response, 중복 submit, 입력 보존, 키보드 focus와 screen reader semantics를 검증한다. 모바일/iOS 테스트와 모바일 전용 요구사항은 범위에서 제외한다.
   - 검증: `npm run test:e2e:all:ci`, `npm run test:e2e:performance:ci`, `npm run test:e2e:smoke:ci`
   - 완료: desktop 핵심 여정이 장애 후에도 복구 가능하고, 실패 메시지가 접근 가능한 상태 알림으로 전달된다.

3. P3.2 - dead code·dependency·중복 abstraction을 증거 기반으로 정리한다.
   - 파일: `package.json`, `package-lock.json`, `knip.json`, `src/worker/*`, `src/client/*`, `docs/audits/dependency-cleanup-2026-08-25.md`
   - 변경: import·entrypoint·routing·framework convention·build-time 사용을 확인한 뒤 실제 미사용 파일·타입·endpoint·dependency만 제거한다. 사용 중인 mock/production 경계와 단일-use abstraction은 삭제하지 않고 유지 비용을 문서화한다.
   - 검증: `npm run hygiene:dead-code`, `npm audit --omit=dev --audit-level=moderate`, `npm ci`, `npm run verify`, `npm run build`, `git diff --check`
   - 완료: 삭제 전 call site 검토 기록이 있고 Knip/audit/build/test가 통과하며 bundle·runtime dependency 변화가 설명 가능하다.

4. P3.3 - 최종 readiness 판정과 운영 문서를 동기화한다.
   - 파일: `docs/audits/production-readiness-review-2026-08-25.md`, `docs/audits/principal-engineer-final-review-2026-08-25.md`, `docs/audits/test-strategy-audit-2026-08-25.md`, `README.md`
   - 변경: P1~P3 artifact 링크, 실제 실행/미실행 조건, 점수 산식, BLOCKER/HIGH/MEDIUM/LOW 잔여 위험, rollback·backup·alert owner를 한국어로 갱신한다. 모바일 관련 점수·잔여 위험·목표는 보고서에서 제거한다.
   - 검증: `npm run verify`, `npm run test:integration`, `npm run test:e2e:all:ci`, `npm audit --omit=dev --audit-level=moderate`, 문서 내 모바일 잔여 항목 검색
   - 완료: 코드·CI·운영 증거와 문서가 일치하고, 외부 증거가 없으면 `READY WITH RISKS`로 남긴다.

## Backlog

- staging OAuth 성공 callback, 실제 backup/PITR 복구, Cloudflare 알림 수신 증적 확보
- 이메일 provider sandbox의 bounce·재전송 멱등성 검증
- 장소 merge 대량 데이터 이전·중단 복구 정책
- 24시간 soak test와 다중 Worker 장애 주입
- Hyperdrive 도입 여부를 connection latency·동시 연결 지표로 재평가
