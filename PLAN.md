# PLAN.md

## Goal

운영 DB는 PostgreSQL로 유지하고 Docker PostgreSQL을 로컬·CI의 재현 가능한 기본 환경으로 고정한다. 실제 DB 기준의 정합성·동시성·장애·배포 검증을 완료하고 운영 승인 근거를 남긴다.

## Active

### P0 - 원격 seed 실행 영향 확인

1. P0.1 - 원격 DB 변경 영향과 복구 가능성 확인
   - 파일: `scripts/seed-production.mjs`, `src/db/seed.ts`, `docs/ops/backup-restore.md`, `docs/ops/incident-response.md`
   - 변경: 원격 seed 실행 범위를 read-only query·운영 로그·백업 시점으로 확인하고, backup/PITR 복구 가능성을 검토한다. production URL seed 실행을 local-only guard로 차단하고 영향·복구·재발 방지 내용을 기록한다.
   - 검증: 원격 read-only count/invariant query, backup restore rehearsal, `npm run db:check:production`, `git diff --check`
   - 완료: 영향 범위와 복구 결정이 근거와 함께 기록되고 production URL seed 명령이 사전 차단된다.

## Backlog

- 실제 provider OAuth/PKCE sandbox와 이메일 발송 장애를 staging 계약 테스트에 연결
- PostgreSQL connection latency·동시 연결 지표 수집 후 Hyperdrive 도입 여부 재평가
- 장소 merge mutation의 데이터 이전·rollback 정책 확정 후 구현
- global search pg_trgm/전문 검색 도입 여부를 synthetic benchmark 후 결정
- 실제 iOS·스크린리더 호환성 매트릭스 재평가
