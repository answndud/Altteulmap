# PLAN.md

## Goal

실제 사용자 증가를 전제로 애플리케이션을 10점 수준으로 끌어올린다. 운영 환경 계약·복구·알림을 증명하고, 대규모 조회·동시성·브라우저 호환성·유지보수성의 수치와 회귀 테스트를 확보해 `READY` 승인 근거를 만든다.

## Active

No active work

## Backlog

- 이메일 발송 provider sandbox와 bounce/재전송 멱등성 계약 테스트
- PostgreSQL connection latency·동시 연결 지표 기반 Hyperdrive 도입 재평가
- 장소 merge mutation의 데이터 이전·rollback 정책 확정
- 대규모 데이터에서 검색 relevance와 FTS/trigram 운영 비용 비교
- 실제 iOS·스크린리더 기기 매트릭스 확대
