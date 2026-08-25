# PLAN.md

## Goal

모바일 환경·모바일 브라우저·모바일 접근성은 품질 목표에서 제외한다. 데스크톱 웹과 서버 운영 품질을 중심으로 10만 규모 PostgreSQL 성능과 운영 안전성을 유지한다.

No active work

## Backlog

- staging OAuth 성공 callback, 실제 backup/PITR 복구, Cloudflare 알림 수신 증적 확보
- 이메일 provider sandbox의 bounce·재전송 멱등성 검증
- 장소 merge 대량 데이터 이전·중단 복구 정책
- 24시간 soak test와 다중 Worker 장애 주입
- Hyperdrive 도입 여부를 connection latency·동시 연결 지표로 재평가
