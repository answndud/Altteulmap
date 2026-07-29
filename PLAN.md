# PLAN.md

## Goal

감사 보고서의 실행 순서에 따라 production fail-closed 보안, visitor actor 무결성, 가격 데이터 정합성, query/운영 검증을 구현하고 검증 가능한 상태로 만든다. Cloudflare secret 반영은 Wrangler 인증이 확보된 경우에만 수행한다.

## Active

No active work

## Backlog

- Hyperdrive 도입 여부를 connection/latency metric으로 재평가
- 실제 provider OAuth/PKCE sandbox 검증
- 장소 merge mutation은 운영자 승인 UX와 rollback 정책 확정 후 별도 구현
- React Router upstream advisory fix 공개 시 재평가
