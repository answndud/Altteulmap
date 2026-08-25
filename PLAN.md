# PLAN.md

## Goal

Principal Engineer 평가의 6.7/10을 10점 수준으로 끌어올린다. 가격 데이터 생명주기 정합성, 성장 시 성능, 실제 브라우저·접근성 검증이 자동화되고 배포 승인 기준에 기록된 상태를 완료 조건으로 한다.

## Active

### P1 - 데이터 생명주기와 성장 경계 고정

4. P2.1 - 가격 제보·항목·장소 요약 불변조건을 통합 테스트로 고정
   - 파일: `src/worker/admin/admin-price-review-repository.ts`, `src/worker/admin-places-repository.ts`, `tests/integration/price-lifecycle.test.ts`, `drizzle/`
   - 변경: 승인·반려·중복·동시 승인·트랜잭션 rollback에서 report/item/summary/status/audit가 함께 일관되는지 실제 PostgreSQL로 검증하고 새 상태 전이는 하나의 도메인 경로로 제한한다.
   - 검증: `npm run db:up`, `ALLOW_LOCAL_MIGRATION=1 npm run db:migrate`, `npm run smoke:price-concurrency`, `node --import tsx --test tests/integration/price-lifecycle.test.ts`, `npm run db:down`
   - 완료: 동일 actor 중복은 검증 수를 늘리지 않고, 동시 운영자 결정은 하나만 성공하며 실패 transaction은 부분 데이터를 남기지 않는다.

5. P2.2 - 지도 검색·관리자 큐의 DB 작업량 상한과 페이지네이션 적용
   - 파일: `src/worker/places-read-map-repository.ts`, `src/worker/routes/places-read.ts`, `src/worker/admin-places-repository.ts`, `src/worker/admin/admin-price-read-repository.ts`
   - 변경: 검색어·bbox·zoom 계약을 DB query에 반영하고 FTS/trigram 또는 검증된 인덱스 전략, 결과 cursor/page cap, 관리자 queue page limit을 추가한다.
   - 검증: `npm run search:analyze`, `npm run map:measure`, `npm run places:duplicates`, `npm run test:e2e:performance`, 1만/10만 synthetic dataset p95·rows-read 측정
   - 완료: global/wide bbox 요청이 고정된 rows·메모리·시간 상한 안에서 종료되고 관리자 목록이 전체 row를 읽지 않는다.

### P2 - 사용자 표면과 장기 유지보수 완성

6. P3.1 - 실제 브라우저·접근성·외부 SDK 장애 매트릭스 CI화
   - 파일: `tests/e2e/accessibility.spec.ts`, `tests/e2e/map.mobile.spec.ts`, `tests/e2e/map.spec.ts`, `.github/workflows/ci.yml`
   - 변경: iOS/Chromium 핵심 흐름, 위치 권한 거부, 지도 SDK timeout/fallback, 키보드·screen reader 이름·포커스·오류 상태를 deterministic fixture로 검증한다.
   - 검증: `npm run test:e2e:all`, `npx playwright test tests/e2e/accessibility.spec.ts tests/e2e/map.mobile.spec.ts --project mobile-chromium`
   - 완료: 모바일 핵심 여정과 장애 대체 흐름이 CI에서 임의 sleep·통제되지 않은 외부 네트워크 없이 재현된다.

7. P3.2 - 관측 가능한 성능 예산과 모듈 경계 정리
   - 파일: `src/client/features/map/`, `tests/e2e/performance.spec.ts`, `scripts/measure-map-api.mjs`, `docs/audits/principal-engineer-final-review-2026-08-25.md`
   - 변경: 지도 초기 로딩·검색 p95, client chunk, DB rows/read·connection 예산을 측정하고 예산을 넘는 지도 훅·청크만 통합 또는 동적 로딩한다.
   - 검증: `npm run perf:client`, `npm run map:measure`, `npm run build`, `npm run test:e2e:performance`
   - 완료: 성능 예산이 수치로 기록되고 지도 구조 변경은 측정 전후 지표와 함께 승인된다.

## Backlog

- Hyperdrive 도입 여부를 connection/latency metric으로 재평가
- 실제 provider OAuth/PKCE sandbox 검증을 P1.2 staging gate에서 수행
- 장소 merge mutation은 운영자 승인 UX와 rollback 정책 확정 후 별도 구현
- React Router upstream advisory fix 공개 시 재평가
