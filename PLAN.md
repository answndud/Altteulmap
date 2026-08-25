# PLAN.md

## Goal

운영 DB는 PostgreSQL로 유지하고 Docker PostgreSQL을 로컬·CI의 재현 가능한 기본 환경으로 고정한다. 실제 DB 기준의 정합성·동시성·장애·배포 검증을 완료하고 운영 승인 근거를 남긴다.

## Active

No active work

## Backlog

- 실제 provider OAuth/PKCE sandbox와 이메일 발송 장애를 staging 계약 테스트에 연결
- PostgreSQL connection latency·동시 연결 지표 수집 후 Hyperdrive 도입 여부 재평가
- 장소 merge mutation의 데이터 이전·rollback 정책 확정 후 구현
- global search pg_trgm/전문 검색 도입 여부를 synthetic benchmark 후 결정
- 실제 iOS·스크린리더 호환성 매트릭스 재평가
