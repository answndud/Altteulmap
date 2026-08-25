# PLAN.md

## Goal

실제 사용자 증가를 전제로 애플리케이션을 10점 수준으로 끌어올린다. 운영 환경 계약·복구·알림을 증명하고, 대규모 조회·동시성·브라우저 호환성·유지보수성의 수치와 회귀 테스트를 확보해 `READY` 승인 근거를 만든다.

## Active

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
