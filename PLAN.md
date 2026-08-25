# PLAN.md

## Goal

실제 사용자 증가를 전제로 애플리케이션을 10점 수준으로 끌어올린다. 운영 환경 계약·복구·알림을 증명하고, 대규모 조회·동시성·브라우저 호환성·유지보수성의 수치와 회귀 테스트를 확보해 `READY` 승인 근거를 만든다.

## Active

### P3 - 유지보수성과 사용자 품질의 마지막 결함 제거

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
