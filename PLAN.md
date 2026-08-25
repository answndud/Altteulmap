# PLAN.md

## Goal

실제 사용자 증가를 전제로 애플리케이션을 10점 수준으로 끌어올린다. 운영 환경 계약·복구·알림을 증명하고, 대규모 조회·동시성·브라우저 호환성·유지보수성의 수치와 회귀 테스트를 확보해 `READY` 승인 근거를 만든다.

## Active

### P6 - 변경 비용과 실제 사용자 품질 개선

4. P6.1 - mock/production·오류 계약 중복 축소
   - 파일: `src/worker/routes/public-write-support.ts`, `src/worker/routes/admin-support.ts`, `src/worker/http/errors.ts`, `src/worker/index.ts`
   - 변경: runtime mode와 database availability 판단을 한 경계로 모으고 API error code/status/no-store/requestId 형식을 공통 helper로 통일한다. 인증(authentication), 권한(authorization), resource ownership 검사를 각각 명시하고 route별 임의 message 의존을 제거한다. 공개 API shape는 유지한다.
   - 검증: 기존 unit/integration/E2E 전체, API contract snapshot, 관리자·소유자·비소유자 matrix, `npm run hygiene:dead-code`, `npm run typecheck`
   - 완료: 새 route가 mock/DB·error·권한 분기를 복제하지 않고, authentication만 통과한 사용자가 타인 resource를 읽거나 수정할 수 없다는 matrix가 CI에서 확인된다.

5. P6.2 - 실제 브라우저·접근성·장애 UX 기준선 완성
   - 파일: `tests/e2e/accessibility.spec.ts`, `tests/e2e/map.mobile.spec.ts`, `tests/e2e/performance.spec.ts`, `docs/audits/principal-engineer-final-review-2026-08-25.md`
   - 변경: Chromium desktop/mobile 외 iOS Safari 실기기 또는 BrowserStack 기준으로 viewport·키보드·스크린리더·위치 거부·지도 SDK 차단·네트워크 중단·폼 입력 보존을 검증한다. API error code 기반으로 재시도 가능/불가, 중복 제출 방지, 저장 실패 후 입력 복원 UX를 고정한다.
   - 검증: Playwright mobile/accessibility, iOS Safari smoke, axe 결과 0 critical/serious, throttled offline/slow network, `npm run perf:client`
   - 완료: 핵심 사용자 여정이 desktop/mobile/iOS에서 동일한 실패·복구 의미를 보이고, 키보드·스크린리더 critical/serious issue와 입력 유실이 없다.

6. P6.3 - 최종 readiness 점수와 운영 승인 갱신
   - 파일: `docs/audits/production-readiness-review-2026-08-25.md`, `docs/audits/principal-engineer-final-review-2026-08-25.md`, `docs/ops/backup-restore.md`, `docs/ops/incident-response.md`
   - 변경: 각 영역 점수를 concrete evidence와 함께 재산정하고 BLOCKER/HIGH/MEDIUM/LOW 또는 READY/READY WITH RISKS/READY를 실제 실행 결과와 연결한다. 미검증 영역은 점수를 올리지 않고 owner·기한·다음 명령을 남긴다.
   - 검증: 전체 CI, 원격 smoke, 복구 리허설, synthetic benchmark, `npm audit --omit=dev --audit-level=moderate`, 문서 링크·날짜·commit 확인
   - 완료: 모든 10점 항목이 코드/테스트/운영 증거로 설명되고, 미해결 조건 없이 승인 가능한 경우에만 `READY`로 승격한다.

## Backlog

- 이메일 발송 provider sandbox와 bounce/재전송 멱등성 계약 테스트
- PostgreSQL connection latency·동시 연결 지표 기반 Hyperdrive 도입 재평가
- 장소 merge mutation의 데이터 이전·rollback 정책 확정
- 대규모 데이터에서 검색 relevance와 FTS/trigram 운영 비용 비교
- 실제 iOS·스크린리더 기기 매트릭스 확대
