# PLAN.md

## Goal

실제 사용자 증가를 전제로 애플리케이션을 10점 수준으로 끌어올린다. 운영 환경 계약·복구·알림을 증명하고, 대규모 조회·동시성·브라우저 호환성·유지보수성의 수치와 회귀 테스트를 확보해 `READY` 승인 근거를 만든다.

## Active

No active work

## Backlog

- 이메일 provider sandbox의 bounce·재전송 멱등성 계약과 실제 운영 검증
- PostgreSQL connection latency·동시 연결 지표에 따른 Hyperdrive 도입 재평가
- 장소 merge mutation의 대량 데이터 이전·중단 복구 정책
- 실제 iOS Safari·스크린리더 기기와 저사양 네트워크 매트릭스 확대
- 24시간 soak test와 장애 주입을 포함한 운영 부하 리허설
